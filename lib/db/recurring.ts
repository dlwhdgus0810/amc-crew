import { and, eq, gte, inArray } from 'drizzle-orm';
import { getDb } from './index';
import { posts, recurringRules } from './schema';
import { createPost } from './posts';
import { getProfiles, resolveDisplayName } from '../store';
import { addDays, nextWeekdayOnOrAfter, todayLocal, weekdayOf } from '../dates';
import type { Msg } from '../i18n';

/** 크론이 만든 회차의 알림 문구 (수신자 언어로 렌더된다) */
const WEEKLY_LABEL: Msg = { ko: '이번 주 모임', en: 'this week', es: 'esta semana' };
import type { TitleMeta } from '../tmdb';

/** 크론이 미리 만들어 두는 기간. 7일이면 매주 규칙당 정확히 한 회차가 잡힌다. */
const HORIZON_DAYS = 7;

export interface RuleInput {
  category: string;
  authorId: string;
  authorName: string;
  /** 같이 여는 사람 — 다음 주 회차에도 그대로 이어진다 */
  coHostId?: string | null;
  /** 닉네임 허용 여부도 다음 주 회차로 이어진다 */
  allowNicknames?: boolean;
  startDate: string; // 첫 회차 날짜 — 이 날짜의 요일이 반복 요일이 된다
  startTime: string;
  endTime: string | null;
  location: string;
  description?: string;
  capacity?: number;
  title?: string;
  titleMeta?: TitleMeta;
  visibility?: 'public' | 'link';
  /** 아무에게도 알리지 않고 넣는다 — 관리자가 지난 모임을 기록으로 채워 넣을 때 */
  silent?: boolean;
  origin?: string;
}

/**
 * 정기 모임 규칙 생성 + 첫 회차 즉시 생성.
 * 반환하는 postId는 첫 회차 (폼에서 만든 그 날짜)다.
 */
export async function createRecurringRule(input: RuleInput): Promise<{ ruleId: string; postId: string }> {
  const db = await getDb();
  const ruleId = crypto.randomUUID();

  await db.insert(recurringRules).values({
    id: ruleId,
    category: input.category,
    authorId: input.authorId,
    coHostId: input.coHostId ?? null,
    allowNicknames: input.allowNicknames ?? false,
    weekday: weekdayOf(input.startDate),
    startDate: input.startDate,
    title: input.title ?? null,
    titleMeta: input.titleMeta ?? null,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    description: input.description ?? null,
    capacity: input.capacity ?? null,
    visibility: input.visibility ?? 'public',
  });

  const postId = await createPost({
    category: input.category,
    authorId: input.authorId,
    authorName: input.authorName,
    ...(input.coHostId ? { coHostId: input.coHostId } : {}),
    ...(input.allowNicknames ? { allowNicknames: true } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.titleMeta ? { titleMeta: input.titleMeta } : {}),
    date: input.startDate,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    ...(input.description ? { description: input.description } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    ...(input.visibility ? { visibility: input.visibility } : {}),
    recurringRuleId: ruleId,
    ...(input.silent ? { silent: true as const } : {}),
    ...(input.origin ? { origin: input.origin } : {}),
  });

  return { ruleId, postId };
}

export async function getRule(ruleId: string) {
  const db = await getDb();
  return (await db.select().from(recurringRules).where(eq(recurringRules.id, ruleId)))[0];
}

/** 반복 중단 — 규칙만 비활성화하고 이미 생성된 회차는 그대로 둔다. */
export async function deactivateRule(ruleId: string): Promise<void> {
  const db = await getDb();
  await db.update(recurringRules).set({ active: false }).where(eq(recurringRules.id, ruleId));
}

/**
 * 앞으로 HORIZON_DAYS 안에 와야 하는 회차 중 아직 없는 것을 만든다 (크론이 매일 호출).
 * 이미 생성된 회차는 (규칙, 날짜)로 걸러내므로 여러 번 실행해도 중복되지 않는다.
 */
export async function materializeDueOccurrences(origin: string): Promise<{ created: number }> {
  const db = await getDb();
  const rules = await db.select().from(recurringRules).where(eq(recurringRules.active, true));
  if (rules.length === 0) return { created: 0 };

  const today = todayLocal();
  const horizonEnd = addDays(today, HORIZON_DAYS - 1);

  // 기존 회차를 한 번에 조회해 (규칙id|날짜) 집합으로 만든다
  const existing = await db
    .select({ ruleId: posts.recurringRuleId, date: posts.date })
    .from(posts)
    .where(and(inArray(posts.recurringRuleId, rules.map((r) => r.id)), gte(posts.date, today)));
  const seen = new Set(existing.map((e) => `${e.ruleId}|${e.date}`));

  const profiles = await getProfiles();
  let created = 0;

  for (const rule of rules) {
    // 규칙 시작일 이전은 만들지 않는다
    const from = rule.startDate > today ? rule.startDate : today;
    const date = nextWeekdayOnOrAfter(from, rule.weekday);
    if (date > horizonEnd || seen.has(`${rule.id}|${date}`)) continue;

    try {
      await createPost({
        category: rule.category,
        authorId: rule.authorId,
        authorName: resolveDisplayName(profiles[rule.authorId], '알 수 없음'),
        ...(rule.coHostId ? { coHostId: rule.coHostId } : {}),
        ...(rule.allowNicknames ? { allowNicknames: true } : {}),
        ...(rule.title ? { title: rule.title } : {}),
        ...(rule.titleMeta ? { titleMeta: rule.titleMeta } : {}),
        date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        location: rule.location,
        ...(rule.description ? { description: rule.description } : {}),
        ...(rule.capacity !== null ? { capacity: rule.capacity } : {}),
        visibility: rule.visibility === 'link' ? 'link' : 'public',
        recurringRuleId: rule.id,
        label: WEEKLY_LABEL,
        origin,
      });
      created++;
    } catch (e) {
      // 한 규칙이 실패해도 나머지는 계속 생성한다
      console.error('[recurring] occurrence create failed:', rule.id.slice(0, 8), e);
    }
  }
  return { created };
}
