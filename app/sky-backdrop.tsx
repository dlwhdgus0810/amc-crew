/**
 * 별보러가자 화면의 밤하늘 배경.
 *
 * 카드에 깔았던 유성을 화면 전체로 옮긴 것인데, 카드와 달리 여기는 바탕이 크림색이라
 * 별을 그대로 얹으면 보이지가 않는다. 그래서 이 화면에서만 색을 밤으로 바꾼다 —
 * 앱이 색을 전부 CSS 변수로 쓰고 있어서, 변수만 다시 정해 주면 글씨·카드·선이 한꺼번에
 * 따라온다 (app/overrides.css의 .sky-scope).
 *
 * 서버에서 그려지는 마크업이라 첫 화면부터 밤이다. 나중에 자바스크립트로 몸통에 클래스를
 * 붙이는 방식이었다면 크림색이 한 번 번쩍하고 지나간다.
 *
 * 별과 유성은 그림 파일이 아니라 CSS다. 유성은 자리·시각·빠르기가 다 다르고, 한 바퀴의
 * 앞부분만 보이므로 몇 초씩 비어 있다가 하나씩 지나간다.
 */
export default function SkyBackdrop() {
  return (
    <div className="sky-backdrop" aria-hidden="true">
      <span className="sky-stars" />
      <span className="sky-meteors">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
