/**
 * 뼈대 화면 — 데이터를 기다리는 동안 실제와 같은 크기의 회색 덩어리를 깔아 둔다.
 *
 * 「불러오는 중…」 한 줄을 대신한다. 글자 한 줄은 두 가지가 나쁘다 —
 * 화면이 비어 보여서 200ms짜리 기다림도 고장처럼 읽히고, 내용이 도착하는 순간
 * 한 줄이 여러 줄로 부풀면서 아래가 통째로 밀린다. 자리를 미리 잡아 두면 둘 다 없다.
 *
 * 서버 컴포넌트다 — loading.tsx가 그대로 쓰고, 아직 클라이언트에서 받아오는 화면은
 * 자기 자리에서 같은 걸 그린다. Stage 4에서 SSR로 옮기면 뒤쪽 쓰임만 사라진다.
 */

/** 회색 덩어리 하나 */
export function Bar({ w = '100%', h = 14, mt = 0 }: { w?: string | number; h?: number; mt?: number }) {
  return <span className="sk-bar" style={{ width: w, height: h, marginTop: mt }} aria-hidden />;
}

/** 카드 한 장 — 안에 든 줄들은 부르는 쪽이 정한다 */
export function Block({ h, children }: { h: number; children?: React.ReactNode }) {
  return (
    <div className="sk-block" style={{ minHeight: h }} aria-hidden>
      {children}
    </div>
  );
}

/**
 * 뼈대를 감싸는 곳.
 *
 * 화면 읽어주는 기기에는 「불러오는 중」 한마디만 준다 — 회색 덩어리를 하나씩
 * 읽어 주면 아무 뜻도 없는 소리가 길게 이어진다.
 */
export function Skeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sk" role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

/** 카테고리 카드 목록 (홈·둘러보기) */
export function CategoryCardsSkeleton({ n = 3, label }: { n?: number; label: string }) {
  return (
    <Skeleton label={label}>
      {Array.from({ length: n }, (_, i) => (
        <Block key={i} h={150}>
          <Bar w={64} h={10} />
          <Bar w={132} h={26} mt={14} />
          <Bar w={168} h={12} mt={8} />
          <Bar w="100%" h={1} mt={22} />
          <Bar w={190} h={12} mt={14} />
        </Block>
      ))}
    </Skeleton>
  );
}

/** 모임 카드 목록 (카테고리 화면) */
export function PostCardsSkeleton({ n = 3, label }: { n?: number; label: string }) {
  return (
    <Skeleton label={label}>
      <Bar w={150} h={18} />
      {Array.from({ length: n }, (_, i) => (
        <div className="sk-post" key={i} aria-hidden>
          <Bar w={186} h={20} />
          <Bar w={132} h={13} mt={7} />
          <Bar w={96} h={13} mt={6} />
        </div>
      ))}
    </Skeleton>
  );
}
