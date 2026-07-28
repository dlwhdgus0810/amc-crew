'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { Msg } from '@/lib/i18n';

interface Ticket {
  id: string;
  number: number;
  kind: 'feature' | 'improve' | 'bug' | 'other' | 'cheer';
  title: string;
  body: string | null;
  status: 'open' | 'planned' | 'done' | 'declined';
  adminNote: string | null;
  createdAt: string;
}

const KINDS: { value: Ticket['kind']; label: Msg; hint: Msg }[] = [
  {
    value: 'feature',
    label: { ko: '새 기능', en: 'New feature' },
    hint: { ko: '예: 모임에 사진을 올리고 싶어요', en: 'e.g. let me post photos in a meetup' },
  },
  {
    value: 'improve',
    label: { ko: '개선', en: 'Improvement' },
    hint: { ko: '예: 참가자 이름이 너무 작아요', en: 'e.g. participant names are too small' },
  },
  {
    value: 'bug',
    label: { ko: '오류', en: 'Something broken' },
    hint: { ko: '예: 알림을 눌렀는데 안 열려요', en: 'e.g. tapping the alert does nothing' },
  },
  {
    value: 'other',
    label: { ko: '기타', en: 'Anything else' },
    hint: { ko: '무엇이든 편하게 적어주세요', en: 'Tell us anything' },
  },
  {
    value: 'cheer',
    label: { ko: '응원의 말', en: 'Kind words' },
    hint: { ko: '예: 덕분에 주말이 즐거워요', en: 'e.g. this made my weekend' },
  },
];

const STATUS_LABEL: Record<Ticket['status'], Msg> = {
  open: { ko: '접수됨', en: 'Received' },
  planned: { ko: '반영 예정', en: 'Planned' },
  done: { ko: '반영됨', en: 'Shipped' },
  declined: { ko: '보류', en: 'Not planned' },
};

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  title: { ko: '건의함', en: 'Suggestion box' },
  intro: {
    ko: '사소한 기능 개선부터 원하시는 모든 기능을 넣어드립니다. 적어주시면 티켓이 발급되고, 진행 상황을 여기서 확인할 수 있어요.',
    en: 'From the smallest tweak to a whole new feature — tell us and we’ll build it. You get a ticket, and you can follow its progress right here.',
  },
  loginPrompt: {
    ko: '카카오 로그인 후 건의를 남길 수 있어요.',
    en: 'Log in with Kakao to file a ticket.',
  },
  kakaoLogin: { ko: '카카오 로그인', en: 'Log in with Kakao' },
  kind: { ko: '어떤 건의인가요?', en: 'What kind of ticket?' },
  summary: { ko: '한 줄 요약', en: 'One-line summary' },
  summaryCheer: { ko: '한마디', en: 'Your message' },
  detail: { ko: '자세한 내용 (선택)', en: 'Details (optional)' },
  detailCheer: { ko: '더 하고 싶은 말 (선택)', en: 'More, if you like (optional)' },
  detailPh: {
    ko: '어떤 상황에서 필요한지, 어떻게 동작하면 좋을지 적어주시면 그대로 만들어드릴게요.',
    en: 'When you’d use it and how it should behave — the more you write, the closer we build it.',
  },
  detailCheerPh: {
    ko: '어떤 점이 좋았는지 적어주시면 더 잘 만들 수 있어요.',
    en: 'What worked for you? It helps us know what to keep.',
  },
  submit: { ko: '티켓 발급받기 →', en: 'Get a ticket →' },
  submitCheer: { ko: '응원 보내기 →', en: 'Send it →' },
  submitting: { ko: '발급 중…', en: 'Issuing…' },
  sending: { ko: '보내는 중…', en: 'Sending…' },
  submitFailed: { ko: '발급 실패', en: 'Couldn’t file it' },
  issued: {
    ko: '#{n} 티켓이 발급됐어요! 진행 상황은 알림으로 알려드릴게요.',
    en: 'Ticket #{n} is open — we’ll ping you as it moves.',
  },
  cheered: {
    ko: '고맙습니다! 잘 전달했어요. 덕분에 힘내서 만들게요. 💪',
    en: 'Thank you — it’s been passed along. This is what keeps us building. 💪',
  },
  mine: { ko: '내가 낸 건의', en: 'Your tickets' },
  mineEmpty: { ko: '아직 낸 건의가 없어요.', en: 'No tickets yet.' },
  reply: { ko: '답변: {text}', en: 'Reply: {text}' },
  category: {
    ko: '새 취미 카테고리를 원하시면 → 카테고리 제안',
    en: 'Want a whole new hobby category? → Suggest a category',
  },
  home: { ko: '홈으로 →', en: 'Go home →' },
};

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.78c.51.06 1.03.1 1.56.1 5.52 0 10-3.54 10-7.88C22 6.54 17.52 3 12 3z"
      />
    </svg>
  );
}

