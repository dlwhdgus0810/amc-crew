'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import LoginButtons, { useLoginMsg } from '../login-buttons';
import { useRefreshSession, useViewer } from '../session';
import type { Msg } from '@/lib/i18n';

interface Ticket {
  id: string;
  number: number;
  /* theme은 상점에서만 들어온다 — 아래 KINDS(고르는 칸)에는 없다 */
  kind: 'feature' | 'improve' | 'bug' | 'other' | 'cheer' | 'theme';
  title: string;
  body: string | null;
  status: 'open' | 'planned' | 'done' | 'declined';
  adminNote: string | null;
  createdAt: string;
}

const KINDS: { value: Ticket['kind']; label: Msg; hint: Msg }[] = [
  {
    value: 'feature',
    label: { ko: '새 기능', en: 'New feature', es: 'Función nueva' },
    hint: { ko: '예: 모임에 사진을 올리고 싶어요', en: 'e.g. let me post photos in a meetup', es: 'p. ej. poder subir fotos a una quedada' },
  },
  {
    value: 'improve',
    label: { ko: '개선', en: 'Improvement', es: 'Mejora' },
    hint: { ko: '예: 참가자 이름이 너무 작아요', en: 'e.g. participant names are too small', es: 'p. ej. los nombres se ven muy pequeños' },
  },
  {
    value: 'bug',
    label: { ko: '오류', en: 'Something broken', es: 'Algo roto' },
    hint: { ko: '예: 알림을 눌렀는데 안 열려요', en: 'e.g. tapping the alert does nothing', es: 'p. ej. al tocar el aviso no pasa nada' },
  },
  {
    value: 'other',
    label: { ko: '기타', en: 'Anything else', es: 'Otra cosa' },
    hint: { ko: '무엇이든 편하게 적어주세요', en: 'Tell us anything', es: 'Cuéntanos lo que sea' },
  },
  {
    // 값은 'cheer' 그대로 둔다 — 이미 쌓인 행이 있고, 이름만 바뀐 것이라 옮길 이유가 없다
    value: 'cheer',
    label: { ko: '쪽지', en: 'Note', es: 'Recado' },
    hint: { ko: '아무거나 적어도 돼요', en: 'Anything at all', es: 'Lo que quieras' },
  },
];

