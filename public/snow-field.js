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

  customElements.define(
    'snow-field',
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

        this.tint = this.getAttribute('tint') || '255,255,255';
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
        this.rate = this.w * this.per;
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
          });
        }

        for (let i = this.flakes.length - 1; i >= 0; i--) {
          const f = this.flakes[i];
          const py = f.y;
          f.y += f.vy * dt;
          f.ph += f.sp * dt;
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

      draw() {
        const { ctx, w, h } = this;
        ctx.clearRect(0, 0, w, h);
        for (const f of this.flakes) {
          const x = f.x + Math.sin(f.ph) * f.sw;
          const a = Math.min(1, (h - f.y) / 40) * (0.55 + f.r * 0.15);
          ctx.fillStyle = 'rgba(' + this.tint + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(x, f.y, f.r, 0, 6.2832);
          ctx.fill();
        }
      }
    }
  );
})();
