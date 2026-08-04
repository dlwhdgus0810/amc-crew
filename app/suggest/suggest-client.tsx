'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useRefreshSession, useViewer } from '../session';
import type { Msg } from '@/lib/i18n';

interface CategoryRequest {
  id: string;
  userId: string;
  userName: string;
  name: string;
  color: string;
  description: string;
  featureRequest: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
}

/** 기존 카테고리와 잘 어울리는 추천 색 */
const PRESET_COLORS = [
  '#E8380D', '#008542', '#E9A300', '#002FA7', '#5B2A86',
  '#C2185B', '#00838F', '#5D4037', '#37474F', '#7CB342',
];

const STATUS_LABEL: Record<CategoryRequest['status'], Msg> = {
  pending: { ko: '검토 중', en: 'In review' },
  approved: { ko: '승인됨', en: 'Approved' },
  rejected: { ko: '반려됨', en: 'Declined' },
};

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  title: { ko: '카테고리 제안', en: 'Suggest a category' },
  loginPrompt: {
    ko: '카카오 로그인 후 새 취미 카테고리를 제안할 수 있어요.',
    en: 'Log in with Kakao to suggest a new hobby category.',
  },
  kakaoLogin: { ko: '카카오 로그인', en: 'Log in with Kakao' },
  intro: {
    ko: '하고 싶은 취미가 목록에 없나요? 이름·색·부제목을 정해서 제안해주세요. 검토 후 추가해드릴게요.',
    en: 'Missing a hobby? Pick a name, colour and subtitle — we’ll review and add it.',
  },
  name: { ko: '이름', en: 'Name' },
  namePh: { ko: '예: 등산', en: 'e.g. Hiking' },
  subtitle: { ko: '부제목', en: 'Subtitle' },
  subtitlePh: { ko: '예: 같이 오를 사람 모집', en: 'e.g. Find people to hike with' },
  color: { ko: '색상', en: 'Colour' },
  customColor: { ko: '직접 고르기', en: 'Custom' },
  preview: { ko: '미리보기', en: 'Preview' },
  previewName: { ko: '새 카테고리', en: 'New category' },
  namePlaceholderCard: { ko: '이름', en: 'Name' },
  descPlaceholderCard: { ko: '부제목이 여기에 보여요', en: 'Your subtitle shows here' },
  feature: { ko: '원하는 기능 (선택)', en: 'Feature request (optional)' },
  featureDesc: {
    ko: '부제목과 별개로, 이 카테고리에 있으면 좋을 기능을 적어주세요. 예를 들어 무비나잇에는 영화를 검색하면 평점·감독·배우를 자동으로 가져오는 기능이 붙어 있어요.',
    en: 'Separate from the subtitle — tell us what this category should be able to do. Movie Night, for example, pulls ratings, director and cast when you search a title.',
  },
  featurePh: {
    ko: '예: 등산 코스를 검색하면 거리와 고도를 가져왔으면 좋겠어요',
    en: 'e.g. searching a trail should pull in distance and elevation',
  },
  submit: { ko: '제안 보내기 →', en: 'Send suggestion →' },
  submitting: { ko: '보내는 중…', en: 'Sending…' },
  submitFailed: { ko: '제출 실패', en: 'Couldn’t submit' },
  submitted: {
    ko: '제안을 보냈어요! 검토 후 알림으로 알려드릴게요.',
    en: 'Suggestion sent — we’ll let you know once it’s reviewed.',
  },
  mine: { ko: '내가 보낸 제안', en: 'Your suggestions' },
  mineEmpty: { ko: '아직 보낸 제안이 없어요.', en: 'No suggestions yet.' },
  featureLabel: { ko: '원하는 기능: {text}', en: 'Feature request: {text}' },
  reply: { ko: '답변: {text}', en: 'Reply: {text}' },
  home: { ko: '홈으로 →', en: 'Go home →' },
};

/** 배경색 위에 올릴 글자색 — YIQ 밝기 기준(128)으로 결정 */
function foregroundOf(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#101010' : '#F6F4EE';
}

/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx) */
export interface SuggestInitial {
  requests: CategoryRequest[];
}