const STATUS_LABEL: Record<Ticket['status'], Msg> = {
  open: { ko: '접수됨', en: 'Received', es: 'Recibida' },
  planned: { ko: '반영 예정', en: 'Planned', es: 'Prevista' },
  done: { ko: '반영됨', en: 'Shipped', es: 'Hecha' },
  declined: { ko: '보류', en: 'Not planned', es: 'Aparcada' },
};

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…', es: 'Cargando…' },
  title: { ko: '건의함', en: 'Suggestion box', es: 'Buzón de sugerencias' },
  intro: {
    ko: '사소한 기능 개선부터 원하시는 모든 기능을 넣어드립니다. 적어주시면 티켓이 발급되고, 진행 상황을 여기서 확인할 수 있어요.',
    en: 'From the smallest tweak to a whole new feature — tell us and we’ll build it. You get a ticket, and you can follow its progress right here.',
    es: 'Desde el detalle más pequeño hasta una función entera: dilo y lo hacemos. Recibes un número y puedes seguirlo aquí mismo.',
  },
  loginPrompt: {
    ko: '카카오 로그인 후 건의를 남길 수 있어요.',
    en: 'Log in with Kakao to file a ticket.',
    es: 'Entra con Kakao para enviar una sugerencia.',
  },
  /* 로그인 문이 둘인 도메인(펜)용 — 어느 문인지 안 적는다 */
  loginPromptAny: {
    ko: '로그인 후 건의를 남길 수 있어요.',
    en: 'Log in to file a ticket.',
    es: 'Inicia sesión para enviar una sugerencia.',
  },
  kind: { ko: '어떤 건의인가요?', en: 'What kind of ticket?', es: '¿De qué tipo?' },
  summary: { ko: '한 줄 요약', en: 'One-line summary', es: 'Resumen en una línea' },
  summaryCheer: { ko: '쪽지', en: 'Your note', es: 'Tu recado' },
  detail: { ko: '자세한 내용 (선택)', en: 'Details (optional)', es: 'Detalles (opcional)' },
  detailCheer: { ko: '더 하고 싶은 말 (선택)', en: 'More, if you like (optional)', es: 'Algo más, si quieres (opcional)' },
  detailPh: {
    ko: '어떤 상황에서 필요한지, 어떻게 동작하면 좋을지 적어주시면 그대로 만들어드릴게요.',
    en: 'When you’d use it and how it should behave — the more you write, the closer we build it.',
    es: 'Cuándo lo usarías y cómo debería funcionar: cuanto más cuentes, más se parecerá a lo que quieres.',
  },
  detailCheerPh: {
    ko: '아무거나 적어도 돼요. 하고 싶은 말, 좋았던 점, 그냥 안부도요.',
    en: 'Anything at all — a thought, something you liked, or just hello.',
    es: 'Lo que sea: una idea, algo que te gustó, o solo un saludo.',
  },
  submit: { ko: '티켓 발급받기 →', en: 'Get a ticket →', es: 'Enviar sugerencia →' },
  submitCheer: { ko: '쪽지 보내기 →', en: 'Send the note →', es: 'Enviar el recado →' },
  submitting: { ko: '발급 중…', en: 'Issuing…', es: 'Registrando…' },
  sending: { ko: '보내는 중…', en: 'Sending…', es: 'Enviando…' },
  submitFailed: { ko: '발급 실패', en: 'Couldn’t file it', es: 'No se pudo registrar' },
  issued: {
    ko: '#{n} 티켓이 발급됐어요! 진행 상황은 알림으로 알려드릴게요.',
    en: 'Ticket #{n} is open — we’ll ping you as it moves.',
    es: 'Sugerencia n.º {n} registrada: te avisamos cuando avance.',
  },
  cheered: {
    ko: '쪽지 잘 전달했어요. 고맙습니다! 💌',
    en: 'Your note has been passed along — thank you! 💌',
    es: 'Tu recado ha llegado. ¡Gracias! 💌',
  },
  mine: { ko: '내가 낸 건의', en: 'Your tickets', es: 'Tus sugerencias' },
  mineEmpty: { ko: '아직 낸 건의가 없어요.', en: 'No tickets yet.', es: 'Aún no has enviado ninguna.' },
  reply: { ko: '답변: {text}', en: 'Reply: {text}', es: 'Respuesta: {text}' },
  category: {
    ko: '새 취미 카테고리를 원하시면 → 카테고리 제안',
    en: 'Want a whole new hobby category? → Suggest a category',
    es: '¿Quieres una categoría nueva? → Proponer una categoría',
  },
  home: { ko: '홈으로 →', en: 'Go home →', es: 'Ir al inicio →' },
};

/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx) */
export interface TicketsInitial {
  mine: Ticket[];
}

export default function TicketsPage({ initial }: { initial: TicketsInitial }) {
  // 로그인 여부는 레이아웃이 서버에서 읽어 둔 것 — 물어보고 기다릴 필요가 없다
  const loggedIn = Boolean(useViewer().user);
  const refresh = useRefreshSession();
  const [mine, setMine] = useState<Ticket[]>(initial.mine);
  const [kind, setKind] = useState<Ticket['kind']>('feature');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const loginMsg = useLoginMsg();
  const t = useT();

  /** 목록은 서버가 읽어 준다 — 새로 내면 서버 렌더를 다시 돌린다 */
  function loadMine() {
    refresh();
  }

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    setMine(initial.mine);
  }, [initial]);

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
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>
              {t(loginMsg(T.loginPrompt, T.loginPromptAny))}
            </span>
            <LoginButtons next="/tickets" />
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
