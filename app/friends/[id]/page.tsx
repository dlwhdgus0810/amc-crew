'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { catDisplayName, getCategory } from '@/lib/categories';
import { dateLabel, timeLabel } from '@/lib/datefmt';
import { useLocale, useT } from '../../i18n';

/**
 * 친구 한 명 — 그 사람이 가는 모임과, 내가 그 사람에게 보여줄 범위.
 *
 * 한 화면에 방향이 둘 섞여 있어서 제목으로 갈라 둔다.
 *  - 위쪽 모임 목록: 그 친구가 나에게 보여주기로 한 것
 *  - 아래쪽 설정   : 내가 그 친구에게 보여줄 것
 */

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  notFound: { ko: '친구를 찾을 수 없어요.', en: 'Friend not found.' },
  back: { ko: '← 친구', en: '← Friends' },

  upcoming: { ko: '예정된 모임', en: 'Upcoming' },
  past: { ko: '지난 모임', en: 'Past' },
  none: { ko: '예정된 모임이 없어요.', en: 'No upcoming meetups.' },
  nonePast: { ko: '지난 모임이 없어요.', en: 'No past meetups.' },
  hidden: {
    ko: '{name}님이 모임을 보여주지 않기로 했어요.',
    en: '{name} chose not to show their meetups.',
  },
  hiddenPast: {
    ko: '{name}님은 예정된 모임만 보여주고 있어요.',
    en: '{name} only shows upcoming meetups.',
  },
  together: { ko: '같이 감', en: 'Together' },
  online: { ko: '접속 중', en: 'Online' },

  settings: { ko: '{name}님에게 보여줄 것', en: 'What {name} sees' },
  settingsHint: {
    ko: '내 쪽만 바뀌어요. 감춰도 상대에게는 알리지 않고, 상대가 나에게 보여주는 건 그대로예요.',
    en: 'Only your side changes. They aren’t told, and what they show you stays as it is.',
  },
  presence: { ko: '내 접속 상태', en: 'When I’m online' },
  presenceOn: { ko: '보임', en: 'Visible' },
  presenceOff: { ko: '숨김', en: 'Hidden' },
  meetups: { ko: '내 모임', en: 'My meetups' },
  scopeAll: { ko: '전부', en: 'All' },
  scopeUpcoming: { ko: '예정만', en: 'Upcoming only' },
  scopeNone: { ko: '숨김', en: 'Hidden' },
  privateNote: {
    ko: '비공개 모임은 어느 경우에도 보이지 않아요.',
    en: 'Private meetups never show, whichever you pick.',
  },
  failed: { ko: '바꾸지 못했어요. 잠시 후 다시 시도해주세요.', en: 'Couldn’t change that. Try again shortly.' },
};

type Scope = 'all' | 'upcoming' | 'none';

interface Meetup {
  id: string;
  category: string;
  title: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  location: string;
  together: boolean;
}

interface Data {
  friend: { id: string; name: string; avatar: string | null; showsPresence: boolean; showsMeetups: Scope; online: boolean };
  scope: Scope;
  upcoming: Meetup[];
  past: Meetup[];
}

export default function FriendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const locale = useLocale();

  const load = useCallback(async () => {
    const res = await fetch(`/api/friends/${id}/meetups`, { cache: 'no-store' });
    if (!res.ok) {
      setMissing(true);
      return;
    }
    setData(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(patch: { showPresence?: boolean; meetupScope?: Scope }) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/friends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setError(t(T.failed));
    await load();
    setBusy(false);
  }

  if (missing) {
    return (
      <>
        <p className="subtitle">
          <Link href="/friends">{t(T.back)}</Link>
        </p>
        <div className="card">{t(T.notFound)}</div>
      </>
    );
  }
  if (!data) return <p className="subtitle">{t(T.loading)}</p>;

  const { friend } = data;

  const row = (m: Meetup) => {
    const cat = getCategory(m.category);
    return (
      <li key={m.id}>
        <Link href={`/p/${m.id}`} className="fm-row">
          <span className="fm-dot" style={{ background: cat?.color ?? 'var(--border)' }} aria-hidden="true" />
          <span className="fm-body">
            <span className="fm-when">
              {dateLabel(m.date, locale)} {timeLabel(m.startTime, locale)}
            </span>
            <span className="fm-what">
              {t(catDisplayName(m.category))}
              {m.title ? ` 〈${m.title}〉` : ''} · {m.location}
            </span>
          </span>
          {m.together && <span className="fm-together">{t(T.together)}</span>}
        </Link>
      </li>
    );
  };

  return (
    <>
      <p className="subtitle">
        <Link href="/friends">{t(T.back)}</Link>
      </p>

      <div className="fm-head">
        <span className="avatar-lg">{friend.avatar ? <img src={friend.avatar} alt="" /> : friend.name.slice(0, 1)}</span>
        <h1>{friend.name}</h1>
        {friend.online && (
          <span className="fm-online">
            <span className="online-dot" aria-hidden="true" />
            {t(T.online)}
          </span>
        )}
      </div>

      {error && <div className="msg err">{error}</div>}

      {data.scope === 'none' ? (
        <div className="card">
          <p className="hint">{t(T.hidden, { name: friend.name })}</p>
        </div>
      ) : (
        <>
          <h2>
            {t(T.upcoming)} {data.upcoming.length > 0 ? data.upcoming.length : ''}
          </h2>
          <div className="card">
            {data.upcoming.length === 0 ? (
              <p className="hint">{t(T.none)}</p>
            ) : (
              <ul className="fm-list">{data.upcoming.map(row)}</ul>
            )}
          </div>

          <h2>
            {t(T.past)} {data.past.length > 0 ? data.past.length : ''}
          </h2>
          <div className="card">
            {data.scope === 'upcoming' ? (
              <p className="hint">{t(T.hiddenPast, { name: friend.name })}</p>
            ) : data.past.length === 0 ? (
              <p className="hint">{t(T.nonePast)}</p>
            ) : (
              <ul className="fm-list">{data.past.map(row)}</ul>
            )}
          </div>
        </>
      )}

      {/* 여기서부터는 방향이 반대다 — 내가 이 친구에게 보여줄 것 */}
      <h2>{t(T.settings, { name: friend.name })}</h2>
      <div className="card">
        <p className="hint" style={{ marginBottom: 14 }}>
          {t(T.settingsHint)}
        </p>

        <div className="field-label">{t(T.presence)}</div>
        <div className="seg-group">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              className={`seg ${friend.showsPresence === v ? 'on' : ''}`}
              disabled={busy}
              onClick={() => save({ showPresence: v })}
            >
              {v ? t(T.presenceOn) : t(T.presenceOff)}
            </button>
          ))}
        </div>

        <div className="field-label" style={{ marginTop: 16 }}>
          {t(T.meetups)}
        </div>
        <div className="seg-group">
          {(['all', 'upcoming', 'none'] as Scope[]).map((s) => (
            <button
              key={s}
              className={`seg ${friend.showsMeetups === s ? 'on' : ''}`}
              disabled={busy}
              onClick={() => save({ meetupScope: s })}
            >
              {s === 'all' ? t(T.scopeAll) : s === 'upcoming' ? t(T.scopeUpcoming) : t(T.scopeNone)}
            </button>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          {t(T.privateNote)}
        </p>
      </div>
    </>
  );
}
