/*
 * 코인 그림 — 상점으로 가는 버튼에 붙는다.
 *
 * 리더보드 안에 있던 것을 뺐다. 상점 버튼이 프로필로 옮겨 가면서 두 화면이 나눠 쓰게
 * 됐는데, 한쪽 화면 파일에 두면 다른 쪽이 그 화면을 통째로 불러오게 된다.
 */
export default function CoinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ marginRight: 5, verticalAlign: -2 }}
    >
      <circle cx="12" cy="12" r="8.4" />
      <path d="M14.4 9.2a3 3 0 0 0-2.4-1.1c-1.5 0-2.6.9-2.6 2s1 1.7 2.6 1.9 2.6.8 2.6 1.9-1.1 2-2.6 2a3 3 0 0 1-2.4-1.1" />
      <path d="M12 6.2v11.6" />
    </svg>
  );
}
