'use client';

import { useEffect, useState } from 'react';
import { hostTier, HOST_TIERS } from '@/lib/hosting';
import { useT } from '../i18n';

interface HostRank {
  id: string;
  name: string;
  avatar: string | null;
  count: number;
}

const T = {
  title: { ko: '리더보드', en: 'Leaderboard' },
  subtitle: {
    ko: '카테고리를 가리지 않고 공개 모임만 세요.',
    en: 'All categories together, public meetups only.',
  },
  tabHosts: { ko: '호스팅 순위', en: 'Hosted' },
  tabJoiners: { ko: '참여 순위', en: 'Joined' },
  countJoin: { ko: '{n}회 참가', en: 'Joined {n}' },
  emptyJoin: { ko: '아직 아무도 참가하지 않았어요.', en: 'Nobody has joined anything yet.' },
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  empty: { ko: '아직 아무도 모임을 열지 않았어요. 첫 주최자가 되어보세요!', en: 'Nobody has hosted yet — be the first!' },
  loginNeeded: {
    ko: '카카오 로그인 후 볼 수 있어요.',
    en: 'Log in with Kakao to see the leaderboard.',
  },
  count: { ko: '{n}회 주최', en: 'Hosted {n}' },
  tiersTitle: { ko: '호스트 등급', en: 'Host tiers' },
  tierFrom: { ko: '{n}회부터', en: 'From {n}' },
};

/** 종합 주최 랭킹 — 둘러보기에서 들어온다 */
export default function LeaderboardPage() {
  const [hosts, setHosts] = useState<HostRank[] | null>(null);
  const [joiners, setJoiners] = useState<HostRank[]>([]);
  const [tab, setTab] = useState<'hosts' | 'joiners'>('hosts');
  const [needLogin, setNeedLogin] = useState(false);
  const t = useT();

  useEffect(() => {
    fetch('/api/hosts')
      .then((r) => {
        if (r.status === 401) {
          setNeedLogin(true);
          return { hosts: [], joiners: [] };
        }
        return r.ok ? r.json() : { hosts: [], joiners: [] };
      })
      .then((d) => {
        setHosts(d.hosts ?? []);
        setJoiners(d.joiners ?? []);
      })
      .catch(() => setHosts([]));
  }, []);

  /* 스티커는 주최 횟수로만 붙는다 — 참가 순위에서는 등급을 보여주지 않는다 */
  const list = tab === 'hosts' ? (hosts ?? []) : joiners;

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      {hosts === null ? (
        <p className="hint">{t(T.loading)}</p>
      ) : needLogin ? (
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
          </div>

          {list.length === 0 ? (
            <p className="hint">{tab === 'hosts' ? t(T.empty) : t(T.emptyJoin)}</p>
          ) : (
            <div className="host-rank board">
              <ol>
                {list.map((h, i) => {
                  // 등급 스티커는 주최에 붙는 훈장이라 참가 순위에서는 달지 않는다
                  const tier = tab === 'hosts' ? hostTier(h.count) : null;
                  return (
                    <li key={h.id}>
                      <span className="host-rank-no">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}`}</span>
                      <span className="ava">
                        {h.avatar ? <img src={h.avatar} alt="" /> : h.name.slice(0, 1)}
                        {tier && <span className="host-sticker">{tier.sticker}</span>}
                      </span>
                      <span className="host-rank-name">
                        {h.name}
                        {tier && <span className="host-rank-tier">{t(tier.label)}</span>}
                      </span>
                      <span className="host-rank-count">
                        {tab === 'hosts' ? t(T.count, { n: h.count }) : t(T.countJoin, { n: h.count })}
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
