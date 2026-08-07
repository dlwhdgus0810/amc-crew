import { inArray } from 'drizzle-orm';
import { getDb } from './index';
import { hiddenCategories } from './schema';

/**
 * 관리자가 목록에서 내려 둔 카테고리.
 *
 * 지우는 것이 아니다 — 카테고리는 코드에 그대로 있고 주소로도 열린다. 홈과 둘러보기에서
 * 빠질 뿐이다. 그래서 안에 들어 있던 모임과 명단도 그대로 남는다.
 */

export async function hiddenSlugs(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ category: hiddenCategories.category }).from(hiddenCategories);
  return rows.map((r) => r.category);
}

/** 통째로 맞바꾼다 — 켜고 끈 결과를 그대로 저장하는 화면이라 하나씩 더하고 빼지 않는다 */
export async function setHiddenSlugs(slugs: string[]): Promise<void> {
  const db = await getDb();
  const now = await hiddenSlugs();
  const add = slugs.filter((s) => !now.includes(s));
  const drop = now.filter((s) => !slugs.includes(s));
  if (drop.length > 0) await db.delete(hiddenCategories).where(inArray(hiddenCategories.category, drop));
  if (add.length > 0) {
    await db.insert(hiddenCategories).values(add.map((category) => ({ category }))).onConflictDoNothing();
  }
}
