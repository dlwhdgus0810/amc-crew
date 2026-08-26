'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useT } from '../i18n';
import { useViewer } from '../session';
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
  /*
   * 관리자는 안 산 테마에도 건의를 넣을 수 있다 — 서버도 같이 그렇게 본다
   * (app/api/tickets/route.ts). 테마를 손보는 사람이 정작 못 적으면 곤란하고,
   * 관리자 화면의 선택기가 이미 안 산 테마도 걸어 보는 자리다.
   */
  const { isAdmin } = useViewer();
  const [w, setW] = useState(wallet);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  /** 지금 미리보고 있는 테마 — null이면 창이 닫혀 있다 */
  const [preview, setPreview] = useState<CardTheme | null>(null);
  /** 디자인 건의 칸이 열려 있는 테마 — 한 번에 하나만 연다 */
  const [asking, setAsking] = useState<CardTheme | null>(null);
  /** 선물 칸이 열려 있는 테마 */
  const [gifting, setGifting] = useState<CardTheme | null>(null);
  const [friends, setFriends] = useState<{ id: string; name: string; owned: boolean }[] | null>(null);
  const [giftBusy, setGiftBusy] = useState<string | null>(null);

  /*
   * 친구 목록은 선물 칸을 처음 열 때 한 번만 받아 온다.
   *
   * 상점을 여는 사람 대부분은 선물하러 온 것이 아니다 — 화면을 열 때마다 부르면
   * 안 쓰는 사람 몫까지 매번 물어보게 된다.
   */
  async function openGift(theme: CardTheme) {
    setGifting(theme);
    setAsking(null);
    setMsg(null);
    if (friends) return;
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      const list: { id: string; name: string }[] = res.ok ? (data.friends ?? []) : [];
      setFriends(list.map((f) => ({ id: f.id, name: f.name, owned: false })));
    } catch {
      setFriends([]);
    }
  }

  /*
   * 선물 보내기. 값은 내 지갑에서 빠지므로 서버가 준 새 지갑으로 갈아 끼운다 —
   * 여기서 빼기를 하면 화면의 잔액과 실제가 갈릴 수 있다 (사는 것과 같은 이유다).
   */
  async function sendGift(theme: CardTheme, to: string, name: string) {
    setGiftBusy(to);
    setMsg(null);
    try {
      const res = await fetch('/api/shop/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(SHOP_T.failed));
      setW(data.wallet);
      setMsg({ type: 'ok', text: t(SHOP_T.giftDone, { name }) });
      setGifting(null);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(SHOP_T.failed) });
    } finally {
      setGiftBusy(null);
    }
  }
  const [askTitle, setAskTitle] = useState('');
  const [askBody, setAskBody] = useState('');
  const [askBusy, setAskBusy] = useState(false);

  function openAsk(theme: CardTheme) {
    setAsking(theme);
    setAskTitle('');
    setAskBody('');
    setMsg(null);
  }

  /*
   * 건의는 **건의함으로 보낸다** (/api/tickets, kind: 'theme').
   *
   * 이 화면에 따로 담아 두지 않는다. 답을 주고 상태를 바꾸는 자리가 건의함이라,
   * 여기에 또 쌓으면 같은 글이 두 군데 있고 답은 한 군데에만 달린다.
   *
   * 산 사람인지는 서버가 다시 본다 — 아래 버튼이 가진 테마에만 뜨지만 그건 화면일 뿐이다.
   */
  async function sendAsk(theme: CardTheme) {
    setAskBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'theme', theme, title: askTitle.trim(), body: askBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(SHOP_T.failed));
      setMsg({ type: 'ok', text: t(SHOP_T.suggestDone, { n: String(data.number) }) });
      setAsking(null);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(SHOP_T.failed) });
    } finally {
      setAskBusy(false);
    }
  }

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
                  <>
                    <span className="shop-owned">{t(SHOP_T.owned)}</span>
                    {/* 내가 가졌어도 친구는 아직 없을 수 있다 */}
                    <button className="link-btn" onClick={() => (gifting === key ? setGifting(null) : void openGift(key))}>
                      {gifting === key ? t(SHOP_T.giftClose) : t(SHOP_T.gift)}
                    </button>
                    {/* 산 사람에게만 열리는 칸 — 서버도 같은 것을 다시 본다 */}
                    <button className="link-btn" onClick={() => (asking === key ? setAsking(null) : openAsk(key))}>
                      {asking === key ? t(SHOP_T.suggestClose) : t(SHOP_T.suggest)}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="shop-price">{t(SHOP_T.price, { n: price })}</span>
                    <button disabled={busy !== null || short > 0} onClick={() => void buy(key)}>
                      {busy === key ? t(SHOP_T.buying) : t(SHOP_T.buy)}
                    </button>
                    {short > 0 && <span className="hint">{t(SHOP_T.short, { n: short })}</span>}
                    {/* 내가 안 가진 테마도 친구에게는 사 줄 수 있다 */}
                    <button className="link-btn" onClick={() => (gifting === key ? setGifting(null) : void openGift(key))}>
                      {gifting === key ? t(SHOP_T.giftClose) : t(SHOP_T.gift)}
                    </button>
                    {isAdmin && (
                      <button className="link-btn" onClick={() => (asking === key ? setAsking(null) : openAsk(key))}>
                        {asking === key ? t(SHOP_T.suggestClose) : t(SHOP_T.suggest)}
                      </button>
                    )}
                  </>
                )}
              </span>
              {gifting === key && (
                <span className="shop-ask">
                  <span className="hint">{t(SHOP_T.giftIntro, { n: price ?? 0 })}</span>
                  {friends == null ? (
                    <span className="hint">{t(SHOP_T.giftLoading)}</span>
                  ) : friends.length === 0 ? (
                    <span className="hint">{t(SHOP_T.giftNoFriends)}</span>
                  ) : (
                    <span className="gift-friends">
                      {friends.map((f) => (
                        <button
                          key={f.id}
                          className="secondary"
                          disabled={giftBusy !== null || (price ?? 0) > w.left}
                          onClick={() => void sendGift(key, f.id, f.name)}
                        >
                          {giftBusy === f.id ? t(SHOP_T.giftSending) : f.name}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              )}
              {asking === key && (
                <span className="shop-ask">
                  <span className="hint">{t(SHOP_T.suggestIntro)}</span>
                  <input
                    value={askTitle}
                    onChange={(e) => setAskTitle(e.target.value)}
                    placeholder={t(SHOP_T.suggestTitlePh)}
                    maxLength={80}
                  />
                  <textarea
                    value={askBody}
                    onChange={(e) => setAskBody(e.target.value)}
                    placeholder={t(SHOP_T.suggestBodyPh)}
                    rows={3}
                    maxLength={2000}
                  />
                  <button disabled={askBusy || askTitle.trim().length === 0} onClick={() => void sendAsk(key)}>
                    {askBusy ? t(SHOP_T.suggestSending) : t(SHOP_T.suggestSend)}
                  </button>
                </span>
              )}
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
