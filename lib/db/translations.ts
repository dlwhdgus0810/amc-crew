import { createHash } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from './index';
import { translations } from './schema';
import { Locale } from '../i18n';
import { translateText } from '../translate';

/**
 * 번역 캐시.
 *
 * 값을 치르는 것은 「이 글자를 이 언어로」 처음 옮길 때 한 번뿐이다. 같은 댓글을 다섯 명이
 * 눌러도 밖으로 나가는 요청은 하나고, 두 번째 사람부터는 DB에서 바로 나온다.
 *
 * 글이 아니라 글자에 붙는다 — 원문 해시가 열쇠라서 서로 다른 모임에 같은 말이 달려도
 * 한 번만 옮긴다. 원문이 고쳐지면 해시가 달라져 새로 옮긴다 (낡은 번역이 남지 않는다).
 */

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * 옮긴 글. 못 옮기면 null (키가 없거나, 번역기가 실패했거나).
 *
 * 실패는 담아 두지 않는다 — 잠깐 끊긴 것 때문에 그 글이 영영 「번역 안 됨」으로 굳으면
 * 다시 눌러도 소용이 없어진다.
 */
export async function translateCached(text: string, target: Locale): Promise<string | null> {
  const source = text.trim();
  if (!source) return null;
  const hash = hashOf(source);
  const db = await getDb();

  const [hit] = await db
    .select({ text: translations.text })
    .from(translations)
    .where(and(eq(translations.hash, hash), eq(translations.target, target)));
  if (hit) return hit.text;

  const out = await translateText(source, target);
  if (!out) return null;

  /*
   * 두 사람이 같은 글을 동시에 눌렀으면 둘 다 번역해 온다 — 그때 뒤에 온 쪽은 그냥 넘어간다.
   * 같은 원문·같은 언어라 어느 쪽이 남든 결과가 같다.
   */
  await db
    .insert(translations)
    .values({ hash, target, source, text: out })
    .onConflictDoNothing();
  return out;
}
