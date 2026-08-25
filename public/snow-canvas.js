/*
 * 겨울 「눈」 — 카드 위에 눈이 실제로 쌓입니다. public/rain-canvas.js와 같은 방식이고
 * (카드마다 하나, 안 보이면 멈춤, dt로 프레임 보정, reduced-motion에서 정지) 다른 것은
 * 고인 물이 **수위 하나**였던 반면 눈은 **가로 위치마다 높이가 다른 줄**이라는 점입니다.
 * 그래서 CSS로는 흉내조차 안 됩니다 — season.css의 눈 봉우리는 곡률로 그린 여섯 개라
 * 어디에 눈이 내렸는지와 아무 관계가 없습니다.
 *
 * 규칙 넷이 전부입니다.
 *
 *  앉음   눈송이가 표면에 닿으면 그 칸 높이가 r²×1.6 ÷ 6px만큼 늘고, 옆 두 칸에도
 *         4분의 1씩 나눈다.
 *  다짐   매 프레임 0.04% 줄어든다. 가장자리는 11px에서 멈추고(cap), 넘치는 만큼은
 *         버리지 않고 카드 안쪽으로 흘러 들어간다. 안쪽은 0.02%씩 다져진다.
 *  무너짐 옆 칸과 3px 이상 벌어지면 차이의 절반을 흘려 보낸다. 쌓인 눈은 실제로 이렇게
 *         평평해진다. 이것이 없으면 눈송이가 몰린 자리에 기둥이 선다.
 *  끝     양 끝 14px은 높이를 눌러 둔다 — 카드 곡률(13px) 위로 눈이 떠 보인다.
 *
 * 처음 높이를 9px로 깔아 둡니다. 화면을 열고 눈이 쌓일 때까지 20초를 기다리게 할 수는
 * 없습니다.
 *
 * 붙이는 곳: app/category-card.tsx에서 겨울 테마일 때만 <snow-canvas> 하나.
 * 자리 잡는 style은 app/season.css가 맡습니다(카드 위로 90px).
 */
