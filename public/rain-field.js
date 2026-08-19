/*
 * 화면 전체에 내리는 비 — 그리고 **카드를 만나면 그 방울을 카드에 넘긴다.**
 *
 * 예전에는 배경 비(CSS 낱개 <span>)와 카드 안 비(카드마다의 캔버스)가 아무 관계 없는
 * 두 시스템이었다. 속도를 같게 맞춰 놔도 배경 방울은 카드 뒤로 사라지고 카드 방울은
 * 카드 위에서 새로 생겨서, 한 방울이 이어지는 것으로 안 보였다.
 *
 * **층을 못 합치기 때문에 넘기는 방식을 쓴다.** 배경 비는 카드 뒤에 있고(z-index: 0)
 * 카드 안 비는 카드 배경 위·글자 아래에 있다(z-index: -1). 하나의 캔버스로 둘을 다
 * 그리려면 카드 위로 올라와야 하는데, 그러면 빗줄기가 글자 앞을 지나간다. 대신 방울이
 * 카드 위 가장자리에 닿는 순간 같은 속도·길이·원근으로 카드 캔버스에 넘겨주면, 보는
 * 눈에는 한 방울이 그대로 이어져 내린다.
 *
 * 카드 자리는 매 프레임 재지 않는다 — 열일곱 장의 getBoundingClientRect를 60Hz로
 * 부르면 그것만으로 레이아웃을 계속 다시 계산한다. 스크롤·크기 변화 때만 다시 잰다.
 */
(function () {
  if (window.customElements && customElements.get('rain-field')) return;

  customElements.define(
    'rain-field',
    class extends HTMLElement {
      connectedCallback() {
        if (this._on) {
          this.last = 0;
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

        /* 배경 비의 색 — 카드 밖은 카드 글자색을 쓸 수 없으니 테마에서 물려받는다 */
        this.tint = getComputedStyle(this).color.match(/\d+/g)?.slice(0, 3).join(',') || '46,92,110';
        /* 프레임당 방울 수. 화면이 카드보다 훨씬 넓으므로 카드 하나보다 많이 뿌린다 */
        this.rate = +(this.getAttribute('rate') || 0.55);
        this.drops = [];
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
        this.sprite();
      }

      /* 위가 투명하고 아래로 진해지는 줄기 하나 — 카드 캔버스와 같은 그림이다 */
      sprite() {
        const s = this._sp || (this._sp = document.createElement('canvas'));
        s.width = 6;
        s.height = 80;
        const g = s.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, 80);
        grad.addColorStop(0, 'rgba(' + this.tint + ',0)');
        grad.addColorStop(1, 'rgba(' + this.tint + ',1)');
        g.clearRect(0, 0, 6, 80);
        g.fillStyle = grad;
        g.globalAlpha = 0.35;
        g.fillRect(1, 0, 1, 80);
        g.fillRect(4, 0, 1, 80);
        g.globalAlpha = 1;
        g.fillRect(2, 0, 2, 80);
      }

      /** 지금 화면에 보이는 카드들의 자리 — 스크롤·크기 변화 때만 다시 잰다 */
      measure() {
        this.cards = [];
        for (const el of document.querySelectorAll('rain-canvas')) {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > this.h || r.width === 0) continue;
          this.cards.push({ el, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
        }
      }

      /**
       * 이번 프레임에 **위 가장자리를 넘어선** 카드 — 지나온 자리(py)와 지금 자리(y) 사이에
       * 카드 위 선이 끼어 있어야 한다.
       *
       * 「y가 top보다 아래」로만 보면 안 된다. 그러면 카드 아래로 내려보낸 방울이 같은
       * 카드에 다시 잡혀서 제자리를 맴돈다. 넘어서는 순간만 잡으면 카드마다 한 번씩이다.
       */
      cardAt(x, y, py) {
        for (const c of this.cards) {
          if (x < c.left || x > c.right) continue;
          /* 위가 화면 밖으로 걸친 카드는 화면 맨 위를 대신 진입선으로 쓴다 — 안 그러면
             넘어설 선이 화면 밖이라 그 카드만 비를 한 방울도 못 받는다 */
          const line = c.top < 0 ? 0 : c.top;
          if (py < line && y >= line) return c;
        }
        return null;
      }

      loop(rt) {
        this.raf = requestAnimationFrame((t) => this.loop(t));
        if (!this.w || !this.h) return;
        const dt = this.last ? Math.min(2.5, (rt - this.last) / 16.667) : 1;
        this.last = rt;
        /*
         * 자리를 반 초에 한 번 다시 잰다.
         *
         * 처음 붙을 때 한 번만 재면 안 된다 — 카드가 아직 안 그려졌거나 등장 애니메이션
         * 중이면 크기가 0이라 「카드가 없다」로 남고, 그 뒤로 아무 일도 안 일어나면 영영
         * 안 고쳐진다. 실제로 그렇게 넘겨줄 카드를 하나도 못 찾았다.
         *
         * 스크롤은 따로 즉시 다시 잰다 — 반 초를 기다리면 넘겨받는 자리가 어긋난다.
         */
        if ((this.tick = (this.tick || 0) + 1) % 30 === 0) this.measure();
        this.step(dt);
        this.draw();
      }

      step(dt) {
        this.acc = (this.acc || 0) + this.rate * dt;
        while (this.acc >= 1) {
          this.acc -= 1;
          /* 카드 안의 비와 같은 규격 — 원근에 따라 길이·폭·속도·진하기가 갈린다 */
          const z = 0.45 + Math.random() * 0.55;
          this.drops.push({
            x: Math.random() * this.w,
            y: -14,
            z,
            vy: (2.45 + Math.random() * 3.15) * (0.6 + z * 0.8),
            len: (16 + Math.random() * 18) * z,
            wd: 1 + z * 0.9,
          });
        }

        for (let i = this.drops.length - 1; i >= 0; i--) {
          const d = this.drops[i];
          const py = d.y;
          d.y += d.vy * dt;
          if (d.y - d.len > this.h) {
            this.drops.splice(i, 1);
            continue;
          }
          /*
           * 카드 위 가장자리를 넘어섰으면 그 카드에 넘긴다 — 같은 속도·길이·원근으로.
           *
           * 그리고 이 방울은 **카드 아래 모서리로 내려보낸다.** 지우면 안 된다: 지우면
           * 그 열의 방울을 맨 윗줄 카드가 전부 먹어서 아랫줄 카드에는 비가 한 방울도
           * 못 간다(실제로 첫 줄 세 장만 받고 나머지 일곱 장은 0이었다). 카드는 불투명
           * 하니 뒤로 지나가는 비는 어차피 안 보이고, 카드 밑에서 다시 나와 아랫줄 카드
           * 위에 닿는다 — 화면 전체의 비 밀도가 그대로 유지된다.
           */
          const c = this.cardAt(d.x, d.y, py);
          if (c && typeof c.el.adopt === 'function') {
            c.el.adopt({ x: d.x - c.left, y: d.y - c.top, z: d.z, vy: d.vy, len: d.len, wd: d.wd });
            d.y = c.bottom + (d.y - c.top);
          }
        }
      }

      draw() {
        const { ctx, w, h } = this;
        ctx.clearRect(0, 0, w, h);
        for (const d of this.drops) {
          ctx.globalAlpha = 0.2 + d.z * 0.34;
          ctx.drawImage(this._sp, d.x - d.wd / 2, d.y - d.len, d.wd, d.len);
        }
        ctx.globalAlpha = 1;
      }
    }
  );
})();
