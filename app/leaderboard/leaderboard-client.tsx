'use client';

import { useEffect, useState } from 'react';
import { formatPoints, hostTier, HOST_TIERS, ranksOf } from '@/lib/hosting';
import { catDisplayName, getCategory } from '@/lib/categories';
import CatIcon from '../cat-icon';
import { useT } from '../i18n';

interface HostRank {
  id: string;
  name: string;
  avatar: string | null;
  count: number;
}

interface CategoryRank {
  slug: string;
  meetups: number;
  people: number;
}

interface ContribRank extends HostRank {
  photos: number;
  comments: number;
  reviews: number;
  proposals: number;
}

/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx). 로그인 전이면 null */
export interface LeaderboardInitial {
  hosts: HostRank[];
  joiners: HostRank[];
  categories: CategoryRank[];
  contrib: ContribRank[];
}

const T = {
  title: { ko: '리더보드', en: 'Leaderboard', es: 'Clasificación' },
  subtitle: {
    ko: '호스팅은 연 모임에 몇 명이 모였는지로 셉니다 (같이 연 모임은 나눠 가져요). 카테고리를 가리지 않고 공개 모임만 세요.',
    en: 'Hosting counts how many people showed up — co-hosts split it. All categories together, public meetups only.',
    es: 'Organizar cuenta según cuánta gente vino; los co-anfitriones se lo reparten. Todas las categorías juntas, solo quedadas públicas.',
  },
  // 예정된 모임이 안 보이는 이유 — 안 적어 두면 「내 점수가 왜 안 올랐지」가 된다
  afterOnly: {
    ko: '점수는 모임이 끝난 뒤에 올라가요. 예정된 모임은 아직 세지 않아요.',
    en: 'Points land once a meetup is over — upcoming ones aren’t counted yet.',
    es: 'Los puntos se suman cuando la quedada termina: las próximas aún no cuentan.',
  },
  tabHosts: { ko: '호스팅 순위', en: 'Hosted', es: 'Organizadas' },
  tabJoiners: { ko: '참여 순위', en: 'Joined', es: 'Apuntadas' },
  tabCats: { ko: '카테고리 순위', en: 'Categories', es: 'Categorías' },
  tabContrib: { ko: '기록 순위', en: 'Keepers', es: 'Registros' },
  /* 점수만 보면 「왜 내가 저 사람보다 낮지」가 남는다 — 무엇으로 쌓였는지 같이 적는다 */
  contribParts: { ko: '사진 {p} · 댓글 {c}', en: '{p} photos · {c} comments', es: '{p} fotos · {c} comentarios' },
  contribReview: { ko: ' · 후기 {n}', en: ' · {n} reviews', es: ' · {n} reseñas' },
  contribProposal: { ko: ' · 제안 {n}', en: ' · {n} proposals', es: ' · {n} propuestas' },
  emptyContrib: {
    ko: '아직 아무도 남긴 게 없어요.',
    en: 'Nobody has left anything yet.',
    es: 'Todavía nadie ha dejado nada.',
  },
  contribNote: {
    ko: '승인된 카테고리 제안 10점, 후기 5점, 사진·댓글 1점씩이에요. 사진과 댓글은 한 모임에서 5점·3점까지만 세요 — 한 번에 몰아 올리는 것보다 여러 모임에 남기는 쪽이 높아지게요.',
    en: 'An approved category proposal is 10, a review 5, a photo or comment 1 each. Photos and comments count up to 5 and 3 per meetup — spreading across meetups beats dumping into one.',
    es: 'Una propuesta de categoría aprobada vale 10, una reseña 5, y cada foto o comentario 1. Las fotos y comentarios cuentan hasta 5 y 3 por quedada.',
  },
  /* 「몇 번 모였나」가 순위고, 연인원은 옆에 곁들인다 */
  catCount: { ko: '{n}번', en: '{n} meetups', es: '{n} quedadas' },
  catPeople: { ko: '연인원 {n}명', en: '{n} seats filled', es: '{n} asistencias' },
  emptyCats: {
    ko: '아직 끝난 모임이 없어요.',
    en: 'No meetups have wrapped up yet.',
    es: 'Todavía no ha terminado ninguna quedada.',
  },
  catNote: {
    ko: '몇 번 모였는지로 세요. 연인원은 그 모임들에 이름을 올린 사람을 다 더한 수예요.',
    en: 'Ranked by how many meetups happened. “Seats filled” adds up everyone who signed up across them.',
    es: 'Se ordena por cuántas quedadas hubo. «Asistencias» suma a todos los que se apuntaron.',
  },
  countJoin: { ko: '{n}회 참가', en: 'Joined {n}', es: 'Apuntadas {n}' },
  emptyJoin: { ko: '아직 아무도 참가하지 않았어요.', en: 'Nobody has joined anything yet.', es: 'Todavía nadie se ha apuntado a nada.' },
  empty: { ko: '아직 아무도 모임을 열지 않았어요. 첫 주최자가 되어보세요!', en: 'Nobody has hosted yet — be the first!', es: 'Todavía nadie ha organizado nada: ¡sé el primero!' },
  loginNeeded: {
    ko: '카카오 로그인 후 볼 수 있어요.',
    en: 'Log in with Kakao to see the leaderboard.',
    es: 'Entra con Kakao para ver la clasificación.',
  },
  count: { ko: '{n}점', en: '{n} pts', es: '{n} pts' },
  tiersTitle: { ko: '호스트 등급', en: 'Host tiers', es: 'Niveles de anfitrión' },
  tierFrom: { ko: '{n}점부터', en: 'From {n} pts', es: 'Desde {n} pts' },
};

