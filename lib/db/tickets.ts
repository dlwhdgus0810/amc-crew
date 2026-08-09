import { desc, eq } from 'drizzle-orm';
import { getDb } from './index';
import { notifications, tickets, users } from './schema';
import { resolveDisplayName, UNKNOWN_NAME } from '../store';
import { notifyAdmins } from './admin-notify';
import { sendPush } from '../push';
import { Msg, pick, toLocale } from '../i18n';

export type TicketKind = 'feature' | 'improve' | 'bug' | 'other' | 'cheer';
export type TicketStatus = 'open' | 'planned' | 'done' | 'declined';

export const TICKET_KINDS: TicketKind[] = ['feature', 'improve', 'bug', 'other', 'cheer'];
export const TICKET_STATUSES: TicketStatus[] = ['open', 'planned', 'done', 'declined'];

/** 알림 문구 (수신자 언어로 렌더된다) */
const N = {
  newTicket: { ko: '📮 새 건의 #{n}: {title} — {by}', en: '📮 New ticket #{n}: {title} — {by}', es: '📮 Nueva sugerencia n.º {n}: {title} — {by}' },
  newCheer: { ko: '💌 쪽지 #{n}: {title} — {by}', en: '💌 Note #{n}: {title} — {by}', es: '💌 Recado n.º {n}: {title} — {by}' },
  btnReview: { ko: '건의 보기', en: 'Open ticket', es: 'Abrir sugerencia' },
  btnMine: { ko: '내 건의 보기', en: 'View my tickets', es: 'Ver mis sugerencias' },
  verdict: { ko: '📮 건의 #{n} "{title}" — {status}{note}', en: '📮 Ticket #{n} “{title}” — {status}{note}', es: '📮 Sugerencia n.º {n} «{title}» — {status}{note}' },
  note: { ko: ' · {text}', en: ' · {text}', es: ' · {text}' },
};

/** 상태 이름 — 알림에도 화면과 같은 말을 쓴다 */
export const TICKET_STATUS_LABEL: Record<TicketStatus, Msg> = {
  open: { ko: '접수됨', en: 'Received', es: 'Recibida' },
  planned: { ko: '반영 예정', en: 'Planned', es: 'Prevista' },
  done: { ko: '반영됨', en: 'Shipped', es: 'Hecha' },
  declined: { ko: '보류', en: 'Not planned', es: 'Aparcada' },
};

export interface TicketView {
  id: string;
  number: number;
  userId: string;
  userName: string;
  kind: TicketKind;
  title: string;
  body: string | null;
  status: TicketStatus;
  adminNote: string | null;
  createdAt: string;
}

/** 수신자 언어 (users.locale, 없으면 기본) */
async function localeOf(userId: string) {
  const db = await getDb();
  const row = (await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)))[0];
  return toLocale(row?.locale);
}

/** userId를 주면 그 사람 것만 (건의함), 없으면 전체 (관리자) */
export async function listTickets(userId?: string): Promise<TicketView[]> {
  const db = await getDb();
  const rows = userId
    ? await db.select().from(tickets).where(eq(tickets.userId, userId)).orderBy(desc(tickets.createdAt))
    : await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  if (rows.length === 0) return [];

  const profiles = await db
    .select({ id: users.id, kakaoName: users.kakaoName, nickname: users.nickname })
    .from(users);
  const nameById = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((r) => {
    const p = nameById.get(r.userId);
    return {
      id: r.id,
      number: r.number,
      userId: r.userId,
      userName: p
        ? resolveDisplayName(
            { kakaoName: p.kakaoName, ...(p.nickname ? { nickname: p.nickname } : {}), kakaoNameHistory: [] },
            UNKNOWN_NAME
          )
        : UNKNOWN_NAME,
      kind: r.kind as TicketKind,
      title: r.title,
      body: r.body,
      status: r.status as TicketStatus,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function getTicket(id: string) {
  const db = await getDb();
  return (await db.select().from(tickets).where(eq(tickets.id, id)))[0];
}

/** 티켓 발급 + 관리자 알림. 발급 번호를 돌려준다. */
export async function createTicket(input: {
  userId: string;
  userName: string;
  kind: TicketKind;
  title: string;
  body?: string;
  origin: string;
}): Promise<{ id: string; number: number }> {
  const db = await getDb();
  const id = crypto.randomUUID();
  // number는 DB가 매기므로 돌려받아야 화면에 "#12 발급됐어요"를 띄울 수 있다
  const [row] = await db
    .insert(tickets)
    .values({
      id,
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
    })
    .returning();

  await notifyAdmins({
    exclude: input.userId,
    message: (locale) =>
      pick(locale, input.kind === 'cheer' ? N.newCheer : N.newTicket, {
        n: String(row?.number ?? 0),
        title: input.title,
        by: input.userName,
      }),
    button: (locale) => pick(locale, N.btnReview),
    linkUrl: `${input.origin}/admin`,
    tag: 'ticket',
  });

  return { id, number: row?.number ?? 0 };
}

/** 상태 변경 (관리자) + 건의한 사람에게 알림 */
export async function reviewTicket(input: {
  id: string;
  status: TicketStatus;
  adminNote?: string;
  requesterId: string;
  number: number;
  title: string;
  origin: string;
}): Promise<void> {
  const db = await getDb();
  await db
    .update(tickets)
    .set({ status: input.status, adminNote: input.adminNote ?? null })
    .where(eq(tickets.id, input.id));

  const locale = await localeOf(input.requesterId);
  const message = pick(locale, N.verdict, {
    n: String(input.number),
    title: input.title,
    status: pick(locale, TICKET_STATUS_LABEL[input.status]),
    note: input.adminNote ? pick(locale, N.note, { text: input.adminNote }) : '',
  });
  try {
    await db
      .insert(notifications)
      .values({ id: crypto.randomUUID(), userId: input.requesterId, postId: null, message });
    // 인앱만 남기면 앱을 열어보기 전까지 결과를 모른다 (예전에는 카톡이 그 역할을 했다)
    await sendPush([input.requesterId], {
      title: 'Kansas Korean',
      body: message,
      url: `${input.origin}/tickets`,
      tag: 'ticket',
    });
  } catch (e) {
    console.error('[ticket] requester notify failed:', e);
  }
}
