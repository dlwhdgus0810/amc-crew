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
