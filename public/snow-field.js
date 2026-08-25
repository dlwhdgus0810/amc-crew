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
   * 눈 결정 다섯 종 — 보내 주신 도안(6갈래 스텐실)을 보고 뼈대로 옮겼다.
   *
   * 그림 파일이 아니라 **자로 그린다.** 갈래 여섯이 같은 모양을 60도씩 돌려 놓은 것이라,
   * 「줄기 하나 + 곁가지 몇 개 + 끝 모양」만 정해 두면 나머지는 돌리기만 하면 된다.
   * 도안 다섯 장이 실제로 그렇게 다르다 — 곁가지의 수와 자리, 끝이 둥근지 뾰족한지,
   * 가운데 육각이 있는지 없는지.
   *
   *   br  [줄기에서의 자리(0~1), 곁가지 길이(줄기 대비), 벌어진 각도]
   *   tip 끝 모양 — 'ball' 동그라미, 'arrow' 화살, null 없음
   *   hex 가운데 육각의 반지름 (0이면 없음)
   */
  const CRYSTALS = [
    /* 1. 도안 왼쪽 위 — 곁가지 세 쌍이 고르게 */
    { br: [[0.34, 0.30, 52], [0.56, 0.26, 52], [0.78, 0.20, 52]], tip: null, hex: 0 },
    /* 2. 도안 오른쪽 위 — 가운데 육각, 끝은 화살 */
    { br: [[0.46, 0.32, 58], [0.74, 0.22, 58]], tip: 'arrow', hex: 0.3 },
    /* 3. 도안 가운데 — 곁가지 없이 끝만 동그란 것 */
    { br: [], tip: 'ball', hex: 0 },
    /* 4. 도안 왼쪽 아래 — 고사리처럼 촘촘한 것 */
    { br: [[0.24, 0.20, 48], [0.42, 0.28, 48], [0.60, 0.24, 48], [0.80, 0.16, 48]], tip: null, hex: 0.16 },
    /* 5. 도안 오른쪽 아래 — 곁가지 두 쌍이 길게 */
    { br: [[0.38, 0.34, 55], [0.68, 0.26, 55]], tip: null, hex: 0 },
  ];

  /**
   * 결정 하나를 미리 그려 둔 그림으로 만든다.
   *
   * **매 프레임 그리지 않는 이유.** 결정 하나가 선 스무 개쯤이고 화면에 수십 개가 뜬다.
   * 프레임마다 다시 그리면 그 곱이 매번이다. 한 번 그려 두고 돌려서 얹기만 하면
   * 그리는 값은 한 번뿐이고 프레임마다는 그림 하나 얹는 값만 든다.
   *
   * 속은 희게, 테두리는 회청으로 두 번 긋는다. 겨울 바탕(#EEF2F6)에 흰 것만 그리면
   * 대비가 1.12:1이라 안 보이는데, 테두리가 있으면 흰 것은 그대로 눈이면서 실루엣이 보인다.
   */
  function sprite(spec, px, fill, edge, dpr) {
    const cv = document.createElement('canvas');
    const s = Math.round(px * dpr);
    cv.width = s;
    cv.height = s;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.translate(px / 2, px / 2);
    const R = px / 2 - px * 0.06; // 테두리 굵기만큼 안으로 물린다

    const path = new Path2D();
    for (let a = 0; a < 6; a++) {
      const t = (a * Math.PI) / 3;
      const ux = Math.cos(t), uy = Math.sin(t);
      path.moveTo(0, 0);
      path.lineTo(ux * R, uy * R);
      for (const [at, len, deg] of spec.br) {
        const bx = ux * R * at, by = uy * R * at;
        for (const dir of [1, -1]) {
          const t2 = t + (dir * deg * Math.PI) / 180;
          path.moveTo(bx, by);
          path.lineTo(bx + Math.cos(t2) * R * len, by + Math.sin(t2) * R * len);
        }
      }
      if (spec.tip === 'arrow') {
        for (const dir of [1, -1]) {
          const t2 = t + Math.PI + (dir * 34 * Math.PI) / 180;
          path.moveTo(ux * R, uy * R);
          path.lineTo(ux * R + Math.cos(t2) * R * 0.22, uy * R + Math.sin(t2) * R * 0.22);
        }
      }
    }
    if (spec.hex > 0) {
      for (let a = 0; a < 6; a++) {
        const t = (a * Math.PI) / 3;
        const x = Math.cos(t) * R * spec.hex, y = Math.sin(t) * R * spec.hex;
        if (a === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      path.closePath();
    }

    c.lineCap = 'round';
    c.lineJoin = 'round';
    /* 테두리 먼저 굵게, 그 위에 속을 가늘게 — 한 번에 흰 선과 그 둘레가 같이 나온다 */
    c.strokeStyle = edge;
    c.lineWidth = px * 0.115;
    c.stroke(path);
    c.strokeStyle = fill;
    c.lineWidth = px * 0.055;
    c.stroke(path);

    if (spec.tip === 'ball') {
      for (let a = 0; a < 6; a++) {
        const t = (a * Math.PI) / 3;
        const x = Math.cos(t) * R, y = Math.sin(t) * R, r = px * 0.1;
        c.beginPath();
        c.arc(x, y, r, 0, 6.2832);
        c.fillStyle = fill;
        c.strokeStyle = edge;
        c.lineWidth = px * 0.05;
        c.fill();
        c.stroke();
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
          for (const px of [16, 26, 40]) {
            this.sheets.push(CRYSTALS.map((k) => sprite(k, px, fill, edge, Math.min(2, window.devicePixelRatio || 1))));
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
        /*
         * 결정은 수를 줄인다.
         *
         * 지금 값은 지름 2~6px짜리 동그라미에 맞춰 고른 것이라, 그대로 두면 폰 화면에
         * 10~25px짜리 결정이 일흔 개 넘게 뜬다 (재 봤다). 눈이 아니라 스티커를 뿌린 것이
         * 된다. 결정 하나가 눈에 차지하는 자리가 열 배쯤 되니 수를 그만큼 줄인다.
         */
        this.rate = this.w * this.per * (this.crystal ? 0.42 : 1);
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
          f.y += f.vy * dt;
          f.ph += f.sp * dt;
          if (f.rv != null) f.rot += f.rv * dt;
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
           * 한 카드에 두 번 쌓지 않으려고 표시를 달아 둔다 — 표면은 눈이 쌓일수록
           * 올라오므로 안 막으면 같은 눈송이가 내려가는 내내 계속 쌓는다.
           */
          const x = f.x + Math.sin(f.ph) * f.sw;
          const c = this.cardAt(x, f.y);
          if (c && f.on !== c.el && typeof c.el.surfaceY === 'function') {
            const sy = c.el.surfaceY(x - c.left);
            if (sy != null && f.y - c.top + c.ledge + f.r >= sy) {
              c.el.land(x - c.left, f.r);
              f.on = c.el;
            }
          }
        }
      }

      /**
       * 결정 한 장에 입힐 것 — 어느 종류인지, 화면에서 몇 px인지, 도는 속도.
       *
       * **r은 그대로 둔다.** 카드에 쌓이는 양이 r로 정해지는데(snow-canvas.js의 land),
       * 여기서 r을 키우면 v2에서만 눈이 몇 배로 쌓인다. 보이는 크기(px)만 따로 든다.
       */
      dress(r) {
        return {
          kind: (Math.random() * CRYSTALS.length) | 0,
          /*
           * 12px 아래로는 안 내려간다. 갈래 여섯에 곁가지까지 있는 그림이라 그보다
           * 작으면 선이 뭉개져 회색 얼룩이 된다 — 10px짜리를 화면에 띄워 보고 올렸다.
           */
          px: 12 + ((r - 1) / 2.2) * 12 + Math.random() * 4,
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
          /* 미리 그려 둔 것 중 가까운 크기를 골라 돌려서 얹는다 */
          const sheet = this.sheets[f.px < 21 ? 0 : f.px < 33 ? 1 : 2];
          const img = sheet[f.kind];
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, a));
          ctx.translate(x, f.y);
          ctx.rotate(f.rot);
          ctx.drawImage(img, -f.px / 2, -f.px / 2, f.px, f.px);
          ctx.restore();
        }
      }
    }
  );
})();
