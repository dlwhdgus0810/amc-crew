import { readFileSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

/**
 * .env.local에서 값 하나 읽기.
 *
 * Next는 .env.local을 알아서 읽지만 drizzle-kit은 읽지 않는다 — 그래서 값이 멀쩡히
 * 있는데도 `npm run db:push`가 url: '' 로 떨어진다. dotenv를 새로 깔지 않으려고
 * 필요한 줄만 직접 찾아 쓴다. (npm 스크립트는 항상 프로젝트 루트에서 돌아간다)
 */
function fromEnvLocal(key: string): string | undefined {
  let text: string;
  try {
    text = readFileSync('.env.local', 'utf8');
  } catch {
    return undefined; // 배포 환경엔 이 파일이 없다 — 그쪽은 진짜 환경변수를 쓴다
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || m[1] !== key) continue;
    const value = m[2].trim();
    const quoted = /^(["'])(.*)\1$/.exec(value);
    return quoted ? quoted[2] : value;
  }
  return undefined;
}

// 진짜 환경변수가 있으면 그쪽이 이긴다 (CI·Vercel에서 덮어쓸 수 있게)
const url =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  fromEnvLocal('DATABASE_URL') ??
  fromEnvLocal('POSTGRES_URL') ??
  '';

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  dbCredentials: { url },
});
