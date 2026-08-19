'use client';

import { useState } from 'react';
import { useT } from '../i18n';
import { CARD_THEMES, PREVIEW_COOKIE, PREVIEW_MAX_AGE, type CardTheme } from '@/lib/card-theme';
import { SHOP_T, SHOP_THEMES, SOON_THEMES, THEME_PRICE } from '@/lib/shop';
import type { Wallet } from '@/lib/db/shop';

/**
 * 상점 화면.
 *
 * 지갑은 서버가 계산해 내려 준다(app/shop/page.tsx). 산 뒤에는 서버가 준 새 지갑으로
 * 갈아 끼운다 — 여기서 빼기를 하면 화면의 잔액과 실제가 갈릴 수 있다.
 */
export default function ShopClient({ wallet }: { wallet: Wallet }) {
  const t = useT();
  const [w, setW] = useState(wallet);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  /** 지금 미리보고 있는 테마 — null이면 창이 닫혀 있다 */
  const [preview, setPreview] = useState<CardTheme | null>(null);

  /*
   * 미리보기는 진짜 홈 화면을 iframe으로 띄운다 (app/preview/page.tsx).
   *
   * 어느 테마로 보일지는 쿠키로 넘긴다 — iframe 주소에 실으면 레이아웃이 못 읽는다
   * (레이아웃은 쿼리를 안 받는다). 쿠키 경로가 /preview라서 이 창 안에서만 먹고,
   * 상점을 포함한 나머지 화면은 원래 테마 그대로다.
   */
  function openPreview(theme: CardTheme) {
    document.cookie = `${PREVIEW_COOKIE}=${theme}; path=/preview; max-age=${PREVIEW_MAX_AGE}; samesite=lax`;
    setPreview(theme);
  }
  function closePreview() {
    // 창을 닫을 때 쿠키도 지운다 — 남겨 둘 이유가 없다
    document.cookie = `${PREVIEW_COOKIE}=; path=/preview; max-age=0`;
    setPreview(null);
  }

  async function buy(theme: CardTheme) {
    setBusy(theme);
    setMsg(null);
    try {
      const res = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? t(SHOP_T.failed) });
        return;
      }
      setW(data.wallet);
      setMsg({ type: 'ok', text: t(SHOP_T.bought) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1>{t(SHOP_T.title)}</h1>
      <p className="subtitle">{t(SHOP_T.intro)}</p>

      {/* 잔액과 그 출처를 같이 적는다 — 숫자만 있으면 어디서 나온 값인지 알 수 없다 */}
      <div className="card coin-card">
        <span className="coin-label">{t(SHOP_T.balance)}</span>
        <strong className="coin-amount">{w.left}</strong>
        <span className="coin-from">
          {t(SHOP_T.breakdown, { host: Math.floor(w.host), contrib: w.contrib, join: w.join })}
          {w.spent > 0 && ` · ${t(SHOP_T.spent, { n: w.spent })}`}
        </span>
      </div>

      {msg && <div className={`msg ${msg.type === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <ul className="shop-list">
        {[...SHOP_THEMES, ...SOON_THEMES].map((key) => {
          const price = THEME_PRICE[key];
          const owned = w.owned.includes(key);
          const short = price == null ? 0 : price - w.left;
          return (
            <li key={key} className="card shop-item">
              <span className="shop-body">
                <strong>{t(CARD_THEMES[key].label)}</strong>
                <span className="hint">{t(CARD_THEMES[key].note)}</span>
              </span>
              {/* 고르기 전에 어떤 색인지 — 관리자 화면의 견본과 같은 방식이다 */}
              <span className="theme-swatches" aria-hidden>
                {(CARD_THEMES[key].stops ?? []).map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="shop-buy">
                {/* 값이 없으면 아직 안 파는 것 — 미리보기만 열어 준다 */}
                <button className="link-btn" onClick={() => openPreview(key)}>
                  {t(SHOP_T.preview)}
                </button>
                {price == null ? (
                  <span className="shop-soon">{t(SHOP_T.soon)}</span>
                ) : owned ? (
                  <span className="shop-owned">{t(SHOP_T.owned)}</span>
                ) : (
                  <>
                    <span className="shop-price">{t(SHOP_T.price, { n: price })}</span>
                    <button disabled={busy !== null || short > 0} onClick={() => void buy(key)}>
                      {busy === key ? t(SHOP_T.buying) : t(SHOP_T.buy)}
                    </button>
                    {short > 0 && <span className="hint">{t(SHOP_T.short, { n: short })}</span>}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/*
        * 미리보기 창 — 안에 든 것은 진짜 홈 화면이다 (app/preview/page.tsx).
        * 폭을 폰만큼 잡아 둔다: 이 앱은 홈 화면에 깔려 폰에서 열리는 것이 기준이라,
        * 넓은 창에 늘려 보여 주면 실제로 보게 될 모습과 다르다.
        */}
      {preview && (
        <div className="preview-wrap" role="dialog" aria-modal="true">
          <div className="preview-head">
            <strong>{t(SHOP_T.previewOf, { name: t(CARD_THEMES[preview].label) })}</strong>
            <button className="secondary" onClick={closePreview}>
              {t(SHOP_T.close)}
            </button>
          </div>
          <iframe
            className="preview-frame"
            src={`/preview?t=${preview}`}
            title={t(SHOP_T.previewOf, { name: t(CARD_THEMES[preview].label) })}
          />
        </div>
      )}
    </>
  );
}
