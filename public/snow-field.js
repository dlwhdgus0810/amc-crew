/*
 * 화면 전체에 내리는 눈 — 그리고 **카드를 만나면 그 눈송이를 카드에 넘긴다.**
 *
 * 배경 눈(CSS 낱개 <span>)과 카드 위 눈(카드마다의 캔버스)이 아무 관계 없는 두 시스템
 * 이었다. 배경 눈은 카드를 그냥 지나가고 카드 눈은 카드 위에서 새로 생겨서, 눈이
 * 쌓이는 것과 내리는 것이 따로 놀았다.
 *
 * 비에서 쓴 방식 그대로다 (public/rain-field.js). 다른 점 하나는 **넘겨준 눈을 여기서
 * 바로 지운다**는 것이다. 비는 줄기라서 카드 위 선에 걸친 동안 위쪽을 여기가 그려 줘야
 * 했지만, 눈송이는 점이라 걸칠 것이 없다.
 *
 * 그리고 카드가 되돌려 주는 것을 받는다. 카드 안에 쌓인 눈이 바닥까지 차면 덩어리가
 * 카드 밖으로 쓸려 나가는데(snow-canvas.js), 그것을 눈송이로 받아 아래 카드로 내린다.
 */
(function () {
  if (window.customElements && customElements.get('snow-field')) return;

  /*
   * 결정으로 그릴 때 눈송이 수를 이만큼으로 줄인다.
   *
   * 지금 값은 지름 2~6px 동그라미에 맞춰 고른 것이라, 그대로 두면 폰 화면에 결정이
   * 일흔 개 넘게 뜬다 (재 봤다). 눈이 아니라 스티커를 뿌린 것이 된다.
   */
  const CRYSTAL_RATE = 0.38;
  /*
   * 줄인 만큼 한 송이가 더 무겁다.
   *
   * 카드에 쌓이는 양은 land(x, r)이 r²에 비례해 얹는다 (public/snow-canvas.js).
   * 수만 줄이고 r을 그대로 두면 쌓이는 속도도 같이 줄어 **다지는 것에 진다** —
   * 재 보니 1800프레임에 가장자리가 9.5에서 6.9로 내려갔다(v1은 9.2로 버틴다).
   * 그러면 가장자리가 안 차니 카드 안으로 넘치지도, 바닥이 차 카드 밑으로 쓸려
   * 나가지도 않는다. 눈은 오는데 안 쌓이는 것이 그 때문이었다.
   *
   * 한 송이가 대신하는 수만큼 무겁게 친다. r² 비례라 √를 씌운다.
   */
  const CRYSTAL_MASS = Math.sqrt(1 / CRYSTAL_RATE);

  /*
   * 눈 결정 다섯 종 — 보내 주신 도안(patch12/snowflakes)을 그대로 쓴다.
   *
   * SVG가 viewBox 0 0 24 24에 선 하나로 그려져 있어서, d 문자열을 Path2D에 그냥
   * 넘기면 된다. 앞서 도안을 보고 뼈대를 다시 짰던 것은 지운다 — 원본이 있는데
   * 흉내 낸 것을 쓸 이유가 없다.
   *
   * 그림 파일(png·svg)은 안 받아 온다. 요청 다섯 개가 늘고, 받아 오는 동안 눈이
   * 안 오고, 무엇보다 색을 못 바꾼다 — 흰 도안 그대로면 겨울 바탕에서 안 보인다.
   * 선 데이터만 들고 와서 여기서 두 번 그으면 테두리를 입힐 수 있다.
   */
  const SNOWFLAKES = [
    /* 가지 셋 + 갈라진 끝 — snowflake-a.svg */
    [
      { p: 'M12.00,12.00L12.00,1.00M12.00,8.00L9.16,5.78M12.00,8.00L14.84,5.78M12.00,5.40L9.56,3.49M12.00,5.40L14.44,3.49M12.00,3.00L10.11,1.52M12.00,3.00L13.89,1.52M12.00,1.00L10.89,2.78M12.00,1.00L13.11,2.78M12.00,12.00L21.53,6.50M15.46,10.00L15.97,6.43M15.46,10.00L18.81,11.35M17.72,8.70L18.15,5.63M17.72,8.70L20.59,9.86M19.79,7.50L20.13,5.12M19.79,7.50L22.02,8.40M21.53,6.50L19.43,6.43M21.53,6.50L20.54,8.35M12.00,12.00L21.53,17.50M15.46,14.00L18.81,12.65M15.46,14.00L15.97,17.57M17.72,15.30L20.59,14.14M17.72,15.30L18.15,18.37M19.79,16.50L22.02,15.60M19.79,16.50L20.13,18.88M21.53,17.50L20.54,15.65M21.53,17.50L19.43,17.57M12.00,12.00L12.00,23.00M12.00,16.00L14.84,18.22M12.00,16.00L9.16,18.22M12.00,18.60L14.44,20.51M12.00,18.60L9.56,20.51M12.00,21.00L13.89,22.48M12.00,21.00L10.11,22.48M12.00,23.00L13.11,21.22M12.00,23.00L10.89,21.22M12.00,12.00L2.47,17.50M8.54,14.00L8.03,17.57M8.54,14.00L5.19,12.65M6.28,15.30L5.85,18.37M6.28,15.30L3.41,14.14M4.21,16.50L3.87,18.88M4.21,16.50L1.98,15.60M2.47,17.50L4.57,17.57M2.47,17.50L3.46,15.65M12.00,12.00L2.47,6.50M8.54,10.00L5.19,11.35M8.54,10.00L8.03,6.43M6.28,8.70L3.41,9.86M6.28,8.70L5.85,5.63M4.21,7.50L1.98,8.40M4.21,7.50L3.87,5.12M2.47,6.50L3.46,8.35M2.47,6.50L4.57,6.43', w: 1.05 },
    ],
    /* 육각 중심 + 화살 끝 — snowflake-b.svg */
    [
      { p: 'M12.00,8.80L12.00,0.90M12.00,6.10L9.17,4.04M12.00,6.10L14.83,4.04M12.00,3.40L9.90,1.87M12.00,3.40L14.10,1.87M12.00,0.90L10.62,3.10M12.00,0.90L13.38,3.10M14.77,10.40L21.61,6.45M17.11,9.05L17.48,5.57M17.11,9.05L20.31,10.47M19.45,7.70L19.72,5.12M19.45,7.70L21.82,8.75M21.61,6.45L19.02,6.35M21.61,6.45L20.40,8.75M14.77,13.60L21.61,17.55M17.11,14.95L20.31,13.53M17.11,14.95L17.48,18.43M19.45,16.30L21.82,15.25M19.45,16.30L19.72,18.88M21.61,17.55L20.40,15.25M21.61,17.55L19.02,17.65M12.00,15.20L12.00,23.10M12.00,17.90L14.83,19.96M12.00,17.90L9.17,19.96M12.00,20.60L14.10,22.13M12.00,20.60L9.90,22.13M12.00,23.10L13.38,20.90M12.00,23.10L10.62,20.90M9.23,13.60L2.39,17.55M6.89,14.95L6.52,18.43M6.89,14.95L3.69,13.53M4.55,16.30L4.28,18.88M4.55,16.30L2.18,15.25M2.39,17.55L4.98,17.65M2.39,17.55L3.60,15.25M9.23,10.40L2.39,6.45M6.89,9.05L3.69,10.47M6.89,9.05L6.52,5.57M4.55,7.70L2.18,8.75M4.55,7.70L4.28,5.12M2.39,6.45L3.60,8.75M2.39,6.45L4.98,6.35', w: 1.0 },
      { p: 'M12.00,8.80L14.77,10.40L14.77,13.60L12.00,15.20L9.23,13.60L9.23,10.40Z', w: 0.95 },
    ],
    /* 열두 갈래 + 끝 동그라미 — snowflake-c.svg */
    [
      { p: 'M12.00,12.00L12.00,3.20M12.00,12.00L15.20,6.46M12.00,12.00L19.62,7.60M12.00,12.00L18.40,12.00M12.00,12.00L19.62,16.40M12.00,12.00L15.20,17.54M12.00,12.00L12.00,20.80M12.00,12.00L8.80,17.54M12.00,12.00L4.38,16.40M12.00,12.00L5.60,12.00M12.00,12.00L4.38,7.60M12.00,12.00L8.80,6.46', w: 1.0 },
      { f: [12.0, 3.2, 1.7] },
      { f: [15.2, 6.46, 1.3] },
      { f: [19.62, 7.6, 1.7] },
      { f: [18.4, 12.0, 1.3] },
      { f: [19.62, 16.4, 1.7] },
      { f: [15.2, 17.54, 1.3] },
      { f: [12.0, 20.8, 1.7] },
      { f: [8.8, 17.54, 1.3] },
      { f: [4.38, 16.4, 1.7] },
      { f: [5.6, 12.0, 1.3] },
      { f: [4.38, 7.6, 1.7] },
      { f: [8.8, 6.46, 1.3] },
    ],
    /* 깃털 셋 + 중심 고리 — snowflake-d.svg */
    [
      { p: 'M12.00,9.00L12.00,1.00M12.00,7.00L9.32,4.75M12.00,7.00L14.68,4.75M12.00,4.60L9.70,2.67M12.00,4.60L14.30,2.67M12.00,2.40L10.24,0.92M12.00,2.40L13.76,0.92M14.60,10.50L21.53,6.50M16.33,9.50L16.94,6.05M16.33,9.50L19.62,10.70M18.41,8.30L18.93,5.34M18.41,8.30L21.23,9.33M20.31,7.20L20.72,4.94M20.31,7.20L22.48,7.98M14.60,13.50L21.53,17.50M16.33,14.50L19.62,13.30M16.33,14.50L16.94,17.95M18.41,15.70L21.23,14.67M18.41,15.70L18.93,18.66M20.31,16.80L22.48,16.02M20.31,16.80L20.72,19.06M12.00,15.00L12.00,23.00M12.00,17.00L14.68,19.25M12.00,17.00L9.32,19.25M12.00,19.40L14.30,21.33M12.00,19.40L9.70,21.33M12.00,21.60L13.76,23.08M12.00,21.60L10.24,23.08M9.40,13.50L2.47,17.50M7.67,14.50L7.06,17.95M7.67,14.50L4.38,13.30M5.59,15.70L5.07,18.66M5.59,15.70L2.77,14.67M3.69,16.80L3.28,19.06M3.69,16.80L1.52,16.02M9.40,10.50L2.47,6.50M7.67,9.50L4.38,10.70M7.67,9.50L7.06,6.05M5.59,8.30L2.77,9.33M5.59,8.30L5.07,5.34M3.69,7.20L1.52,7.98M3.69,7.20L3.28,4.94', w: 1.05 },
      { c: [12.0, 12.0, 3.0], w: 0.95 },
    ],
    /* 촘촘한 고사리 — snowflake-e.svg */
    [
      { p: 'M12.00,12.00L12.00,0.80M12.00,8.40L9.45,5.85M12.00,8.40L14.55,5.85M12.00,6.40L9.74,4.14M12.00,6.40L14.26,4.14M12.00,4.40L10.09,2.49M12.00,4.40L13.91,2.49M12.00,2.40L10.66,1.06M12.00,2.40L13.34,1.06M12.00,12.00L21.70,6.40M15.12,10.20L16.05,6.72M15.12,10.20L18.60,11.13M16.85,9.20L17.68,6.11M16.85,9.20L19.94,10.03M18.58,8.20L19.28,5.59M18.58,8.20L21.19,8.90M20.31,7.20L20.80,5.37M20.31,7.20L22.14,7.69M12.00,12.00L21.70,17.60M15.12,13.80L18.60,12.87M15.12,13.80L16.05,17.28M16.85,14.80L19.94,13.97M16.85,14.80L17.68,17.89M18.58,15.80L21.19,15.10M18.58,15.80L19.28,18.41M20.31,16.80L22.14,16.31M20.31,16.80L20.80,18.63M12.00,12.00L12.00,23.20M12.00,15.60L14.55,18.15M12.00,15.60L9.45,18.15M12.00,17.60L14.26,19.86M12.00,17.60L9.74,19.86M12.00,19.60L13.91,21.51M12.00,19.60L10.09,21.51M12.00,21.60L13.34,22.94M12.00,21.60L10.66,22.94M12.00,12.00L2.30,17.60M8.88,13.80L7.95,17.28M8.88,13.80L5.40,12.87M7.15,14.80L6.32,17.89M7.15,14.80L4.06,13.97M5.42,15.80L4.72,18.41M5.42,15.80L2.81,15.10M3.69,16.80L3.20,18.63M3.69,16.80L1.86,16.31M12.00,12.00L2.30,6.40M8.88,10.20L5.40,11.13M8.88,10.20L7.95,6.72M7.15,9.20L4.06,10.03M7.15,9.20L6.32,6.11M5.42,8.20L2.81,8.90M5.42,8.20L4.72,5.59M3.69,7.20L1.86,7.69M3.69,7.20L3.20,5.37', w: 0.95 },
    ],
  ];

  /**
   * 결정 하나를 미리 그려 둔 그림으로 만든다.
   *
   * **매 프레임 그리지 않는 이유.** 결정 하나가 선 수십 개고 화면에 서른 개가 뜬다.
   * 프레임마다 다시 그리면 그 곱이 매번이다. 한 번 그려 두고 돌려서 얹기만 하면
   * 프레임마다는 그림 하나 얹는 값만 든다.
   *
   * **두 번 긋는다.** 테두리를 굵게 한 번, 그 위에 속을 가늘게 한 번. 겨울 바탕
   * (#EEF2F6)에 흰 것만 그리면 대비가 1.12:1이라 안 보이는데, 테두리가 있으면
   * 흰 것은 그대로 눈이면서 실루엣이 보인다.
   *
   * 도안이 정한 선 굵기(0.95~1.05)는 24칸 좌표라 화면에서는 1px이 채 안 된다. 굵기는
   * 화면 px으로 다시 잡되 도안이 준 **비율**은 지킨다 — b와 d는 획이 두 가지다.
   */
  function sprite(ops, px, fill, edge, dpr) {
    const fw = Math.max(0.85, px * 0.038); // 속(흰 선) 굵기, 화면 px
    const ew = Math.max(1.0, px * 0.048);  // 테두리가 그 바깥으로 더 나가는 만큼
    const pad = (fw * 1.05 + ew) / 2 + 0.5;

    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.round(px * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = (px - pad * 2) / 24;
    c.translate(pad, pad);
    c.scale(k, k);
    const u = 1 / k;                       // 화면 1px이 24칸 좌표로 얼마인가
    c.lineCap = 'round';
    c.lineJoin = 'round';

    const built = ops.map((o) => (o.p ? new Path2D(o.p) : null));
    /* 테두리 → 속 차례로 두 벌을 다 그린다 (한 벌씩 끝내야 테두리가 속을 안 덮는다) */
    for (const pass of [0, 1]) {
      c.strokeStyle = c.fillStyle = pass === 0 ? edge : fill;
      const extra = pass === 0 ? ew : 0;
      for (let i = 0; i < ops.length; i++) {
        const o = ops[i];
        if (o.p) {
          c.lineWidth = (fw * o.w + extra) * u;
          c.stroke(built[i]);
        } else if (o.c) {
          c.lineWidth = (fw * o.w + extra) * u;
          c.beginPath();
          c.arc(o.c[0], o.c[1], o.c[2], 0, 6.2832);
          c.stroke();
        } else {
          c.beginPath();
          c.arc(o.f[0], o.f[1], o.f[2] + (extra / 2) * u, 0, 6.2832);
          c.fill();
        }
      }
    }
    return cv;
  }

  customElements.define(
    'snow-field',
    class extends HTMLElement {
      connectedCallback() {
        /*
         * 다시 붙을 때는 처음부터 만들지 않고 **크기부터 다시 잰다.**
         *
         * fit이 innerWidth·innerHeight를 읽는데 그 둘은 떨어져 있는 동안에도 바뀐다
         * (창 크기, 화면 돌리기, 주소창 접힘). resize는 붙어 있는 동안만 듣고 있으므로
         * 떨어져 있을 때 온 것은 못 듣는다 — 그대로 돌아가면 낡은 크기로 그린다.
         * 재는 값이 화면 크기와 프레임당 눈송이 수(rate)다.
         *
         * loop의 첫 줄이 `if (!this.w || !this.h) return`이라 크기가 0으로 남으면
         * 루프가 도는 채로 아무 일도 안 한다 — 되살아난 것처럼 보이는데 눈은 안 온다.
         */
        if (this._on) {
          this.last = 0;
          this.fit();
          this.measure();
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.loop();
          return;
        }
        this._on = true;

        const root = this.attachShadow({ mode: 'open' });
        this.cv = document.createElement('canvas');
        Object.assign(this.cv.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          display: 'block',
        });
        root.appendChild(this.cv);
        this.ctx = this.cv.getContext('2d');

        this.tint = this.getAttribute('tint') || '255,255,255';
        /*
         * 결정으로 그릴지 동그라미로 그릴지 — <html data-snow>가 정한다 (app/layout.tsx).
         * 겨울 v2에서만 'crystal'이다.
         *
         * 색 둘을 CSS에서 받는다: 속은 color, 테두리는 --flake-edge. 테두리가 있어야
         * 겨울 바탕에서 실루엣이 보인다 (app/season-winter.css에 잰 값이 적혀 있다).
         */
        this.crystal = document.documentElement.dataset.snow === 'crystal';
        if (this.crystal) {
          const cs = getComputedStyle(this);
          const fill = cs.color || '#FFFFFF';
          const edge = cs.getPropertyValue('--flake-edge').trim() || 'rgba(94,118,144,0.85)';
          /*
           * 크기 셋만 미리 그려 두고 그 사이는 늘려 쓴다. 결정마다 픽셀을 따로 잡으면
           * 종류 다섯 × 크기 열몇 개가 되는데, 눈은 돌면서 떨어져서 조금 늘어난 것은
           * 눈에 안 띈다.
           */
          this.sheets = [];
          for (const px of [16, 22, 30]) {
            this.sheets.push(SNOWFLAKES.map((ops) => sprite(ops, px, fill, edge, Math.min(2, window.devicePixelRatio || 1))));
          }
        }
        /* px당 눈송이 수. 화면이 넓어지면 그만큼 더 뿌린다 — 폰에서 빗발이 굵어지던 것과 같은 이유 */
        this.per = +(this.getAttribute('rate') || 0) / 1400 || 0.35 / 1400;
        this.flakes = [];
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        this.cards = [];
        this.last = 0;

        this.fit();
        this.measure();
        this.onScroll = () => this.measure();
        addEventListener('scroll', this.onScroll, { passive: true });
        addEventListener('resize', (this.onResize = () => { this.fit(); this.measure(); }));

        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.loop();
      }

      disconnectedCallback() {
        cancelAnimationFrame(this.raf);
        removeEventListener('scroll', this.onScroll);
        removeEventListener('resize', this.onResize);
      }

      fit() {
        this.w = innerWidth;
        this.h = innerHeight;
        this.cv.width = Math.max(1, Math.round(this.w * this.dpr));
        this.cv.height = Math.max(1, Math.round(this.h * this.dpr));
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.rate = this.w * this.per * (this.crystal ? CRYSTAL_RATE : 1);
      }

      /** 지금 화면에 보이는 카드들의 자리 — 스크롤·크기 변화 때만 다시 잰다 */
      measure() {
        this.cards = [];
        for (const el of document.querySelectorAll('snow-canvas')) {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > this.h || r.width === 0) continue;
          /*
           * el의 상자는 카드 위로 ledge(90px), 아래로 skirt(70px)만큼 넓다. 눈이 앉는
           * 자리는 카드 윗변이므로 거기를 기준으로 잡는다.
           */
          const ledge = el.ledge || 90;
          const skirt = el.skirt || 70;
          this.cards.push({ el, left: r.left, right: r.right, ledge, top: r.top + ledge, bottom: r.bottom - skirt });
        }
      }

      /** 이 x·y가 어느 카드의 열 안에 있나 (아직 그 카드 아래로 내려가지 않았어야 한다) */
      cardAt(x, y) {
        for (const c of this.cards) {
          if (x >= c.left && x <= c.right && y >= c.top - 40 && y <= c.bottom) return c;
        }
        return null;
      }

      loop(rt) {
        this.raf = requestAnimationFrame((t) => this.loop(t));
        if (!this.w || !this.h) return;
        const dt = this.last ? Math.min(2.5, (rt - this.last) / 16.667) : 1;
        this.last = rt;
        /* 자리를 반 초에 한 번 다시 잰다 — 처음 한 번만 재면 카드가 안 그려진 동안 「없다」로 굳는다 */
        if ((this.tick = (this.tick || 0) + 1) % 30 === 0) this.measure();
        this.step(dt);
        this.draw();
      }

      step(dt) {
        /* 카드가 밖으로 밀어낸 눈을 받아 카드 아래에서 다시 내린다 */
        for (const c of this.cards) {
          const sp = c.el.spill;
          if (!sp || !sp.length) continue;
          for (const s of sp) {
            this.flakes.push({
              x: c.left + s.x, y: c.bottom, r: s.r,
              vy: 0.55 + s.r * 0.22 + Math.random() * 0.3,
              sw: 6 + Math.random() * 12, sp: 0.008 + Math.random() * 0.014, ph: Math.random() * 6.28,
              ...(this.crystal ? this.dress(s.r) : null),
            });
          }
          sp.length = 0;
        }

        this.acc = (this.acc || 0) + this.rate * dt;
        while (this.acc >= 1) {
          this.acc -= 1;
          /* 카드 안의 눈과 같은 규격 — 큰 눈이 조금 빠르다 */
          const r = 1 + Math.random() * 2.2;
          this.flakes.push({
            x: Math.random() * this.w, y: -6, r,
            vy: 0.55 + r * 0.22 + Math.random() * 0.3,
            sw: 6 + Math.random() * 12, sp: 0.008 + Math.random() * 0.014, ph: Math.random() * 6.28,
            ...(this.crystal ? this.dress(r) : null),
          });
        }

        for (let i = this.flakes.length - 1; i >= 0; i--) {
          const f = this.flakes[i];
          const py = f.y;
          /*
           * 눈더미에 앉는 **중**이면 거의 멈춘다 — 내려앉는 동안 옅어질 시간을 벌려는
           * 것이다 (아래 sink).
           *
           * 다 앉고 나면(sink가 1) 원래 속도로 돌아간다. 그때는 이미 안 보이니 빨라
           * 보이지 않고, 무엇보다 계속 느리면 카드 뒤를 기어가느라 화면에 눈송이가
           * 쌓인다 — 재 보니 스물몇 개여야 할 것이 백열여덟 개였고 그중 백여섯이
           * 다 앉은 채 기어가는 중이었다.
           */
          const slow = f.sink != null && f.sink < 1 ? 1 - 0.85 * f.sink : 1;
          f.y += f.vy * slow * dt;
          f.ph += f.sp * dt;
          if (f.rv != null) f.rot += f.rv * slow * dt;
          if (f.y - f.r > this.h) {
            this.flakes.splice(i, 1);
            continue;
          }
          /*
           * **눈더미에 닿으면 그 자리에 쌓고, 눈송이는 계속 내려간다.**
           *
           * 지우면 맨 윗줄 카드가 그 열의 눈을 전부 먹어서 아랫줄이 굶는다 — 재 보니 첫
           * 줄이 700개를 받을 때 둘째 줄은 스물다섯, 넷째 줄은 둘이었다. 카드는 얇은
           * 판이라 뒤로도 눈이 지나가는 것이 맞고, 그동안은 카드가 가려서 안 보이다가
           * 아래에서 다시 나온다. 비에서 쓴 것과 같다.
           *
           * 결정일 때는 앉는 모습을 보여 준다 — 아래 sink 참고. 지나가는 것은 그대로다.
           *
           * 한 카드에 두 번 쌓지 않으려고 표시를 달아 둔다 — 표면은 눈이 쌓일수록
           * 올라오므로 안 막으면 같은 눈송이가 내려가는 내내 계속 쌓는다.
           */
          const x = f.x + Math.sin(f.ph) * f.sw;
          const c = this.cardAt(x, f.y);
          if (c && f.on !== c.el && typeof c.el.surfaceY === 'function') {
            const sy = c.el.surfaceY(x - c.left);
            if (sy != null && f.y - c.top + c.ledge + f.r >= sy) {
              /* 결정은 수를 줄인 만큼 한 송이가 무겁다 (mass, 위 CRYSTAL_MASS) */
              c.el.land(x - c.left, f.mass || f.r);
              f.on = c.el;
              /*
               * 결정은 **눈더미에 스르르 잠긴다.**
               *
               * 동그라미일 때는 지름이 4px이라 카드 뒤로 넘어가는 것이 안 보였는데,
               * 20px짜리 결정이 눈더미를 뚫고 카드 뒤로 미끄러져 들어가니 눈이 쌓이는
               * 것이 아니라 카드 밑으로 빨려 드는 것처럼 보였다.
               *
               * 앉는 순간부터 옅어지고 조금 작아진다. 거의 멈춘 채로 그러니 눈더미에
               * 녹아드는 것으로 읽힌다. 카드 아랫변을 지나면(sinkAt) 도로 제 모습이
               * 된다 — 그 자리는 카드가 가리고 있던 경계라, 뒤에서 내려오던 눈이
               * 이어서 나오는 것으로 보인다.
               */
              if (f.kind != null) {
                f.sink = 0;
                f.sinkAt = c.bottom;
              }
            }
          }
          if (f.sink != null) {
            if (f.y > f.sinkAt) f.sink = null;
            else f.sink = Math.min(1, f.sink + 0.055 * dt);
          }
        }
      }

      /**
       * 결정 한 장에 입힐 것 — 어느 종류인지, 화면에서 몇 px인지, 도는 속도.
       *
       * **r은 그대로 둔다.** 떨어지는 속도와 옅어지는 정도가 r을 본다. 보이는 크기(px)와
       * 카드에 얹을 무게(mass)는 따로 든다.
       */
      dress(r) {
        return {
          kind: (Math.random() * SNOWFLAKES.length) | 0,
          /*
           * 14~27px.
           *
           * 도안이 촘촘해서(가지 세 단, 고사리의 잔가지) 작게 두면 선끼리 붙는다 —
           * 13px에서는 꽃 모양 얼룩이 됐다. 14px이 도안이 도안으로 보이는 아래끝이고,
           * 거기 맞춰 선도 가늘게 잡았다.
           */
          px: 14 + ((r - 1) / 2.2) * 10 + Math.random() * 3,
          /* 카드에 앉을 때만 쓰는 값 — 떨어지는 속도와 옅어지는 정도는 r 그대로다 */
          mass: r * CRYSTAL_MASS,
          rot: Math.random() * 6.28,
          rv: (Math.random() - 0.5) * 0.02,
        };
      }

      draw() {
        const { ctx, w, h } = this;
        ctx.clearRect(0, 0, w, h);
        for (const f of this.flakes) {
          const x = f.x + Math.sin(f.ph) * f.sw;
          const a = Math.min(1, (h - f.y) / 40) * (0.55 + f.r * 0.15);
          if (f.kind == null) {
            ctx.fillStyle = 'rgba(' + this.tint + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(x, f.y, f.r, 0, 6.2832);
            ctx.fill();
            continue;
          }
          /* 눈더미에 잠기는 중이면 옅어지고 조금 작아진다 (step의 sink) */
          const sunk = f.sink || 0;
          if (sunk > 0.98) continue;
          /* 미리 그려 둔 것 중 가까운 크기를 골라 돌려서 얹는다 */
          const sheet = this.sheets[f.px < 19 ? 0 : f.px < 26 ? 1 : 2];
          const img = sheet[f.kind];
          const px = f.px * (1 - 0.28 * sunk);
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, a)) * (1 - sunk);
          ctx.translate(x, f.y);
          ctx.rotate(f.rot);
          ctx.drawImage(img, -px / 2, -px / 2, px, px);
          ctx.restore();
        }
      }
    }
  );
})();