export default function TicketsPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<Ticket[]>([]);
  const [kind, setKind] = useState<Ticket['kind']>('feature');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const t = useT();

  async function loadMine() {
    const res = await fetch('/api/tickets?mine=1');
    if (res.ok) setMine((await res.json()).tickets ?? []);
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then(async (auth) => {
        setLoggedIn(Boolean(auth.user));
        if (auth.user) await loadMine();
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.submitFailed));
      setMsg({
        type: 'ok',
        text: kind === 'cheer' ? t(T.cheered) : t(T.issued, { n: String(data.number) }),
      });
      setTitle('');
      setBody('');
      await loadMine();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.submitFailed) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  const activeKind = KINDS.find((k) => k.value === kind);
  const isCheer = kind === 'cheer';

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.intro)}</p>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {!loggedIn ? (
        <div className="card">
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>{t(T.loginPrompt)}</span>
            <a className="kakao-btn" href="/api/auth/login?next=/tickets">
              <KakaoIcon />
              {t(T.kakaoLogin)}
            </a>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t(T.kind)}</h2>
          <div className="seg-group" style={{ flexWrap: 'wrap' }}>
            {KINDS.map((k) => (
              <button key={k.value} className={`seg ${kind === k.value ? 'on' : ''}`} onClick={() => setKind(k.value)}>
                {t(k.label)}
              </button>
            ))}
          </div>

          <h2>{isCheer ? t(T.summaryCheer) : t(T.summary)}</h2>
          <input
            type="text"
            value={title}
            maxLength={80}
            placeholder={activeKind ? t(activeKind.hint) : ''}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !saving && title.trim() && submit()}
          />

          <h2>{isCheer ? t(T.detailCheer) : t(T.detail)}</h2>
          <textarea
            rows={4}
            value={body}
            maxLength={2000}
            placeholder={isCheer ? t(T.detailCheerPh) : t(T.detailPh)}
            onChange={(e) => setBody(e.target.value)}
          />

          <div className="field-row" style={{ marginTop: 20 }}>
            <button className="big-cta" disabled={saving || !title.trim()} onClick={submit}>
              {saving
                ? t(isCheer ? T.sending : T.submitting)
                : t(isCheer ? T.submitCheer : T.submit)}
            </button>
          </div>
        </div>
      )}

      {loggedIn && (
        <>
          <h2>{t(T.mine)}</h2>
          {mine.length === 0 ? (
            <p className="subtitle">{t(T.mineEmpty)}</p>
          ) : (
            mine.map((ticket) => (
              <div key={ticket.id} className="card ticket-row">
                <div className="ticket-head">
                  <span className="ticket-no">#{ticket.number}</span>
                  <span className="ticket-title">{ticket.title}</span>
                  <span className={`ticket-status ${ticket.status}`}>{t(STATUS_LABEL[ticket.status])}</span>
                </div>
                {ticket.body && <p className="ticket-body">{ticket.body}</p>}
                {ticket.adminNote && <p className="ticket-note">{t(T.reply, { text: ticket.adminNote })}</p>}
              </div>
            ))
          )}
        </>
      )}

      <div className="field-row" style={{ marginTop: 40, gap: 20 }}>
        <Link href="/suggest" className="profile-link">
          {t(T.category)}
        </Link>
        <Link href="/" className="profile-link">
          {t(T.home)}
        </Link>
      </div>
    </>
  );
}
