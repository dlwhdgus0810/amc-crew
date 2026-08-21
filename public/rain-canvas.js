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

  /*
   * 방울 하나가 수위를 올리는 높이(px). **차오르는 속도가 곧 이 값이다.**
   *
   * 5였다. 208px짜리 카드가 2~4초에 차서 너무 빨랐다 — 물이 차오르는 것을 보는 맛이
   * 없었다. 2.5면 그 두 배인 4~8초가 걸린다.
   *
   * 쏟는 방울 수도 이 값으로 나눠 세므로, 낮추면 한 번에 쏟는 방울이 그만큼 많아진다.
   * 들어온 만큼 그대로 나가는 것은 어느 값에서나 같다.
   */
  const RISE = 2.5;

  /*
   * 잠긴 글씨 위를 덮는 물의 농도.
   *
   * 물이 카드 끝까지 차므로 제목·부제목·날짜 줄이 다 잠긴다. 재 보니 가장 밝은 카드에서
   * 크림색 글씨가 AA 기준(4.5:1)을 지키는 한계 농도가 0.087이다. 0.07이면 4.7:1쯤이라
   * 여유가 조금 남는다. 대신 바닥 16px만 0.32로 진하게 칠해 물의 무게를 남긴다 —
   * 거기는 어떤 글씨도 없다(아래줄 글씨가 바닥에서 19px부터다).
   */
  const SHALLOW = 0.07;

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

        this.drops = [];
        this.spray = [];
        this.rings = [];
        /*
         * 카드를 다 지난 방울 — 배경(public/rain-field.js)이 매 프레임 가져가서 카드 아래
         * 모서리에서 다시 떨어뜨린다. 한 방울이 들어오면 한 방울이 나가므로 화면 전체의
         * 비 밀도가 그대로다.
         *
         * 배경이 안 가져가는 동안(카드가 화면 밖으로 나가 목록에서 빠졌을 때) 쌓이지
         * 않게 열둘에서 끊는다. 목록은 반 초에 한 번 다시 만들므로 그 사이에 열둘을
         * 넘길 일은 없다.
         */
        this.spill = [];
        /*
         * 이 카드가 물을 얼마나 받아 두는 성격인가 — **한 번 정하면 그대로 간다.**
         *
         * 쏟을 때마다 새로 뽑았더니 카드에 성격이 없었다. 어느 카드든 어떤 때는 조금
         * 차서 쏟고 어떤 때는 많이 차서 쏟으니, 보는 눈에는 그냥 「덜 찼는데 떨어진다」로
         * 읽힌다. 카드마다 정해 두면 저 카드는 늘 그득해질 때까지 참고 이 카드는 금방
         * 비우는 것이 보인다.
         *
         * 0.7제곱은 위쪽으로 쏠리게 한다. 고르게 뽑으면 절반이 60% 밑에서 쏟아서 물이
         * 차오르는 것을 볼 새가 없다 — 이러면 가운데가 68%쯤이고 열 장 중 서넛은
         * 85%를 넘겨 거의 그득해질 때까지 받아 둔다.
         */
        this.dumpBase = 0.3 + Math.pow(Math.random(), 0.7) * 0.5;
        this.dumpAt = this.nextDumpAt();
        /** 지금 물이 빠지는 중인가 */
        this.draining = false;
        this.pourAcc = 0;
        /*
         * 4분의 1쯤 차 있는 채로 시작한다.
         *
         * 완전히 빈 채로 시작하면 첫 번째로 쏟기까지 아랫줄이 그만큼 오래 마르다.
         * 그렇다고 절반부터 시작하면 쏟는 지점이 30~90%라, 그보다 낮게 뽑힌 카드가
         * 열자마자 쏟아 버린다. 4분의 1은 그 아래라 잠깐 차오르는 것이 먼저 보인다.
         *
         * 값은 fit에서 정한다 — 카드 높이를 알아야 한계를 안다.
         */
        this.level = null;
        this.target = null;
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
        /* 높이를 알기 전(레이아웃 전)에는 못 정한다 — 0으로 굳으면 물이 영영 안 찬다 */
        if (this.level == null && this.h > 0) this.level = this.target = this.cap() * 0.1;
        this.readTint();
        this.sprite();
      }

      /**
       * 물이 찰 수 있는 한계 — 카드 높이의 10%다. 「몇 % 찼나」는 늘 이걸 기준으로 한다.
       *
       * 28%였다. 그때는 물이 한계의 21%에서 놀아서 실제 수면이 12px이라 상관없었는데,
       * 이제 수위가 넘기는 양을 정하느라 한계의 55~70%까지 올라온다. 28%를 그대로 두면
       * 수면이 40px이 되어 **아래줄 글씨가 물에 잠긴다** — 카드 바닥에서 19~23px에 있는
       * 그 줄의 대비가 3.39:1까지 떨어졌다 (AA 기준 4.5 미달).
       *
       * 카드 높이 그대로다. 「몇 % 찼나」는 곧 카드의 몇 %가 물에 잠겼나다 — 제목도
       * 부제목도 잠긴다. 물을 아주 옅게 칠해서(draw 참고) 잠겨도 다 읽힌다.
       */
      cap() {
        return this.h;
      }

      /**
       * 고인 물을 **한 번에 쏟는다** — 받아 둔 만큼이 그대로 아래 카드로 내리는 비가 된다.
       *
       * 방울 하나가 수위를 2 올리므로 쏟는 방울 수는 수위의 절반이다. 들어온 만큼만
       * 내보내는 셈이라 아래로 갈수록 비가 불거나 마르지 않는다. 한계의 30%에서 쏟으면
       * 두어 방울, 90%까지 기다렸다 쏟으면 예닐곱 방울이 쏟아진다.
       *
       * 한 프레임에 다 뱉지 않고 두 프레임에 하나씩 내보낸다. 한꺼번에 뱉으면 같은
       * 높이에 줄기가 나란히 서서 비가 아니라 빗금 한 줄로 보인다.
       */
      /** 제 성격 언저리에서 한 번 흔든다 — 똑같은 높이에서 기계처럼 쏟지 않게 */
      nextDumpAt() {
        return Math.min(0.82, Math.max(0.28, this.dumpBase + (Math.random() - 0.5) * 0.08));
      }

      /** 쏟아지는 방울 하나 — 카드 아래 어디서 떨어질지는 그때 정한다 */
      pourDrop() {
        if (this.spill.length >= 24) return;
        const z = 0.45 + Math.random() * 0.55;
        this.spill.push({
          x: Math.random() * this.w,
          z,
          vy: (2.45 + Math.random() * 3.15) * (0.6 + z * 0.8),
          len: (16 + Math.random() * 18) * z,
          wd: 1 + z * 0.9,
        });
      }

      /*
       * 방울을 사각형으로 그리면 1자가 된다. 위가 투명하고 아래로 진해지는 줄기 하나를 미리
       * 그려 두고 방울마다 늘여 그린다. 가장자리를 약하게 둔 다음 넓게 키우면 흐려지는
       * 방울이 뿌옇게 보이는 효과가 공짜로 생긴다.
       */
      sprite() {
        this._sp = this.makeSprite(this.tint, this._sp);
        /* 카드 색이 바뀌면 넘어온 색으로 그려 둔 것도 다시 만들게 둔다 */
        this._outTint = null;
      }

      /** 넘어온 방울이 처음에 입고 들어오는 색 — 배경 비의 색이다 (public/rain-field.js) */
      outSprite(tint) {
        if (this._outTint !== tint) {
          this._spo = this.makeSprite(tint, this._spo);
          this._outTint = tint;
        }
        return this._spo;
      }

      makeSprite(tint, canvas) {
        const s = canvas || document.createElement('canvas');
        s.width = 6;
        s.height = 80;
        const g = s.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, 80);
        grad.addColorStop(0, 'rgba(' + tint + ',0)');
        grad.addColorStop(1, 'rgba(' + tint + ',1)');
        g.clearRect(0, 0, 6, 80);
        g.fillStyle = grad;
        g.globalAlpha = 0.35;
        g.fillRect(1, 0, 1, 80);
        g.fillRect(4, 0, 1, 80);
        g.globalAlpha = 1;
        g.fillRect(2, 0, 2, 80);
        return s;
      }

      /**
       * 배경에서 내려오던 방울을 넘겨받는다 (public/rain-field.js).
       *
       * **속도·길이·폭·원근을 그대로 이어받는 것이 핵심이다.** 하나라도 다르면 카드 위
       * 가장자리에서 방울이 튀거나 굵기가 바뀌어서, 넘어온 티가 난다. 여기서 새로 정하는
       * 것은 「이 방울이 물까지 갈지」 하나뿐이다 — 뒤쪽 방울은 대개 중간에 흐려지며
       * 사라지고, 닿은 방울에만 물튀김과 파문이 생긴다.
       *
       * 마흔 개에서 끊는다. 카드가 화면을 거의 다 덮을 때 넘어오는 양이 많아지는데,
       * 그만큼 다 그려도 보기에 달라지는 것이 없다.
       *
       * d.y는 **줄기의 위 끝**이다(여기서는 y에서 y+len까지 그린다). 배경 쪽은 아래 끝을
       * 기준으로 들고 있어서 넘길 때 len을 빼서 준다 — public/rain-field.js가 한다.
       * 넘어오는 순간 y는 음수다: 줄기가 카드 위 선에 걸쳐 있고 위쪽은 배경이 그린다.
       */
      adopt(d) {
        if (!this.drops || this.drops.length > 40) return false;
        const fades = d.z < 0.74 && Math.random() < 0.8;
        /*
         * 넘겨준 쪽이 이번 프레임을 이미 돌았고 이쪽은 아직이면, 이 방울은 **이번
         * 프레임에 한 번 쉰다.** 안 그러면 곧바로 이어지는 이쪽 step에서 한 번 더
         * 움직여 원본보다 한 프레임 앞서 간다 (rain-field.js의 t 주석 참고).
         *
         * 두 캔버스가 도는 순서에 기대지 않는다. 같은 프레임이면 rAF가 주는 시각이
         * 서로 같으므로, 큰 쪽이 「아직 안 돈 쪽」이다.
         */
        const wait = d.t != null && d.t > this.last;
        this.drops.push({
          x: d.x,
          y: d.y,
          z: d.z,
          life: 1,
          vy: d.vy,
          len: d.len,
          wd: d.wd,
          /* 들어올 때 입고 있던 색 — 카드 색과 다르면 draw가 서서히 갈아입힌다 */
          from: d.tint && d.tint !== this.tint ? d.tint : null,
          wait,
          fadeAt: fades ? this.h * (0.3 + Math.random() * 0.45) : Infinity,
        });
        return true;
      }

      /**
       * **물에 닿지 못하고 흐려진** 방울을 배경에 돌려보낸다 — 그대로 지나가는 잔비다.
       *
       * 흐려지는 것은 「멀리 있는 비」라는 뜻이지 없어졌다는 뜻이 아니라서, 여기서 빼면
       * 그만큼 아래로 갈 비가 사라진다. 물에 닿은 방울은 이리로 안 온다 — 그건 카드에
       * 고였다가 dump가 한꺼번에 내보낸다.
       */
      spillOut(d) {
        if (this.spill.length >= 12) return;
        this.spill.push({ x: d.x, z: d.z, vy: d.vy, len: d.len, wd: d.wd });
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

        for (let i = this.drops.length - 1; i >= 0; i--) {
          const d = this.drops[i];
          /* 넘어온 첫 프레임 — 배경이 이미 옮겨 준 몫이라 여기서 또 옮기면 앞서 간다 */
          if (d.wait) {
            d.wait = false;
            continue;
          }
          d.y += d.vy * dt;
          if (d.y > d.fadeAt) {
            d.life -= 0.035 * dt;
            /* 물에 닿지 않고 사라지므로 물튀김도 파문도 없다 — 그래도 아래로는 내려간다 */
            if (d.life <= 0) { this.spillOut(d); this.drops.splice(i, 1); continue; }
          }
          /*
           * 방울의 **끝점**으로 잰다. 위쪽 끝으로 재면 줄기가 수면을 지나 카드 밑까지 보인다.
           * 평평한 수위 대신 그 x 자리의 실제 물결 높이를 쓴다 — 수면이 일렁이므로
           * 파문이 이는 자리도 같이 움직여야 한다.
           */
          const sy = this.waveY(d.x);
          if (d.y + d.len < sy) continue;
          this.drops.splice(i, 1);
          /*
           * 방울 하나가 목표 수위를 이만큼 올린다.
           *
           * 한계에서 자르지 않는다. 보이는 수면(level)은 목표를 천천히 따라가느라 늘
           * 조금 뒤처지는데, 그 사이에 목표를 한계에서 잘라 버리면 **들어온 물이 그냥
           * 사라진다** — 재 보니 받은 것의 24%가 그렇게 없어져서 아래로 갈수록 비가
           * 말랐다. 어차피 쏟는 지점이 한계의 90%까지라 목표가 그 위로 오래 머물지
           * 않는다. 위의 값은 혹시 모를 폭주만 막는 울타리다.
           */
          this.target = Math.min(this.cap(), this.target + RISE);
          /*
           * 물에 닿은 방울은 여기서 **고인다.** 아래로는 안 내려간다 — 카드가 물을
           * 받아 두었다가 어느 만큼 차면 한 번에 쏟는다 (아래 dump 참고).
           *
           * 중간에 흐려진 방울은 물에 닿지도 않았으니 그대로 지나간다. 카드가 가둘
           * 이유가 없고, 이것이 쏟는 사이사이의 잔비가 된다.
           */
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
              /*
               * **수면을 타고** 퍼진다. 가로로만 실제 속도를 주고, 세로는 수면에서 얼마나
               * 떴는지(lift)만 들고 있다 — 자리는 매 프레임 waveY(x)에서 그만큼 위로 잡는다.
               *
               * 그래서 입자가 바깥으로 갈수록 그 자리 물결의 높낮이를 그대로 탄다. vy로
               * 날리면 태어난 자리의 높이만 기억한 채 포물선으로 날아가서, 물결이
               * 일렁이는데 물튀김만 딴 데 떠 있게 된다.
               */
              vx: (Math.random() * 2 - 1) * 2.2 * spread,
              lift: 0,
              vlift: (0.55 + Math.random() * 0.75) * spread,
              r: (0.5 + Math.random() * 0.5) * (0.7 + spread * 0.4),
              a: 0.7,
            });
          }
          /*
           * 파문도 **이 방울의 spread를 따라간다.**
           *
           * 전에는 모든 파문이 똑같이 자라서, 거의 안 튄 방울에도 카드 폭의 40%짜리
           * 고리가 붙었다. 물튀김은 방울마다 크기가 다른데 파문만 늘 같으니 둘이
           * 따로 놀았고, 그게 「파문이 너무 크다」로 보이던 것이다.
           *
           * grow는 프레임당 반지름 증가분, w는 수면이 우묵해지는 폭이다. 우묵해지는
           * 쪽을 보이는 고리보다 조금 넓게 둔다 — 물은 마루가 서는 자리보다 넓게 꺼진다.
           */
          this.rings.push({
            x: d.x,
            r: 1.5,
            a: 0.5,
            age: 0,
            grow: 0.14 + spread * 0.18,
            w: 9 + spread * 6,
          });
        }

        for (let i = this.spray.length - 1; i >= 0; i--) {
          const s = this.spray[i];
          s.x += s.vx * dt;
          s.a -= 0.016 * dt;
          s.r -= 0.009 * dt;
          /*
           * 뜬 높이만 굴리고 **자리는 물결에서 잡는다.** 그래서 바깥으로 퍼지는 동안 그
           * 자리 수면의 높낮이를 그대로 탄다 — 물결이 일렁이면 물튀김도 같이 일렁인다.
           * 다시 수면에 닿으면(lift <= 0) 물에 들어간 것이다.
           */
          s.vlift -= 0.09 * dt;
          s.lift += s.vlift * dt;
          s.y = this.waveY(s.x) - s.lift;
          if (s.a <= 0 || s.r <= 0 || s.lift <= 0) this.spray.splice(i, 1);
        }

        for (let i = this.rings.length - 1; i >= 0; i--) {
          const p = this.rings[i];
          p.r += p.grow * dt;
          /* 0.01이면 50프레임(833ms) 산다 — 그동안 계속 자라서 끝이 너무 커졌다 */
          p.a -= 0.0125 * dt;
          p.age += dt / 60;
          if (p.a <= 0) this.rings.splice(i, 1);
        }

        /*
         * 수위는 방울이 닿는 순간 튀지 않는다 — target만 오르고 실제 수면이 그것을 천천히
         * 따라간다. 그냥 더하면 방울마다 팅 튀어 위아래로만 움직여 보인다.
         */
        /*
         * 새는 양. 예전에는 L*0.006 + 0.02였는데, 그러면 지금 오는 비로 수위가 한계의
         * 21%에서 평형이라 30%에 **영영 못 닿는다** — 아래로 한 방울도 안 넘어간다.
         * 이제 넘기는 것이 물이 빠지는 주된 길이고, 새는 것은 곁다리다.
         *
         * 물이 빠지는 주된 길은 이제 **쏟는 것**이라 새는 양은 아주 작다. 크면 받아 둔
         * 물이 쏟기 전에 새어 나가서 아래로 갈수록 비가 마른다 — 예전 값(L*0.006+0.02)
         * 이면 한 번 차는 동안 받은 것의 28%가 새어 없어진다.
         *
         * 0으로 안 두는 이유는 비가 그쳤을 때다(다른 화면으로 갔다 오면 그렇다).
         * 그때 물이 그대로 남아 있으면 돌아오자마자 쏟는다.
         */
        this.target = Math.max(0, this.target - (this.target * 0.0001 + 0.0002) * dt);
        /*
         * 물의 양은 target 하나다. 비가 오면 오르고 빠지면 내린다. 보이는 수면(level)은
         * 그걸 부드럽게 따라간다 — 방울마다 팅 튀지 않게.
         *
         * 예전에는 빠지는 동안 target을 0으로 비워 두고 level만 따로 내렸다. 그러면
         * 빠지는 동안 들어온 비가 target에 몰래 쌓여서, 다 빠진 순간 수면이 그 높이까지
         * 한 번에 튀어 올랐다 — 재 보니 6초에 걸쳐 빠뜨려 놓고 1.3초 만에 도로 찼다.
         */
        this.level += (this.target - this.level) * (1 - Math.pow(0.95, dt));

        if (this.draining) {
          /*
           * **서서히 빠진다.** 그리고 빠져나간 만큼이 그대로 아래로 내리는 비가 된다.
           *
           * 깊이에 비례해 빠뜨리므로 처음에는 콸콸, 끝에서는 졸졸이다. 방울도 프레임마다
           * 정해 뱉지 않고 빠져나간 양에 맞춰 뱉어서 비가 같이 잦아든다.
           *
           * 최소치가 들어오는 비보다 커야 한다. 비례만으로 두면 얕아졌을 때 빠지는 양이
           * 들어오는 양과 같아져서 거기서 멈춘다 — 30px 언저리에서 영영 안 마른다.
           */
          const out = Math.max(0.45, this.target * 0.0075) * dt;
          this.target = Math.max(0, this.target - out);
          this.pourAcc += out / RISE;
          while (this.pourAcc >= 1) {
            this.pourAcc -= 1;
            this.pourDrop();
          }
          if (this.target <= 1) {
            this.draining = false;
            this.dumpAt = this.nextDumpAt();
          }
        } else if (this.h > 0 && this.level >= this.dumpAt * this.cap()) {
          /* h가 0이면 한계도 0이라 「다 찼다」가 늘 참이 된다 — 레이아웃 전에는 안 빠진다 */
          this.draining = true;
        }
      }

      /** x 자리의 수면 높이 */
      waveY(x) {
        let y =
          this.h - this.level +
          Math.sin(x * 0.055 + this.t * 1.7) * 1.7 +
          Math.sin(x * 0.021 - this.t * 1.1) * 2.5;
        /* 방울이 떨어진 자리만 우묵해졌다 되살아난다 — 멀어질수록, 시간이 지날수록 잦아든다 */
        for (const p of this.rings) {
          const d = (x - p.x) / p.w;
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
          const a = (0.2 + d.z * 0.34) * d.life;
          /*
           * 넘어온 방울은 **배경 색으로 들어와 카드 색으로 물든다.**
           *
           * 카드 밖 비는 밝은 페이지 위라 짙은 청회색이고 카드 안 비는 어두운 카드 위라
           * 크림이다 — 어느 한쪽으로 통일할 수가 없다. 그래서 카드 위 선에서 색이 딱
           * 갈리는데, 그게 굵기가 변한 것처럼 보인다. 줄기 길이의 두 배쯤 내려오는 동안
           * 갈아입히면 어디서 바뀌었는지 짚을 수 없게 된다.
           */
          const b = d.from ? Math.min(1, Math.max(0, (d.y + d.len) / (d.len * 2.2))) : 1;
          if (b < 1) {
            ctx.globalAlpha = a * (1 - b);
            ctx.drawImage(this.outSprite(d.from), d.x - wd / 2, d.y, wd, d.len);
          }
          ctx.globalAlpha = a * b;
          ctx.drawImage(this._sp, d.x - wd / 2, d.y, wd, d.len);
        }
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, this.waveY(0));
        for (let x = 4; x <= w; x += 4) ctx.lineTo(x, this.waveY(x));
        ctx.lineTo(w, h);
        ctx.closePath();
        /*
         * 물은 **수면 쪽이 거의 투명하고 바닥 쪽만 진하다.**
         *
         * 예전에는 어디나 0.24로 고르게 칠했다. 그때는 물이 16px밖에 안 차서 상관없었는데,
         * 이제 40px까지 차오르면서 아래줄의 날짜·장소 글씨(카드 바닥에서 19~41px)가
         * 물에 잠긴다. 고른 0.24로 잠기면 그 줄의 대비가 3.39:1까지 떨어진다 —
         * AA 기준 4.5 미달이다. 재 보니 그 자리에서 버틸 수 있는 농도가 0.087이다.
         *
         * 그래서 절반 지점까지 0.06으로 눌러 두고 바닥에서만 0.34로 올린다. 글씨가
         * 앉는 자리는 0.06 언저리라 읽는 데 지장이 없고, 바닥은 예전(0.24)보다 오히려
         * 진해서 물이 깊어 보인다.
         */
        const span = Math.max(1, this.level);
        const surf = h - span;
        const water = ctx.createLinearGradient(0, surf, 0, h);
        water.addColorStop(0, 'rgba(' + tint + ',0)');
        /* 수면에서 8px 안쪽부터 제 농도 — 가장자리만 부드럽게 사라진다 */
        if (span > 20) water.addColorStop(Math.min(0.4, 8 / span), 'rgba(' + tint + ',' + SHALLOW + ')');
        /* 바닥 18px만 진하다 — 아래줄 글씨가 바닥에서 19px부터라 거기까지는 비어 있다 */
        if (span > 26) water.addColorStop((span - 18) / span, 'rgba(' + tint + ',' + SHALLOW + ')');
        water.addColorStop(1, 'rgba(' + tint + ',0.32)');
        ctx.fillStyle = water;
        ctx.fill();

        /*
         * **수면에 선을 긋는다.**
         *
         * 물 자체는 0.07까지 옅게 눌러 놨다 — 그보다 진하면 잠긴 글씨가 AA 기준 밑으로
         * 떨어진다. 그런데 그 농도로는 물이 어디까지 찼는지가 눈에 안 들어온다. 선 하나면
         * 수위가 또렷해진다. 1.5px짜리 가로선이라 글씨를 가리는 넓이가 없다.
         */
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, this.waveY(0));
        for (let x = 4; x <= w; x += 4) ctx.lineTo(x, this.waveY(x));
        ctx.strokeStyle = 'rgba(' + tint + ',0.38)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        ctx.lineWidth = 1;
        for (const p of this.rings) {
          /*
           * 파문을 ellipse로 그리면 평평한 타원이 된다 — 수면은 일렁이는데 파문만 반듯해서
           * 물 위가 아니라 물 앞에 떠 있는 것처럼 보인다.
           *
           * 대신 좌우로 훑으면서 그 자리의 waveY를 잡고, 거기서 위아래로 부풀린다.
           * 고리의 가운데 선이 물결을 그대로 타므로 수면에 얹힌 것으로 보인다.
           */
          const rx = p.r * 2.4;
          const ry = p.r * 0.7;
          ctx.strokeStyle = 'rgba(' + tint + ',' + p.a.toFixed(3) + ')';
          const STEP = 14;
          ctx.beginPath();
          for (let k = 0; k <= STEP; k++) {
            const f = k / STEP;
            const x = p.x - rx + 2 * rx * f;
            const y = this.waveY(x) - ry * Math.sin(Math.PI * f);
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let k = STEP; k >= 0; k--) {
            const f = k / STEP;
            const x = p.x - rx + 2 * rx * f;
            ctx.lineTo(x, this.waveY(x) + ry * Math.sin(Math.PI * f));
          }
          ctx.closePath();
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
