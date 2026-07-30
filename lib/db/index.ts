import { drizzle as drizzleNeon, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { BOOTSTRAP_DDL } from './bootstrap';

export type Db = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// Neon Vercel 통합이 주입하는 두 이름 모두 수용
function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

/** 내 컴퓨터에서 도는 DB인지 (원격이면 실제 서비스 데이터일 가능성이 크다) */
function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false; // 주소를 못 읽으면 원격으로 친다 (안전한 쪽)
  }
}

/**
 * 개발 중에 실제 서비스 DB를 쓰려는 상황인지.
 *
 * `npm run db:push`를 하려면 .env.local에 진짜 DATABASE_URL을 넣어야 하는데,
 * 그걸 넣어둔 채 dev 서버를 띄우면 로컬 테스트가 그대로 서비스 데이터에 쓰인다.
 * 실제로 두 번 그렇게 사고가 났다 — 가짜 회원과 모임이 서비스 DB에 들어갔다.
 * 그래서 기본값을 "무시하고 인메모리로"로 두고, 정말 필요할 때만 ALLOW_PROD_DB=1로 연다.
 * (drizzle-kit은 이 파일을 거치지 않으므로 db:push는 그대로 동작한다.)
 */
function blockedInDev(url: string): boolean {
  return process.env.NODE_ENV !== 'production' && !isLocalUrl(url) && process.env.ALLOW_PROD_DB !== '1';
}

// dev 모드에서 라우트별 번들이 모듈을 각자 로드해도 인스턴스가 공유되도록 globalThis에 붙인다
const globalDb = globalThis as typeof globalThis & {
  __odysseyDb?: Db;
  __odysseyDbReady?: Promise<void>;
};

/**
 * DB 핸들. DATABASE_URL이 있으면 Neon(http), 없으면 PGlite 인메모리(로컬 개발 전용,
 * 프로세스 재시작 시 초기화 — 기존 Redis 메모리 폴백과 동일한 기대치).
 */
export async function getDb(): Promise<Db> {
  if (globalDb.__odysseyDb) {
    await globalDb.__odysseyDbReady;
    return globalDb.__odysseyDb;
  }

  const url = databaseUrl();
  if (url && blockedInDev(url)) {
    console.warn(
      '[db] 개발 환경이라 원격 DATABASE_URL을 무시하고 인메모리(PGlite)로 붙습니다.\n' +
        '     실제 DB에 붙이려면 ALLOW_PROD_DB=1 을 함께 주세요.'
    );
  }

  if (url && !blockedInDev(url)) {
    globalDb.__odysseyDb = drizzleNeon(neon(url), { schema });
    globalDb.__odysseyDbReady = Promise.resolve();
  } else {
    // 동적 import: 프로덕션 번들이 PGlite를 로드하지 않도록
    const { PGlite } = await import('@electric-sql/pglite');
    const pglite = new PGlite();
    globalDb.__odysseyDb = drizzlePglite(pglite, { schema });
    globalDb.__odysseyDbReady = pglite.exec(BOOTSTRAP_DDL).then(() => undefined);
  }
  await globalDb.__odysseyDbReady;
  return globalDb.__odysseyDb;
}