if (!customElements.get('snow-canvas')) customElements.define('snow-canvas', class extends HTMLElement {
  connectedCallback() {
    /*
     * 다시 붙을 때는 처음부터 만들지 않고 **루프와 관찰자를 되살린다.**
     *
     * disconnectedCallback이 rAF를 끊고 ResizeObserver·IntersectionObserver를 떼 놓는데,
     * 그냥 돌아가면 그 셋 다 안 돌아온다. 그러면 이 카드는 영영 멈춘 채로 남는다 —
     * 폭을 다시 재는 것도 ResizeObserver와 루프 안에 있어서 this.w가 0으로 굳고,
     * 칸이 여덟 개(최소값)에 머문다.
     *
     * 실제로 그랬다. React가 화면을 흘려보내며(streaming) 카드를 제자리에 꽂을 때
     * 노드를 옮기는데, 옮기는 동안 disconnect → connect가 일어난다. 상점 미리보기에서
     * 눈이 하나도 안 쌓이던 것이 이것이었다 — 재 보니 카드 폭은 354인데 this.w는 0,
     * 칸은 여덟이었다. 같은 화면의 <rain-canvas>는 354로 제대로 잡혀 있었다.
     * public/rain-canvas.js는 카드를 끌어 순서를 바꿀 때 같은 일을 겪고 이미 이렇게
     * 되살리고 있었는데, 이 파일이 나중에 나오면서 그 대목만 빠졌다.
     *
     * last를 지우는 것은 dt 때문이다 — 떨어져 있던 시간이 그대로 dt가 되면 돌아오는
     * 첫 프레임에 눈이 뛴다 (2.5로 잘리긴 하지만 그것도 눈에 띈다).
     */
    if (this._on) {
      this.last = 0;
      if (this.ro) this.ro.observe(this);
      if (this.io) this.io.observe(this);
      this.fit();
      if (this.still) this.draw(); else this.loop();
      return;
    }
    this._on = true;
    const root = this.attachShadow({ mode: 'open' });
    this.cv = document.createElement('canvas');
    Object.assign(this.cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    root.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.tint = this.getAttribute('tint') || '255,255,255';
    this.snow = this.getAttribute('snow') || '251,253,254';
    this.rate = +(this.getAttribute('rate') || 0.2);
    this.ledge = +(this.getAttribute('ledge') || 90);
    this.max = +(this.getAttribute('max') || 11);
    this.inMax = +(this.getAttribute('inside') || 5);
    this.flMax = +(this.getAttribute('floor') || 14);
    /* 캔버스가 카드 아래로 나가 있는 만큼 — 그 위가 카드 바닥이다 */
    this.skirt = +(this.getAttribute('skirt') || 70);
    /* 눈송이 하나가 대신하는 양 — land 주석 참고 */
    this.heft = +(this.getAttribute('heft') || 2.6);
    this.flakes = []; this.slabs = [];
    /* 카드 밖으로 쓸려 나간 눈 — 배경이 매 프레임 가져간다 (public/snow-field.js) */
    this.spill = [];
    this.vis = true;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(this);
    this.io = new IntersectionObserver((e) => { this.vis = e[0].isIntersecting; }, { threshold: 0 });
    this.io.observe(this);
    this.fit();
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.still) this.draw(); else this.loop();
  }
  disconnectedCallback() { cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect(); this.io && this.io.disconnect(); }
  fit() {
    const r = this.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.max(1, Math.round(this.w * this.dpr));
    this.cv.height = Math.max(1, Math.round(this.h * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.floorY = this.h - this.skirt;
    /* 칸 하나가 6px. 더 좁으면 봉우리가 톱니처럼 뾰족해지고, 넓으면 계단이 보인다 */
    const n = Math.max(8, Math.round(this.w / 6));
    /*
     * **카드 모서리를 따라 앉는다.**
     *
     * 눈더미 바닥이 한 줄로 곧게 그어져 있었다. 카드는 네 귀퉁이가 둥근데(--card-r,
     * 겨울은 13px) 눈은 그 위를 1자로 가로지르니, 귀퉁이 쪽에서는 카드가 없는 허공에
     * 눈이 얹혀 붕 떠 보였다.
     *
     * 칸마다 「그 x에서 카드 윗면이 얼마나 내려가 있는가」를 구해 둔다. 반지름 R짜리
     * 둥근 모서리는 가장자리에서 d만큼 들어온 자리에서 R - √(R² - (R-d)²)만큼 내려가
     * 있다. 가장자리(d=0)에서 R, R만큼 들어오면 0이다.
     *
     * 위 눈더미와 바닥 눈이 이 값을 함께 쓴다 — 아래 귀퉁이도 같은 곡률이다.
     */
    const rr = parseFloat(getComputedStyle(this.parentElement || this).borderTopLeftRadius) || 0;
    /*
     * 양 끝(x=0, x=w)은 칸 가운데가 아니라 진짜 귀퉁이다 — 거기서는 R만큼 내려가 있다.
     * 칸 가운데로만 그리면 첫 칸이 3px 자리라 4.7px밖에 안 내려가서, 제일 바깥 8px이
     * 그대로 허공에 남는다.
     */
    this.dipEdge = rr;
    this.dip = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * this.w;
      const d = Math.min(x, this.w - x);
      this.dip[i] = d < rr ? rr - Math.sqrt(Math.max(0, rr * rr - (rr - d) * (rr - d))) : 0;
    }
    if (!this.hs || this.hs.length !== n) {
      this.hs = new Float32Array(n);
      this.ins = new Float32Array(n);
      this.fl = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        this.hs[i] = 9 + Math.sin(i * 0.7) * 2 + Math.random() * 2.5;
        /* 바닥에도 조금 깔아 둔다 — 카드 안에 눈이 앉기까지 30초를 기다릴 수는 없다 */
        this.fl[i] = 4 + Math.sin(i * 0.5) + Math.random() * 1.5;
      }
    }
    if (this.still) this.draw();
  }
  loop(rt) {
    this.raf = requestAnimationFrame((t) => this.loop(t));
    /*
     * 반 초에 한 번 크기를 다시 잰다.
     *
     * 붙을 때 한 번만 재면 카드가 아직 안 그려진 동안 폭이 0이라 칸이 여덟 개로 굳는다
     * (344px 카드면 쉰넷이어야 한다). ResizeObserver가 있는데도 그랬다 — 재 보니 w가
     * 0인 채로 남아 있었다. 배경 비도 같은 데서 걸렸다(public/rain-field.js).
     */
    if ((this.tick = (this.tick || 0) + 1) % 30 === 0 && this.w !== this.getBoundingClientRect().width) this.fit();
    if (!this.vis || !this.w) return;
    /* 60Hz 한 프레임을 1로 본 배수. 2.5로 자르는 것은 탭을 다른 곳에 뒀다 돌아올 때
       눈이 한 번에 순간이동하지 않게 하려는 것이다 */
    const dt = this.last ? Math.min(2.5, (rt - this.last) / 16.667) : 1;
    this.last = rt;
    this.step(dt); this.draw();
  }
  bin(x) { return Math.max(0, Math.min(this.hs.length - 1, Math.floor((x / this.w) * this.hs.length))); }
  cap(i) {
    const x = ((i + 0.5) / this.hs.length) * this.w;
    return this.max * Math.max(0, Math.min(1, Math.min(x, this.w - x) / 14));
  }
  /**
   * 이 x 자리의 눈더미 표면 — 캔버스 안쪽 좌표다 (배경이 물어본다).
   *
   * 눈송이를 넘겨받지 않고 **표면에 닿았는지만 알려 주는** 이유는 겹쳐 보이기 때문이다.
   * 넘겨받아 여기서도 그리면, 카드 위 90px 구간은 카드가 가리지 않으므로 같은 눈송이가
   * 두 개로 보인다. 비는 카드 위 선 위쪽을 배경만 그려서 문제가 없었지만 눈은 그 위에
   * 더미가 있어서 선이 더 높다.
   */
  surfaceY(x) {
    if (!this.w || !this.hs) return null;
    const i = this.bin(x);
    /* 귀퉁이에서는 카드 윗면이 내려가 있으므로 눈더미 표면도 그만큼 내려간다 */
    return this.ledge + (this.dip ? this.dip[i] : 0) - this.hs[i];
  }

  /**
   * 눈송이 하나가 여기 앉았다 — 배경이 부른다.
   *
   * heft는 **눈송이 하나가 대신하는 양**이다. 화면 전체에 뿌리면 그중 카드에 닿는 것은
   * 넷에 하나꼴이라, 예전처럼 카드마다 따로 뿌리던 때와 같은 속도로 쌓으려면 그만큼
   * 무겁게 쳐야 한다. 눈송이 수를 늘려서 맞추면 화면에 천 개가 떠다닌다(재 봤다).
   */
  land(x, r) {
    const hs = this.hs;
    if (!hs || !this.w) return;
    const i = this.bin(x);
    const unit = this.w / hs.length;
    const m = (r * r * 1.6 * this.heft) / unit;
    hs[i] += m;
    if (i > 0) hs[i - 1] += m * 0.25;
    if (i < hs.length - 1) hs[i + 1] += m * 0.25;
  }
  step(dt) {
    const { w, h, hs } = this;
    const ins = this.ins;
    /* 가장자리 높이는 cap()에서 멈추고, **넘치는 만큼은 버리지 않고 카드 안으로 흘러
       들어간다**. 양 끝 눌러진 칸은 물리지 않는다 — 그러면 안쪽 눈이 네 군데 구석에만 쌓여
       띠가 아니라 조각이 된다. 눈은 쌓이다 못하면 안쪽으로 무너진다. */
    for (let i = 0; i < hs.length; i++) {
      hs[i] *= 1 - 0.0004 * dt;
      const c = this.cap(i);
      if (hs[i] > c) { if (c >= this.max - 0.01) ins[i] += hs[i] - c; hs[i] = c; }
      /* 안쪽 눈도 다져진다 — 가장자리의 절반 속도다 */
      ins[i] *= 1 - 0.0002 * dt;
    }
    for (let i = 0; i < hs.length - 1; i++) {
      const d = hs[i] - hs[i + 1];
      if (Math.abs(d) > 3) { const m = (d - Math.sign(d) * 3) * 0.5; hs[i] -= m; hs[i + 1] += m; }
      /* 안쪽은 2px에서 무너진다 — 얹힌 것이 아니라 미끄러운 면에 앉은 것이다 */
      const e = ins[i] - ins[i + 1];
      if (Math.abs(e) > 1.5) { const m = (e - Math.sign(e) * 1.5) * 0.5; ins[i] -= m; ins[i + 1] += m; }
    }
    /*
     * 떨어짐 — 안쪽 눈이 inMax(5px)를 넘은 칸이 다섯 칸(30px) 이상 이어지면 그 구간이
     * 덩어리로 떨어진다. 한 칸씩 떨어뜨리면 눈이 흩어지는 것처럼 보이고 무게가 없다.
     * 떨어진 자리는 0이 아니라 1px쯤 남는다 — 눈은 깨끗하게 떨어지지 않는다.
     */
    let run = 0;
    for (let i = 0; i <= ins.length; i++) {
      if (i < ins.length && ins[i] >= this.inMax) { run++; continue; }
      if (run >= 5) {
        const a = i - run, b = i - 1;
        let sum = 0;
        for (let k = a; k <= b; k++) { sum += ins[k]; ins[k] = 0.8 + Math.random() * 0.6; }
        this.slabs.push({ a, b, th: sum / run, y: 0, vy: 0.35, rot: (Math.random() - 0.5) * 0.5 });
      }
      run = 0;
    }
    const fl = this.fl;
    for (let k = this.slabs.length - 1; k >= 0; k--) {
      const s = this.slabs[k];
      s.vy += 0.055 * dt;
      s.y += s.vy * dt;
      /*
       * 카드 안에서 떨어진 덩어리는 카드를 통과하지 않는다 — 바닥에 앉는다. 부피의 85%만
       * 남기는 것은 부딞치며 흩어지는 몫이다. 카드 밖으로 쓸려 나가는 덩어리(out)만
       * 바닥을 지나 아래로 내려간다.
       */
      if (!s.out) {
        let surf = 0;
        for (let i = s.a; i <= s.b; i++) if (fl[i] > surf) surf = fl[i];
        if (this.ledge + s.y + s.th >= this.floorY - surf) {
          for (let i = s.a; i <= s.b; i++) fl[i] += s.th * 0.85;
          if (s.a > 0) fl[s.a - 1] += s.th * 0.4;
          if (s.b < fl.length - 1) fl[s.b + 1] += s.th * 0.4;
          this.slabs.splice(k, 1);
          continue;
        }
      }
      /*
       * 밖으로 쓸려 나간 덩어리는 **카드 아래에서 다시 눈이 된다.**
       *
       * 전에는 캔버스 끝에서 그냥 사라졌다. 그러면 카드 안에 쌓인 눈이 어디로 갔는지가
       * 없어진다 — 카드 밑으로 내려가 아래 카드에 앉아야 「위에서 아래로 이어지는」
       * 이야기가 된다. 배경이 받아서 아래로 데려간다 (public/snow-field.js).
       */
      if (s.out && this.ledge + s.y >= this.floorY) {
        const n = Math.max(2, Math.min(9, Math.round(((s.b - s.a + 1) * s.th) / 9)));
        for (let m = 0; m < n; m++) {
          if (this.spill.length >= 24) break;
          const t = (s.a + Math.random() * (s.b - s.a + 1)) / hs.length;
          this.spill.push({ x: t * w, r: 1.2 + Math.random() * 2 });
        }
        this.slabs.splice(k, 1);
        continue;
      }
      if (this.ledge + s.y > h + 40) this.slabs.splice(k, 1);
    }
    /* 바닥 눈도 다져지고 무너진다. 위보다 천천히 준다 — 바닥은 눈이 남는 자리다 */
    for (let i = 0; i < fl.length; i++) {
      fl[i] *= 1 - 0.00025 * dt;
      const c = this.flMax * Math.min(1, this.cap(i) / this.max);
      if (fl[i] > c) fl[i] = c;
    }
    for (let i = 0; i < fl.length - 1; i++) {
      const d = fl[i] - fl[i + 1];
      if (Math.abs(d) > 2) { const m = (d - Math.sign(d) * 2) * 0.5; fl[i] -= m; fl[i + 1] += m; }
    }
    /* 바닥이 14px로 다 차고 그 자리가 여섯 칸(36px) 넘게 이어지면 카드 밖으로 쓸려 나간다 */
    let frun = 0;
    for (let i = 0; i <= fl.length; i++) {
      if (i < fl.length && fl[i] >= this.flMax - 0.4) { frun++; continue; }
      if (frun >= 6) {
        const a = i - frun, b = i - 1;
        let sum = 0;
        for (let k = a; k <= b; k++) { sum += fl[k]; fl[k] = 1 + Math.random() * 0.8; }
        const th = sum / frun;
        this.slabs.push({ a, b, th, y: this.floorY - this.ledge - th, vy: 0.3, rot: (Math.random() - 0.5) * 0.6, out: true });
      }
      frun = 0;
    }
  }
  draw() {
    const { ctx, w, h, hs } = this;
    if (!ctx || !w) return;
    ctx.clearRect(0, 0, w, h);
    /* 위·아래 끝에서 흐려져야 캔버스 경계에서 눈이 튀어나오거나 툭 사라지지 않는다 */
    for (const f of this.flakes) {
      const x = f.x + Math.sin(f.ph) * f.sw;
      const a = Math.min(1, f.y / 22) * Math.min(1, (h - f.y) / 40) * (0.55 + f.r * 0.15);
      ctx.fillStyle = 'rgba(' + this.tint + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, f.y, f.r, 0, 6.2832); ctx.fill();
    }
    /* 칸 가운데를 이차 곡선으로 이어야 계단이 안 보인다 */
    const dip = this.dip;
    /* 그 칸에서 카드 윗면이 있는 자리 — 귀퉁이에서는 곡률만큼 내려가 있다 (fit의 dip) */
    const top = (i) => this.ledge + (dip ? dip[i] : 0);
    const y = (i) => top(i) - hs[i];
    const cx = (i) => ((i + 0.5) / hs.length) * w;
    /* 칸을 훑어 곡선을 잇는다. back이면 오른쪽에서 왼쪽으로 되짚는다 */
    const trace = (fn, back, endY) => {
      const N = hs.length;
      if (!back) {
        for (let i = 0; i < N - 1; i++) {
          ctx.quadraticCurveTo(cx(i), fn(i), (cx(i) + cx(i + 1)) / 2, (fn(i) + fn(i + 1)) / 2);
        }
        ctx.lineTo(w, endY != null ? endY : fn(N - 1));
      } else {
        for (let i = N - 1; i > 0; i--) {
          ctx.quadraticCurveTo(cx(i), fn(i), (cx(i) + cx(i - 1)) / 2, (fn(i) + fn(i - 1)) / 2);
        }
        ctx.lineTo(0, endY != null ? endY : fn(0));
      }
    };
    /* 귀퉁이에서 카드 윗면·바닥면이 있는 자리 */
    const edge = this.dipEdge || 0;
    const topEnd = this.ledge + edge;
    const botEnd = this.floorY - edge;
    ctx.beginPath();
    ctx.moveTo(0, topEnd);
    trace(y, false, topEnd);
    /* 바닥선은 카드 윗면을 따라 되짚어 온다 — 곧게 그으면 귀퉁이에서 눈이 허공에 뜬다 */
    trace((i) => top(i) + 3, true, topEnd);
    ctx.closePath();
    ctx.fillStyle = 'rgb(' + this.snow + ')';
    ctx.fill();
    /* 카드 안으로 흘러 들어간 눈. 반투명이라 아래 글자가 죽지 않는다 */
    const ins = this.ins;
    const iy = (i) => top(i) + ins[i];
    ctx.beginPath();
    ctx.moveTo(0, topEnd);
    trace(iy, false, topEnd);
    trace(top, true, topEnd);
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + this.snow + ',.9)';
    ctx.fill();
    /* 안쪽 눈의 아래 끝 그늘 — 없으면 카드에 붙은 흰 종이처럼 보인다 */
    ctx.strokeStyle = 'rgba(24,40,62,.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, iy(0) + 1);
    trace((i) => iy(i) + 1, false);
    ctx.stroke();
    /* 떨어지는 덩어리 — 카드 앞을 지나 아래로 나간다 */
    /* 카드 바닥에 쌓인 눈. 위쪽 눈과 달리 윗면이 밝다 — 빛이 위에서 온다 */
    const fl = this.fl;
    /* 아래 귀퉁이도 같은 곡률이다 — 카드 바닥이 그만큼 올라와 있다 */
    const bot = (i) => this.floorY - (dip ? dip[i] : 0);
    const fy = (i) => bot(i) - fl[i];
    ctx.beginPath();
    ctx.moveTo(0, botEnd);
    trace(fy, false, botEnd);
    trace(bot, true, botEnd);
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + this.snow + ',.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, fy(0) - 0.75);
    trace((i) => fy(i) - 0.75, false);
    ctx.stroke();
    for (const s of this.slabs) {
      const x0 = (s.a / ins.length) * w, x1 = ((s.b + 1) / ins.length) * w;
      const a = Math.max(0, 1 - s.y / (h - this.ledge + 30));
      ctx.save();
      ctx.translate((x0 + x1) / 2, this.ledge + s.y + s.th / 2);
      ctx.rotate(s.rot * Math.min(1, s.y / 60));
      ctx.fillStyle = 'rgba(' + this.snow + ',' + (a * 0.92).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(0, 0, (x1 - x0) / 2, Math.max(2.5, s.th / 2), 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
  }
});
