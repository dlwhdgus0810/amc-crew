/**
 * 관리자가 "일반 회원 화면"을 확인할 때 쓰는 가짜 계정.
 *
 * 실제 회원으로 둔갑하는 기능은 일부러 만들지 않았다 — 비공개 모임이 참가자에게만
 * 보이는데, 그 사람으로 들어갈 수 있으면 "관리자에게도 보이지 않아요"가 거짓말이 된다.
 * 여기 있는 계정은 아무의 것도 아니므로 그 약속을 깨지 않는다.
 */
export const TEST_USER_PREFIX = 'test-';

export const TEST_USERS: { id: string; name: string }[] = [
  { id: 'test-a', name: '테스트 A' },
  { id: 'test-b', name: '테스트 B' },
  { id: 'test-c', name: '테스트 C' },
];

export function isTestUser(id: string): boolean {
  return id.startsWith(TEST_USER_PREFIX);
}

export function findTestUser(id: string) {
  return TEST_USERS.find((u) => u.id === id);
}
