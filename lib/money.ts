// 정산 금액 계산. 돈은 센트 정수로만 다룬다 — 달러를 소수로 굴리면 합계가 원금과 어긋난다.

/** "12.50" → 1250. 숫자가 아니거나 범위를 벗어나면 null */
export function parseAmountCents(input: unknown): number | null {
  const text = typeof input === 'string' ? input.trim() : typeof input === 'number' ? String(input) : '';
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  // 부동소수 반올림 오차를 피하려고 문자열을 잘라서 센트를 만든다 (0.29 * 100 = 28.999…)
  const [dollars, frac = ''] = text.split('.');
  const cents = Number(dollars) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

/** 1250 → "$12.50" */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * 금액을 사람들에게 나눈다. 나머지 센트는 버리지 않고 앞사람부터 1센트씩 더 얹는다 —
 * 합계가 반드시 원금과 같아야 한다 ($10을 셋이 나누면 3.34 / 3.33 / 3.33).
 *
 * 누가 1센트를 더 낼지는 id 순으로 정해 매번 같은 결과가 나오게 한다.
 */
export function splitCents(total: number, userIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (userIds.length === 0 || total <= 0) return out;
  const ordered = [...userIds].sort();
  const base = Math.floor(total / ordered.length);
  const remainder = total - base * ordered.length;
  ordered.forEach((id, i) => out.set(id, base + (i < remainder ? 1 : 0)));
  return out;
}

/**
 * 모임에 없는 사람까지 끼워 나눈다.
 *
 * 총 금액을 (참가자 수 + 외부 인원 수)로 나누고, 그중 참가자 몫만 돌려준다.
 * 외부 인원 몫은 앱이 청구할 대상이 없으므로 받을 사람이 알아서 받는다 —
 * 그래서 돌려주는 금액의 합은 총액보다 작다.
 *
 * 나머지 센트는 참가자에게 먼저 붙인다. 어차피 외부 인원에게는 1센트를 물릴 방법이 없다.
 */
export function splitWithExtras(
  total: number,
  userIds: string[],
  extraHeads: number
): Map<string, number> {
  const heads = userIds.length + Math.max(0, extraHeads);
  const out = new Map<string, number>();
  if (heads === 0 || total <= 0) return out;
  const base = Math.floor(total / heads);
  let remainder = total - base * heads;
  for (const id of [...userIds].sort()) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    out.set(id, base + extra);
  }
  return out;
}

/**
 * Venmo 딥링크 — 받는 사람·금액·메모를 채운 채로 Venmo가 열린다.
 * 확인은 Venmo 안에서 누른다. 문서로 보장된 규격은 아니라 바뀔 수 있다.
 */
export function venmoLink(username: string, cents: number, note: string): string {
  const params = new URLSearchParams({ txn: 'pay', amount: (cents / 100).toFixed(2), note });
  return `https://venmo.com/${encodeURIComponent(username)}?${params}`;
}

/**
 * 짧은 링크 코드. 헷갈리는 글자(0/O, 1/l/I)를 뺀 32자에서 고른다 —
 * 사람이 눈으로 옮겨 적을 수도 있는 주소다.
 */
export function shortCode(length = 6): string {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}
