'use client';

import { useState } from 'react';
import { useT } from '../i18n';
import { CARD_THEMES, type CardTheme } from '@/lib/card-theme';
import { SHOP_T, SHOP_THEMES, THEME_PRICE } from '@/lib/shop';
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
        {SHOP_THEMES.map((key) => {
          const price = THEME_PRICE[key]!;
          const owned = w.owned.includes(key);
          const short = price - w.left;
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
                {owned ? (
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
    </>
  );
}
