'use client';

import { useT } from './i18n';
import type { Msg } from '@/lib/i18n';

/**
 * 들어오기 전에 한 번 읽히는 약속.
 *
 * 독서나눔처럼 「빠지면 안 되는」 모임이 있다. 그런 곳은 참가가 가벼우면 곤란해서,
 * 신청·참가 버튼을 누르면 이 창이 먼저 뜨고 확인을 눌러야 실제로 들어간다.
 * 나가는 쪽(취소)에는 띄우지 않는다 — 붙잡는 것처럼 보인다.
 *
 * 두 화면(카테고리 목록, 모임 상세)이 같이 쓴다. 같은 말을 두 곳에 따로 두면
 * 한쪽만 고쳐지고, 그건 눈에 잘 안 띈다.
 *
 * 문구는 카테고리 설정(lib/categories.ts의 signup.terms)에서 온다.
 */

const T = {
  title: { ko: '들어가기 전에 약속 하나만', en: 'One promise before you join' },
  ok: { ko: '확인했어요', en: 'Got it' },
  later: { ko: '다음에요', en: 'Not now' },
};

export default function TermsPopup({
  terms,
  tag,
  okLabel,
  busy,
  onConfirm,
  onClose,
}: {
  terms: Msg[];
  /** 창 위의 작은 딱지 — 무엇을 하려던 참인지 (참가신청 / 참가하기) */
  tag: string;
  /** 확인 버튼의 말 — 화면마다 하려는 일이 달라서 밖에서 정한다 */
  okLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useT();
  if (terms.length === 0) return null;

  return (
    // 공지 팝업과 같은 모양을 쓴다 — 한 앱에서 알림창이 두 가지로 보이면 안 된다
    <div className="notice-pop" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div className="notice-box">
        <span className="notice-tag">{tag}</span>
        <h2 id="terms-title" className="notice-title">
          {t(T.title)}
        </h2>
        <ul className="signup-terms">
          {terms.map((line, i) => (
            <li key={i}>{t(line)}</li>
          ))}
        </ul>
        <button className="notice-ok" disabled={busy} onClick={onConfirm}>
          {okLabel ?? t(T.ok)}
        </button>
        <button className="secondary" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>
          {t(T.later)}
        </button>
      </div>
    </div>
  );
}
