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
    ko: '모임을 많이 연 사람들이에요. 카테고리를 가리지 않고 공개 모임만 세요.',
    en: 'Whoever hosts the most meetups — all categories together, public ones only.',
  },
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
  const [needLogin, setNeedLogin] = useState(false);
  const t = useT();

  useEffect(() => {
    fetch('/api/hosts')
      .then((r) => {
        if (r.status === 401) {
          setNeedLogin(true);
          return { hosts: [] };
        }
        return r.ok ? r.json() : { hosts: [] };
      })
      .then((d) => setHosts(d.hosts ?? []))
      .catch(() => setHosts([]));
  }, []);

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      {hosts === null ? (
        <p className="hint">{t(T.loading)}</p>
      ) : needLogin ? (
        <p className="hint">{t(T.loginNeeded)}</p>
      ) : hosts.length === 0 ? (
        <p className="hint">{t(T.empty)}</p>
      ) : (
        <div className="host-rank board">
          <ol>
            {hosts.map((h, i) => {
              const tier = hostTier(h.count);
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
                  <span className="host-rank-count">{t(T.count, { n: h.count })}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* 다음 스티커까지 얼마나 남았는지 보여야 동기가 된다 */}
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
  );
}
