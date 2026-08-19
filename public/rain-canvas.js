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
         * 옮기고, 옮기는 동안 disconnect → connect가 일어난다. 그냥 돌아가면
         * disconnect가 이미 끊어 놓은 rAF가 되살아나지 않아서, 순서를 한 번 바꾼
         * 카드는 비가 영영 멈춘 채로 남는다.
         *
         * last를 지우는 것은 dt 때문이다 — 떨어져 있던 시간이 그대로 dt가 되면
         * 돌아오는 첫 프레임에 방울이 뛴다 (2.5로 잘리긴 하지만 그것도 눈에 띈다).
         */
        if (this._on) {
          this.last = 0;
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
        this.sprite();
      }

      /*
       * 방울을 사각형으로 그리면 1자가 된다. 위가 투명하고 아래로 진해지는 줄기 하나를 미리
       * 그려 두고 방울마다 늘여 그린다. 가장자리를 약하게 둔 다음 넓게 키우면 흐려지는
       * 방울이 뿌옇게 보이는 효과가 공짜로 생긴다.
       */
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

      loop(rt) {
        this.raf = requestAnimationFrame((t) => this.loop(t));
        if (!this.vis || !this.w || !this.h) return;
        /*
         * dt는 60Hz 한 프레임을 1로 본 배수다. 이게 없으면 120Hz 폰에서 비가 두 배 빨리 떨어진다
         * — 아래 값들은 전부 60Hz 기준으로 맞춰 둔 것이다. 2.5로 잘라 두는 이유는 탭을
         * 다른 곳에 뒀다 돌아올 때 방울이 한 번에 순간이동하지 않게 하려는 것이다.
         */
        const dt = this.last ? Math.min(2.5, (rt - this.last) / 16.667) : 1;
        this.last = rt;
        this.step(dt);
        this.draw();
      }

      step(dt) {
        const { w, h } = this;
        this.t += dt / 60;

        this.acc += this.rate * dt;
        while (this.acc >= 1) {
          this.acc -= 1;
          /*
           * z는 원근이다 (0.45가 뒤, 1이 앞). 원근에 따라 길이·폭·속도·진하기가 달라진다.
           * 뒤에 있는 방울은 대개 중간에 흐려지며 사라진다 — 모든 방울이 물에 닿지 않고,
           * 닿은 방울에만 물튀김이 생긴다.
           */
          const z = 0.45 + Math.random() * 0.55;
          const fades = z < 0.74 && Math.random() < 0.8;
          this.drops.push({
            x: Math.random() * w,
            y: -14,
            z,
            life: 1,
            /*
             * 배경의 비(app/overrides.css의 .season-rain)와 **같은 px/s**로 떨어진다.
             *
             * 예전에는 프레임당 0.34~1.12px, 즉 20~67px/s였는데 배경은 919px/s였다 —
             * 같은 화면에서 배경 비가 카드 비보다 열 배 넘게 빨라서, 카드가 유리창이
             * 아니라 딴 세상처럼 보였다. 지금은 앞쪽 방울이 470px/s 언저리이고
             * 배경도 거기 맞춰 느려졌다.
             *
             * 떨어지는 속도만 바뀐다 — 방울이 생기는 빈도(rate)는 그대로라 수면에
             * 닿는 개수가 같고, 따라서 수위가 균형을 찾는 자리도 그대로다.
             */
            vy: (2.45 + Math.random() * 3.15) * (0.6 + z * 0.8),
            len: (16 + Math.random() * 18) * z,
            wd: 1 + z * 0.9,
            fadeAt: fades ? h * (0.3 + Math.random() * 0.45) : Infinity,
          });
        }

        for (let i = this.drops.length - 1; i >= 0; i--) {
          const d = this.drops[i];
          d.y += d.vy * dt;
          if (d.y > d.fadeAt) {
            d.life -= 0.035 * dt;
            /* 물에 닿지 않고 사라지므로 물튀김도 파문도 없다 */
            if (d.life <= 0) { this.drops.splice(i, 1); continue; }
          }
          /*
           * 방울의 **끝점**으로 잰다. 위쪽 끝으로 재면 줄기가 수면을 지나 카드 밑까지 보인다.
           * 평평한 수위 대신 그 x 자리의 실제 물결 높이를 쓴다 — 수면이 일렁이므로
           * 파문이 이는 자리도 같이 움직여야 한다.
           */
          const sy = this.waveY(d.x);
          if (d.y + d.len < sy) continue;
          this.drops.splice(i, 1);
          /* 방울 하나가 목표 수위를 이만큼 올린다 */
          this.target = Math.min(h * 0.28, this.target + 2);
          const n = 1 + ((Math.random() * 2) | 0);
          /*
           * spread는 **이 한 번의 물튀김**이 벌어지는 폭이다 — 방울마다 달라서 어떤 것은
           * 거의 안 튀고 어떤 것은 크게 벌어진다. 입자마다 따로 뽑지 않고 한 번의
           * 물튀김이 나눠 갖는다: 같은 방울이 만든 것이니 크기가 같아야 한다.
           */
          const spread = 0.35 + Math.random() * 0.85;
          for (let k = 0; k < n; k++) {
            this.spray.push({
              x: d.x,
              y: sy,
              /* 수직으로 솟지 않고 수면을 따라 퍼진다 — 가로가 세로보다 네 배 크다 */
              vx: (Math.random() * 2 - 1) * 2.2 * spread,
              vy: -(0.55 + Math.random() * 0.75) * spread,
              r: (0.5 + Math.random() * 0.5) * (0.7 + spread * 0.4),
              a: 0.7,
            });
          }
          this.rings.push({ x: d.x, r: 1.5, a: 0.5, age: 0 });
        }

        for (let i = this.spray.length - 1; i >= 0; i--) {
          const s = this.spray[i];
          s.vy += 0.09 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.a -= 0.016 * dt;
          s.r -= 0.009 * dt;
          /*
           * 물튀김은 수면에서만 산다 — 수면보다 14px 넘게 올라가면 지우고(공중에 뜬
           * 동그라미가 남지 않게), 내려오다 수면 아래로 가면 물에 다시 들어간 것이다.
           * 그 x 자리의 수면을 재므로 물결을 따라다닌다.
           */
          const wy = this.waveY(s.x);
          if (s.a <= 0 || s.r <= 0 || s.y < wy - 14 || (s.vy > 0 && s.y > wy)) this.spray.splice(i, 1);
        }

        for (let i = this.rings.length - 1; i >= 0; i--) {
          const p = this.rings[i];
          p.r += 0.5 * dt;
          p.a -= 0.01 * dt;
          p.age += dt / 60;
          if (p.a <= 0) this.rings.splice(i, 1);
        }

        /*
         * 수위는 방울이 닿는 순간 튀지 않는다 — target만 오르고 실제 수면이 그것을 천천히
         * 따라간다. 그냥 더하면 방울마다 팅 튀어 위아래로만 움직여 보인다.
         */
        this.target = Math.max(6, this.target - (this.target * 0.006 + 0.02) * dt);
        this.level += (this.target - this.level) * (1 - Math.pow(0.95, dt));
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

        for (const d of this.drops) {
          const wd = d.wd + (1 - d.life) * 3.5;
          ctx.globalAlpha = (0.2 + d.z * 0.34) * d.life;
          ctx.drawImage(this._sp, d.x - wd / 2, d.y, wd, d.len);
        }
        ctx.globalAlpha = 1;

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
