/*
 * 카드 열일곱 장 안에서 각자 도는 비 — 4d/5a 시안의 캔버스 판.
 *
 * CSS 키프레임으로 안 되는 것 하나를 합니다: **물이 실제로 찹니다.** 방울이 수면에 닿을
 * 때마다 목표 수위가 오르고, 배수는 수위에 비례해 빠집니다(깊을수록 빨리). 높이를 코드에
 * 적어 두지 않았는데 들어오는 양과 나가는 양이 스스로 균형을 찾습니다. 그리고 방울이
 * 떨어진 자리만 수면이 우묵해졌다 되살아납니다 — 수면 전체가 들썩이지 않습니다.
 *
 * 성능에 대해: 캔버스는 카드마다 하나씩이고 각자 requestAnimationFrame을 돕니다. CSS는
 * 개수가 늘어도 메인 스레드 비용이 0인데 이건 카드 수에 비례합니다. 그래서 **안 보이는
 * 카드는 멈춥니다**(IntersectionObserver). 이게 없으면 홈에서 열일곱 개가 동시에 돕니다.
 * prefers-reduced-motion이면 루프가 아예 시작하지 않습니다.
 *
 * 자리 잡는 style은 CSS(app/season.css)가 정합니다. 여기서 host의 style을 만지면 React가
 * 다음 렌더에 지웁니다 — 그러면 높이가 0이 되어 방울이 태어난 자리에서 바로 죽습니다.
 */