export default function SuggestPage({ initial }: { initial: SuggestInitial }) {
  // 로그인 여부는 레이아웃이 서버에서 읽어 둔 것 — 물어보고 기다릴 필요가 없다
  const loggedIn = Boolean(useViewer().user);
  const refresh = useRefreshSession();
  const [requests, setRequests] = useState<CategoryRequest[]>(initial.requests);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const t = useT();

  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState('');
  const [feature, setFeature] = useState('');

  /** 목록은 서버가 읽어 준다 — 새로 내면 서버 렌더를 다시 돌린다 */
  function load() {
    refresh();
  }

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    setRequests(initial.requests);
  }, [initial]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/category-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, description, featureRequest: feature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.submitFailed));
      setMsg({ type: 'ok', text: t(T.submitted) });
      setName('');
      setDescription('');
      setFeature('');
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.submitFailed) });
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn) {
    return (
      <>
        <h1>{t(T.title)}</h1>
        <p className="subtitle">{t(T.loginPrompt)}</p>
        <a className="kakao-btn" href="/api/auth/login?next=/suggest">
          {t(T.kakaoLogin)}
        </a>
      </>
    );
  }

  const fg = foregroundOf(color);

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">
        {t(T.intro)}
      </p>

      <div className="card">
        <div className="suggest-grid">
          <div>
            <div className="field-label">{t(T.name)}</div>
            <input
              type="text"
              placeholder={t(T.namePh)}
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: 22 }}
            />

            <div className="field-label">{t(T.subtitle)}</div>
            <input
              type="text"
              placeholder={t(T.subtitlePh)}
              value={description}
              maxLength={50}
              onChange={(e) => setDescription(e.target.value)}
              style={{ marginBottom: 22 }}
            />

            <div className="field-label">{t(T.color)}</div>
            <div className="swatches">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${color.toLowerCase() === c.toLowerCase() ? 'on' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setColor(c)}
                />
              ))}
              <label className="swatch-custom">
                {t(T.customColor)}
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>
          </div>

          {/* 홈 카드와 같은 모양의 미리보기 */}
          <div>
            <div className="field-label">{t(T.preview)}</div>
            <div className="suggest-preview" style={{ background: color, color: fg }}>
              <span className="car-idx">{(name || t(T.previewName)).toUpperCase()}</span>
              <div>
                <div className="car-name" style={{ fontSize: 34 }}>{name || t(T.namePlaceholderCard)}</div>
                <div className="car-desc">{description || t(T.descPlaceholderCard)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div className="field-label">{t(T.feature)}</div>
          <p className="subtitle" style={{ fontSize: 13.5, margin: '0 0 10px' }}>
            {t(T.featureDesc)}
          </p>
          <textarea
            rows={4}
            placeholder={t(T.featurePh)}
            value={feature}
            maxLength={1000}
            onChange={(e) => setFeature(e.target.value)}
          />
        </div>

        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

        <div style={{ marginTop: 20 }}>
          <button disabled={busy || !name.trim() || !description.trim()} onClick={submit}>
            {busy ? t(T.submitting) : t(T.submit)}
          </button>
        </div>
      </div>

      <h2>{t(T.mine)}</h2>
      {requests.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-dim)' }}>{t(T.mineEmpty)}</div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="card">
            <div className="field-row" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
                <span className="feed-dot" style={{ background: r.color }} />
                {r.name}
                <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>{r.description}</span>
              </span>
              <span className={`req-status ${r.status}`}>{t(STATUS_LABEL[r.status])}</span>
            </div>
            {r.featureRequest && (
              <div style={{ marginTop: 10, color: 'var(--text-dim)', fontSize: 14 }}>
                {t(T.featureLabel, { text: r.featureRequest })}
              </div>
            )}
            {r.adminNote && (
              <div style={{ marginTop: 10, fontSize: 14 }}>{t(T.reply, { text: r.adminNote })}</div>
            )}
          </div>
        ))
      )}

      <div style={{ marginTop: 40 }}>
        <Link href="/" className="profile-link">{t(T.home)}</Link>
      </div>
    </>
  );
}
