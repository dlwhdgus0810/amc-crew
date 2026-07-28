/**
 * app/globals.css의 :hover 규칙을 @media (hover: hover)로 감싼다.
 *
 * 왜: iOS는 hover 스타일이 걸린 요소를 "첫 탭은 hover, 두 번째 탭이 실행"으로
 * 다룬다. 그래서 탭바 버튼을 두 번 눌러야 하는 일이 생긴다.
 * 이 작업만은 덧붙이기(overrides.css)로 안 되고 시안 파일의 규칙 자체를
 * 감싸야 해서 스크립트로 둔다. 여러 번 돌려도 안전하다(이미 감싼 건 건너뛴다).
 *
 *   node scripts/no-touch-hover.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../app/globals.css', import.meta.url);
const lines = readFileSync(FILE, 'utf8').split('\n');
const out = [];
let wrapped = 0;
/* 이미 @media (hover: hover) { ... } 안에 있는 줄은 그대로 둔다 (두 번 감싸지 않도록) */
let depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  const indent = line.slice(0, line.length - line.trimStart().length);

  if (depth > 0) {
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    out.push(line);
    continue;
  }
  if (/^@media \(hover: hover\)\s*\{\s*$/.test(trimmed)) {
    depth = 1;
    out.push(line);
    continue;
  }

  const bare = trimmed.includes(':hover') && !trimmed.startsWith('@media');

  // 한 줄짜리 규칙:  .sel:hover { ... }
  if (bare && trimmed.includes('{') && trimmed.endsWith('}')) {
    out.push(`${indent}@media (hover: hover) { ${trimmed} }`);
    wrapped++;
    continue;
  }
  // 선택자가 두 줄로 나뉜 규칙:  .a:hover,\n  .b:hover { ... }
  if (bare && trimmed.endsWith(',') && lines[i + 1]?.includes(':hover')) {
    out.push(`${indent}@media (hover: hover) {`, `  ${line}`, `  ${lines[i + 1]}`, `${indent}}`);
    wrapped += 2;
    i++;
    continue;
  }
  out.push(line);
}

writeFileSync(FILE, out.join('\n'));
console.log(wrapped ? `감쌌습니다: ${wrapped}개 규칙` : '감쌀 규칙이 없습니다 (이미 처리됨)');