(function () {
  if (window.customElements && customElements.get('rain-canvas')) return;

  customElements.define(
    'rain-canvas',
    class extends HTMLElement {
      connectedCallback() {
        /*
         * 다시 붙을 때는 처음부터 만들지 않고 **루프만 되살린다.**
         *
         * 홈에서 카드를 끌어 순서를 바꾸면(app/sortable-card.tsx) React가 그 노드를
         * 옮기고, 옮기는 동안 disconnect → connect가 일어난다. 예전에는 여기서 그냥
         * 돌아갔는데, disconnect가 이미 rAF를 끊어 놓아서 순서를 한 번 바꾼 카드는
         * 비가 영영 멈춘 채로 남았다.
         */
        if (this._on) {
          if (this.ro) this.ro.observe(this);
          if (this.io) this.io.observe(this);
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

        /* 색은 카드에서 물려받는다 — color가 상속되므로 카드 글자색이 그대로 온다.
           어두운 카드는 크림, 밝은 카드는 짙은 청회색이 되어 열일곱 장에 색을 따로
           정할 필요가 없다. CSS의 currentColor와 같은 이야기다. */
        this.readTint();
        /* 프레임당 방울 수. 0.1이면 초당 6개쯤 */
        this.rate = +(this.getAttribute('rate') || 0.1);

        this.drops = [];
        this.spray = [];
        this.rings = [];
        this.level = 7;
        this.target = 7;
        this.acc = 0;
        this.t = 0;
        this.vis = true;
        this.dpr = Math.min(2, window.devicePixelRatio || 1);

        this.ro = new ResizeObserver(() => this.fit());
        this.ro.observe(this);
        this.io = new IntersectionObserver((e) => { this.vis = e[0].isIntersecting; }, { threshold: 0 });
        this.io.observe(this);
        this.fit();

        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.loop();
      }

      disconnectedCallback() {
        cancelAnimationFrame(this.raf);
        if (this.ro) this.ro.disconnect();
        if (this.io) this.io.disconnect();
      }

      readTint() {
        const m = getComputedStyle(this).color.match(/\d+/g);
        this.tint = m ? m.slice(0, 3).join(',') : '255,255,255';
      }

      fit() {
        const r = this.getBoundingClientRect();
        this.w = r.width;
        this.h = r.height;
        this.cv.width = Math.max(1, Math.round(this.w * this.dpr));
        this.cv.height = Math.max(1, Math.round(this.h * this.dpr));
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.readTint();
      }

      loop() {
        this.raf = requestAnimationFrame(() => this.loop());
        if (!this.vis || !this.w || !this.h) return;
        this.step();
        this.draw();
      }

      step() {
        const { w, h } = this;
        this.t += 1 / 60;

        this.acc += this.rate;
        while (this.acc >= 1) {
          this.acc -= 1;
          this.drops.push({
            x: Math.random() * w,
            y: -12,
            vy: 0.9 + Math.random() * 1,
            len: 9 + Math.random() * 13,
          });
        }

        const surf = h - this.level;
        for (let i = this.drops.length - 1; i >= 0; i--) {
          const d = this.drops[i];
          d.y += d.vy;
          if (d.y < surf) continue;
          this.drops.splice(i, 1);
          /* 방울 하나가 목표 수위를 이만큼 올린다 */
          this.target = Math.min(h * 0.28, this.target + 2);
          const n = 1 + ((Math.random() * 2) | 0);
          for (let k = 0; k < n; k++) {
            this.spray.push({
              x: d.x,
              y: surf,
              vx: (Math.random() * 2 - 1) * 1.1,
              vy: -(0.4 + Math.random() * 1.3),
              r: 0.5 + Math.random() * 0.6,
              a: 0.7,
            });
          }
          this.rings.push({ x: d.x, r: 1.5, a: 0.5, age: 0 });
        }

        for (let i = this.spray.length - 1; i >= 0; i--) {
          const s = this.spray[i];
          s.vy += 0.09;
          s.x += s.vx;
          s.y += s.vy;
          s.a -= 0.016;
          s.r -= 0.009;
          if (s.a <= 0 || s.r <= 0 || s.y > h) this.spray.splice(i, 1);
        }

        for (let i = this.rings.length - 1; i >= 0; i--) {
          const p = this.rings[i];
          p.r += 0.5;
          p.a -= 0.01;
          p.age += 1 / 60;
          if (p.a <= 0) this.rings.splice(i, 1);
        }

        /*
         * 수위는 방울이 닿는 순간 튀지 않는다 — target만 오르고 실제 수면이 그것을 천천히
         * 따라간다. 그냥 더하면 방울마다 팅 튀어 위아래로만 움직여 보인다.
         */
        this.target = Math.max(6, this.target - (this.target * 0.006 + 0.02));
        this.level += (this.target - this.level) * 0.05;
      }

      /** x 자리의 수면 높이 */
      waveY(x) {
        let y =
          this.h - this.level +
          Math.sin(x * 0.055 + this.t * 1.7) * 1.7 +
          Math.sin(x * 0.021 - this.t * 1.1) * 2.5;
        /* 방울이 떨어진 자리만 우묵해졌다 되살아난다 — 멀어질수록, 시간이 지날수록 잦아든다 */
        for (const p of this.rings) {
          const d = (x - p.x) / 20;
          if (d > 3 || d < -3) continue;
          y += Math.exp(-d * d) * 5.5 * Math.sin(p.age * 22) * Math.exp(-p.age * 4);
        }
        return y;
      }

      draw() {
        const { ctx, w, h, tint } = this;
        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(' + tint + ',.42)';
        for (const d of this.drops) ctx.fillRect(d.x, d.y, 1.4, d.len);

        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, this.waveY(0));
        for (let x = 4; x <= w; x += 4) ctx.lineTo(x, this.waveY(x));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = 'rgba(' + tint + ',.24)';
        ctx.fill();

        ctx.lineWidth = 1;
        for (const p of this.rings) {
          ctx.beginPath();
          ctx.ellipse(p.x, this.waveY(p.x), p.r * 2.4, p.r * 0.7, 0, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(' + tint + ',' + p.a.toFixed(3) + ')';
          ctx.stroke();
        }

        for (const s of this.spray) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + tint + ',' + (s.a * 0.85).toFixed(3) + ')';
          ctx.fill();
        }
      }
    }
  );
})();
