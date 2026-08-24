'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useT } from '../i18n';
import { CARD_THEMES, PREVIEW_COOKIE, PREVIEW_MAX_AGE, type CardTheme } from '@/lib/card-theme';
import { COIN, PLANNED, SHOP_T, SHOP_THEMES, SOON_THEMES, THEME_PRICE } from '@/lib/shop';
import type { Wallet } from '@/lib/db/shop';

/**
 * 상점 화면.
 *
 * 지갑은 서버가 계산해 내려 준다(app/shop/page.tsx). 산 뒤에는 서버가 준 새 지갑으로
 * 갈아 끼운다 — 여기서 빼기를 하면 화면의 잔액과 실제가 갈릴 수 있다.
 */
/**
 * 미리보기 안쪽 화면의 크기. 폰 폭에 헤더·첫 줄·카드 셋·탭바가 들어가는 높이다 —
 * 이 값으로 그린 뒤 창에 맞게 줄인다.
 */
/* 권유 문구가 가리킬 값 — 지금 파는 것 중 제일 싼 것 */
const CHEAPEST = Math.min(...Object.values(THEME_PRICE).filter((n): n is number => n != null));

const PREVIEW_W = 390;
const PREVIEW_H = 1080;

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
  /*
   * 미리보기는 **줄여서 전부 보여 준다.**
   *
   * 폰 폭(390)에 헤더·첫 줄·카드 셋·탭바를 세우면 1080px쯤 된다. 창은 그보다 짧으니
   * 그냥 넣으면 마지막 카드가 탭바에 잘린다 — 세 장을 나란히 보라고 고른 것인데
   * 하나가 반만 보이면 고른 뜻이 없다.
   *
   * 손가락을 안 받는 그림이라(pointer-events: none) 줄여도 잃는 것이 없다. 스크롤로
   * 풀 수도 있지만 그러면 눌러서 나갈 수 있게 되고, 무엇보다 「한눈에」가 아니게 된다.
   */
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!preview) return;
    const fit = () => {
      const box = boxRef.current;
      if (!box) return;
      setScale(Math.min(1, box.clientHeight / PREVIEW_H, box.clientWidth / PREVIEW_W));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [preview]);

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
          {w.avatar && ` + ${t(SHOP_T.fromAvatar, { n: COIN.avatar })}`}
          {w.push && ` + ${t(SHOP_T.fromPush, { n: COIN.push })}`}
          {w.news && ` + ${t(SHOP_T.fromNews, { n: COIN.news })}`}
          {w.reviewed > 0 &&
            ` + ${t(SHOP_T.fromReviewed, { n: Math.floor(w.reviewed * COIN.reviewedAll) })}`}
          {w.apology && ` + ${t(SHOP_T.fromApology, { n: COIN.apology })}`}
          {w.spent > 0 && ` · ${t(SHOP_T.spent, { n: w.spent })}`}
        </span>
      </div>

      {/*
        * 사진이 없으면 권유, 잠겼으면 푸는 법.
        *
        * 달란트가 걸려 있다는 것을 아는 자리가 여기뿐이다 — 프로필에는 사진 칸만 있고
        * 거기에 값이 붙어 있다는 말이 없다.
        */}
      {!w.avatar &&
        (w.left < 0 ? (
          <div className="msg err">
            <strong>{t(SHOP_T.lockedTitle)}</strong>
            <br />
            {t(SHOP_T.lockedBody, { n: -w.left })}
          </div>
        ) : (
          <Link href="/profile" className="card coin-nudge">
            <strong>{t(SHOP_T.avatarNudge, { n: COIN.avatar })}</strong>
            <span className="hint">
              {/* 사진을 올린 뒤에 남는 거리 — 지금 잔액이 아니라 그때의 잔액으로 센다 */}
              {CHEAPEST - (w.left + COIN.avatar) > 0
                ? t(SHOP_T.avatarNudgeMore, {
                    n: CHEAPEST - (w.left + COIN.avatar),
                    price: CHEAPEST,
                    avatar: COIN.avatar,
                  })
                : t(SHOP_T.avatarNudgeEnough, { n: COIN.avatar })}
            </span>
            <span className="coin-nudge-go">{t(SHOP_T.avatarGo)}</span>
          </Link>
        ))}

      {/*
        * 알림·새 소식도 같은 자리에서 권한다. 사진과 달리 잠김 안내는 안 붙인다 —
        * 잠겼다는 말은 한 번만 뜨면 되고, 위 칸이 이미 그 말을 하고 있다.
        */}
      {w.left >= 0 && !w.push && (
        <Link href="/profile" className="card coin-nudge">
          <strong>{t(SHOP_T.offPush, { n: COIN.push })}</strong>
          <span className="hint">{t(SHOP_T.offAgain, { n: COIN.push })}</span>
          <span className="coin-nudge-go">{t(SHOP_T.avatarGo)}</span>
        </Link>
      )}
      {w.left >= 0 && !w.news && (
        <Link href="/profile" className="card coin-nudge">
          <strong>{t(SHOP_T.offNews, { n: COIN.news })}</strong>
          <span className="hint">{t(SHOP_T.offAgain, { n: COIN.news })}</span>
          <span className="coin-nudge-go">{t(SHOP_T.avatarGo)}</span>
        </Link>
      )}

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
        {/*
          * 아직 만들지도 않은 것 — 이름만 세운다.
          *
          * 위 줄들과 달리 미리보기도 견본 색도 없다. 보여 줄 것이 없는데 버튼만 있으면
          * 눌러 보고 아무 일도 안 일어난다.
          */}
        {PLANNED.map((p) => (
          <li key={p.key} className="card shop-item">
            <span className="shop-body">
              <strong>{t(p.label)}</strong>
              <span className="hint">{t(p.note)}</span>
            </span>
            <span className="shop-buy">
              <span className="shop-soon">{t(SHOP_T.soon)}</span>
            </span>
          </li>
        ))}
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
          <div className="preview-box" ref={boxRef}>
            <iframe
              className="preview-frame"
              style={{
                width: PREVIEW_W,
                height: PREVIEW_H,
                transform: `scale(${scale})`,
                // 줄인 만큼 자리도 줄어야 아래 한 줄이 붙어 온다
                marginBottom: -(PREVIEW_H * (1 - scale)),
                marginRight: -(PREVIEW_W * (1 - scale)),
              }}
              src={`/preview?t=${preview}`}
              title={t(SHOP_T.previewOf, { name: t(CARD_THEMES[preview].label) })}
            />
          </div>
          {/* 눌러도 안 움직이는 것이 고장이 아니라 그렇게 만든 것임을 알려 준다 */}
          <span className="preview-note">{t(SHOP_T.previewNote)}</span>
        </div>
      )}
    </>
  );
}
