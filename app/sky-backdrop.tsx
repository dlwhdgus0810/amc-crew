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
 * 하늘은 네 겹이다.
 *  1. 어스름 — 들어온 직후에만. 해가 넘어가듯 걷히면서 아래의 밤이 드러난다.
 *  2. 촘촘한 잔별 — 배경 그림 한 겹. 가만히 있고, 수가 많아도 요소가 늘지 않는다.
 *  3. 반짝이는 별 — 아래 STARS. 네갈래 반짝임 모양이고, 하나씩 따로 밝기가 오르내린다.
 *  4. 유성 — 가끔 지나간다.
 */

/**
 * 반짝이는 별들. 자리와 박자를 여기에 적어 둔다.
 *
 * 무작위로 뽑지 않는 이유: 서버와 브라우저가 각자 다른 수를 뽑으면 화면이 어긋난다
 * (hydration mismatch). 눈으로 흩어 놓은 값을 그대로 쓰면 그럴 일이 없다.
 *
 * dur(한 번 밝아졌다 어두워지는 데 걸리는 시간)와 delay를 서로 어긋나게 뒀다. 같으면
 * 스물몇 개가 한 박자로 깜빡여서 별이 아니라 신호등이 된다.
 * 느긋하게 오르내린다 — 빠르면 깜빡이는 표시등처럼 보이고, 글을 읽는 화면에서는
 * 자꾸 눈이 그쪽으로 끌려간다. 실제로 보는 밤하늘도 이 정도로 천천히 변한다.
 * size는 픽셀 — 동그란 점이던 시절보다 훨씬 크다. 네갈래로 뻗은 모양이라 가운데가 얇아서,
 * 점과 같은 크기로 두면 오히려 더 작아 보이고 반짝이는 것도 눈에 안 띈다.
 */
const STARS: { top: number; left: number; size: number; delay: number; dur: number; warm?: boolean }[] = [
  { top: 6, left: 9, size: 14, delay: 0, dur: 6.8, warm: true },
  { top: 12, left: 46, size: 8, delay: 1.7, dur: 10.2 },
  { top: 4, left: 72, size: 11, delay: 0.6, dur: 8.4 },
  { top: 17, left: 24, size: 7.5, delay: 2.9, dur: 12.6 },
  { top: 21, left: 88, size: 15, delay: 1.1, dur: 7.6, warm: true },
  { top: 27, left: 58, size: 8.5, delay: 3.6, dur: 11.2 },
  { top: 31, left: 14, size: 10, delay: 0.3, dur: 9.4 },
  { top: 35, left: 79, size: 7, delay: 2.2, dur: 13.8 },
  { top: 39, left: 38, size: 13, delay: 4.4, dur: 7.8, warm: true },
  { top: 44, left: 66, size: 8.5, delay: 1.4, dur: 10.8 },
  { top: 48, left: 5, size: 9.5, delay: 3.1, dur: 8.8 },
  { top: 52, left: 92, size: 7.5, delay: 0.9, dur: 12.2 },
  { top: 56, left: 30, size: 14.5, delay: 2.6, dur: 7.2, warm: true },
  { top: 61, left: 71, size: 8, delay: 4.9, dur: 11.6 },
  { top: 65, left: 18, size: 7, delay: 1.9, dur: 9.8 },
  { top: 69, left: 50, size: 10.5, delay: 0.2, dur: 13 },
  { top: 73, left: 85, size: 8.5, delay: 3.9, dur: 8.2 },
  { top: 77, left: 34, size: 7.5, delay: 2.4, dur: 11.8 },
  { top: 81, left: 62, size: 14, delay: 0.7, dur: 7.4, warm: true },
  { top: 85, left: 11, size: 8, delay: 4.1, dur: 10.4 },
  { top: 89, left: 76, size: 7, delay: 1.6, dur: 13.4 },
  { top: 93, left: 43, size: 10, delay: 3.3, dur: 9 },
  { top: 8, left: 60, size: 7.5, delay: 5.2, dur: 11 },
  { top: 25, left: 41, size: 6.5, delay: 2.0, dur: 14.2 },
  { top: 58, left: 47, size: 6.5, delay: 4.6, dur: 12.8 },
  { top: 71, left: 3, size: 8.5, delay: 0.5, dur: 9.6 },
];

/**
 * sunset을 켜면 어스름에서 시작해 밤으로 내려간다 (5.5초).
 *
 * 낮에서 시작하지 않는 이유: 이 화면의 글씨는 이미 밤용 크림색이라, 배경이 밝으면
 * 그동안 글이 안 읽힌다. 해가 막 넘어간 직후에서 시작하면 처음부터 끝까지 읽히면서도
 * 「저물어 간다」는 느낌은 그대로 난다.
 *
 * 카테고리 화면에서만 켠다. 거기서 모임을 눌러 들어갈 때마다 다시 해가 지면,
 * 한 번 볼 때는 멋있던 것이 두 번째부터는 기다리는 시간이 된다.
 */
export default function SkyBackdrop({ sunset = false }: { sunset?: boolean }) {
  return (
    <div className={`sky-backdrop${sunset ? ' sunset' : ''}`} aria-hidden="true">
      {sunset && <span className="sky-dusk" />}
      <span className="sky-dust" />
      <span className="sky-twinkle">
        {STARS.map((s, i) => (
          <i
            key={i}
            className={s.warm ? 'warm' : undefined}
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </span>
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
