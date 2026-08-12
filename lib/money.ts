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
 * Zelle 값을 읽기 좋게 — 4345311138 → 434-531-1138.
 *
 * 저장된 값은 손대지 않는다. 사람이 적은 그대로 두고 **보여줄 때만** 끊는다.
 * 열 자리(또는 1로 시작하는 열한 자리) 숫자일 때만 끊는다 — 이메일이나 이미 끊어
 * 적은 번호는 그대로 나간다. 옮겨 적다 한 자리를 놓치면 남의 계좌로 가는 값이라,
 * 세 자리씩 끊어 두면 눈으로 맞춰보기가 쉽다.
 */
export function formatZelle(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!/^\d+$/.test(value.trim())) return value; // 숫자만 적은 경우에만 손댄다 (이메일 등은 그대로)
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
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
 *
 * **빈칸을 쓰지 않는다.** 메모에 "볼링+8/5(수)+·+내기"처럼 +가 찍히던 문제의 원인은
 * 우리 쪽 인코딩이 아니라 Venmo의 되넘김이다. 실제로 따라가 보면:
 *
 *   https://venmo.com/<id>?note=볼링%208%2F5     ← 우리가 보내는 것 (%20 = 빈칸)
 *     → 302 account.venmo.com/<id>?note=볼링%208%2F5
 *     → 307 venmo://paycharge?...note=볼링+8%2F5  ← 여기서 폼 규칙으로 다시 적는다
 *
 * 마지막 판에 +가 박히고 앱은 퍼센트 디코딩만 하므로 +가 글자 그대로 남는다.
 * %20으로 보내든 +로 보내든 결과가 같아서, 인코딩으로는 못 고친다.
 *
 * 그래서 빈칸을 U+00A0(줄바꿈 없는 빈칸)로 바꿔 보낸다. 이건 ASCII 빈칸이 아니라
 * %C2%A0으로 실려 위 되넘김을 그대로 통과하고(확인함), 앱에서는 보통 빈칸처럼 보인다.
 * 대가는 그 자리에서 줄이 안 바뀐다는 것뿐이라, 메모를 짧게 유지한다(NOTE_MAX).
 */
// 눈에 안 보이는 글자라 이스케이프로 적는다 — 소스에서 ASCII 빈칸과 구분되어야 한다
const NBSP = '\u00a0';

export function venmoLink(username: string, cents: number, note: string): string {
  const amount = (cents / 100).toFixed(2);
  const query = `txn=pay&amount=${amount}&note=${encodeURIComponent(note.replace(/ /g, NBSP))}`;
  return `https://venmo.com/${encodeURIComponent(username)}?${query}`;
}

/**
 * Venmo 메모 한 줄 — 앱의 정산 카드를 그대로 옮긴다.
 *
 * 받는 쪽이 Venmo만 보고도 무엇에 대한 돈인지 알아야 한다. 모임 이름과 날짜만
 * 적혀 있으면 "이 $12.50이 회비인지 밥값인지"를 다시 물어보게 된다.
 *
 * 길이를 재는 이유: Venmo가 긴 메모를 어디서 자르는지 문서로 밝혀져 있지 않다.
 * 자르기는 우리가 한다 — 남의 손에 맡기면 항목 이름이 중간에서 끊겨 오해를 부른다.
 * 넘치는 항목은 이름을 지우고 개수만 남긴다("+2"). 숫자는 어느 언어에서나 같은 뜻이다.
 *
 * 180에서 120으로 줄였다. 빈칸을 U+00A0으로 보내는 탓에(venmoLink) 메모 한 줄이
 * 통째로 한 낱말처럼 취급되어 줄이 안 바뀐다 — 길면 앱에서 잘려 보일 수 있다.
 * 항목 넷까지는 넉넉히 들어간다.
 */
const NOTE_MAX = 120;

export interface NotePart {
  label: string;
  cents: number;
}

/**
 * 메모에 실을 「내 몫의 내역」 — 항목마다 내가 낀 것만, 내 몫만.
 *
 * 서버는 사람별 합계만 내려주므로 항목별 몫은 여기서 같은 함수(splitWithExtras)로 다시 센다.
 * 그래도 마지막 한두 센트는 어긋날 수 있어서, 차이는 마지막 항목에 얹어 **합이 늘 실제
 * 청구액과 같게** 맞춘다. 메모의 합이 결제 금액과 다르면 받는 쪽이 그걸 먼저 물어본다.
 */
export function myShareParts(
  items: { label: string; amountCents: number; scope: 'all' | 'some'; memberIds: string[]; extraPeople: number }[],
  payerIds: string[],
  userId: string,
  myCents: number
): NotePart[] {
  const inList = new Set(payerIds);
  const parts: NotePart[] = [];
  for (const item of items) {
    const members = item.scope === 'all' ? payerIds : item.memberIds.filter((id) => inList.has(id));
    const cents = splitWithExtras(item.amountCents, members, item.extraPeople).get(userId) ?? 0;
    if (cents > 0) parts.push({ label: item.label, cents });
  }
  const sum = parts.reduce((n, p) => n + p.cents, 0);
  const last = parts[parts.length - 1];
  if (last && sum !== myCents) last.cents += myCents - sum;
  return parts;
}

export function payNote(event: string, parts: { label: string; cents: number }[]): string {
  const head = event.trim();
  const shown: string[] = [];
  let dropped = 0;

  for (const p of parts) {
    const piece = `${p.label.trim()} ${formatCents(p.cents)}`;
    const candidate = [head, [...shown, piece].join(', ')].filter(Boolean).join(' · ');
    // 뒤에 "+n"이 붙을 자리까지 미리 비워 둔다 (넉넉히 5자)
    if (candidate.length > NOTE_MAX - 5) dropped++;
    else shown.push(piece);
  }

  const body = [...shown, ...(dropped > 0 ? [`+${dropped}`] : [])].join(', ');
  return [head, body].filter(Boolean).join(' · ').slice(0, NOTE_MAX);
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