/** 종합 주최 랭킹 — 둘러보기에서 들어온다 */
export default function LeaderboardClient({ initial }: { initial: LeaderboardInitial | null }) {
  const [board, setBoard] = useState<LeaderboardInitial>(
    initial ?? { hosts: [], joiners: [], categories: [], contrib: [] }
  );
  const [tab, setTab] = useState<'hosts' | 'joiners' | 'cats' | 'contrib'>('hosts');
  const t = useT();

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    if (initial) setBoard(initial);
  }, [initial]);

  /* 스티커는 주최 횟수로만 붙는다 — 참가 순위에서는 등급을 보여주지 않는다 */
  const list = tab === 'hosts' ? board.hosts : board.joiners;
  const ranks = ranksOf(list.map((h) => h.count));
  // 카테고리도 같은 규칙으로 등수를 매긴다 — 모임 수가 같으면 같은 등수다
  const catRanks = ranksOf(board.categories.map((c) => c.meetups));
  const contribRanks = ranksOf(board.contrib.map((c) => c.count));

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>
      <p className="hint" style={{ marginTop: -6, marginBottom: 4 }}>{t(T.afterOnly)}</p>

      {!initial ? (
        <p className="hint">{t(T.loginNeeded)}</p>
      ) : (
        <>
          <div className="seg-group" style={{ marginBottom: 14 }}>
            <button className={`seg ${tab === 'hosts' ? 'on' : ''}`} onClick={() => setTab('hosts')}>
              {t(T.tabHosts)}
            </button>
            <button className={`seg ${tab === 'joiners' ? 'on' : ''}`} onClick={() => setTab('joiners')}>
              {t(T.tabJoiners)}
            </button>
            <button className={`seg ${tab === 'cats' ? 'on' : ''}`} onClick={() => setTab('cats')}>
              {t(T.tabCats)}
            </button>
            <button className={`seg ${tab === 'contrib' ? 'on' : ''}`} onClick={() => setTab('contrib')}>
              {t(T.tabContrib)}
            </button>
          </div>

          {tab === 'contrib' ? (
            board.contrib.length === 0 ? (
              <p className="hint">{t(T.emptyContrib)}</p>
            ) : (
              <>
                <p className="hint" style={{ marginTop: -4 }}>{t(T.contribNote)}</p>
                <div className="host-rank board">
                  <ol>
                    {board.contrib.map((c, i) => (
                      <li key={c.id}>
                        <span className="host-rank-no">
                          {['🥇', '🥈', '🥉'][contribRanks[i]! - 1] ?? `${contribRanks[i]}`}
                        </span>
                        <span className="ava">{c.avatar ? <img src={c.avatar} alt="" /> : c.name.slice(0, 1)}</span>
                        <span className="host-rank-name">
                          {c.name}
                          {/* 0인 항목은 안 적는다 — 「후기 0」이 줄줄이 붙으면 읽을 것이 없어진다 */}
                          <span className="host-rank-tier">
                            {t(T.contribParts, { p: c.photos, c: c.comments })}
                            {c.reviews > 0 && t(T.contribReview, { n: c.reviews })}
                            {c.proposals > 0 && t(T.contribProposal, { n: c.proposals })}
                          </span>
                        </span>
                        <span className="host-rank-count">{t(T.count, { n: c.count })}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )
          ) : tab === 'cats' ? (
            board.categories.length === 0 ? (
              <p className="hint">{t(T.emptyCats)}</p>
            ) : (
              <>
                <p className="hint" style={{ marginTop: -4 }}>{t(T.catNote)}</p>
                <div className="host-rank board">
                  <ol>
                    {board.categories.map((c, i) => {
                      const cat = getCategory(c.slug);
                      return (
                        <li key={c.slug}>
                          <span className="host-rank-no">
                            {['🥇', '🥈', '🥉'][catRanks[i]! - 1] ?? `${catRanks[i]}`}
                          </span>
                          {/* 얼굴 자리에 카테고리 색을 둔다 — 목록에서 카드를 알아보는 것이 그 색이다 */}
                          <span
                            className="ava cat-ava"
                            style={cat ? { background: cat.color, color: cat.fg } : undefined}
                          >
                            <CatIcon slug={c.slug} />
                          </span>
                          <span className="host-rank-name">
                            {cat ? t(catDisplayName(c.slug)) : c.slug}
                            <span className="host-rank-tier">{t(T.catPeople, { n: c.people })}</span>
                          </span>
                          <span className="host-rank-count">{t(T.catCount, { n: c.meetups })}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </>
            )
          ) : list.length === 0 ? (
            <p className="hint">{tab === 'hosts' ? t(T.empty) : t(T.emptyJoin)}</p>
          ) : (
            <div className="host-rank board">
              <ol>
                {list.map((h, i) => {
                  // 점수가 같으면 같은 등수 — 메달도 등수를 따라간다 (lib/hosting.ts)
                  const rank = ranks[i]!;
                  // 등급 스티커는 주최에 붙는 훈장이라 참가 순위에서는 달지 않는다
                  const tier = tab === 'hosts' ? hostTier(h.count) : null;
                  return (
                    <li key={h.id}>
                      <span className="host-rank-no">{['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}`}</span>
                      <span className="ava">
                        {h.avatar ? <img src={h.avatar} alt="" /> : h.name.slice(0, 1)}
                        {tier && <span className="host-sticker">{tier.sticker}</span>}
                      </span>
                      <span className="host-rank-name">
                        {h.name}
                        {tier && <span className="host-rank-tier">{t(tier.label)}</span>}
                      </span>
                      <span className="host-rank-count">
                        {/* 호스팅은 점수(.5까지), 참가는 횟수다 */}
                        {tab === 'hosts'
                          ? t(T.count, { n: formatPoints(h.count) })
                          : t(T.countJoin, { n: h.count })}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}

      {/* 다음 스티커까지 얼마나 남았는지 보여야 동기가 된다 — 등급은 주최에만 붙으므로 그 탭에서만 */}
      {tab === 'hosts' && (
        <>
          <h2>{t(T.tiersTitle)}</h2>
          <div className="card">
            <ul className="tier-list">
              {HOST_TIERS.map((tier) => (
                <li key={tier.min}>
                  <span className="tier-sticker">{tier.sticker}</span>
                  <span className="tier-name">{t(tier.label)}</span>
                  <span className="tier-min">{t(T.tierFrom, { n: tier.min })}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
