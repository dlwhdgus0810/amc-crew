import { count } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema';
import { notifyAdmins } from './admin-notify';
import { pick } from '../i18n';

const N = {
  newMember: { ko: '🎉 새 회원 가입: {name} (총 {n}명)', en: '🎉 New member: {name} ({n} total)' },
  btnOpen: { ko: '앱 열기', en: 'Open the app' },
};

/** 첫 로그인(가입) 시 관리자에게 알린다 */
export async function notifyAdminsNewUser(input: {
  userId: string;
  name: string;
  origin: string;
}): Promise<void> {
  const db = await getDb();
  const total = (await db.select({ n: count() }).from(users))[0]?.n ?? 0;
  await notifyAdmins({
    exclude: input.userId,
    message: (locale) => pick(locale, N.newMember, { name: input.name, n: String(total) }),
    button: (locale) => pick(locale, N.btnOpen),
    linkUrl: `${input.origin}/`,
    tag: 'signup',
  });
}
