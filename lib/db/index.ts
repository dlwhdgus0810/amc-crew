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
  if (url) {
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
