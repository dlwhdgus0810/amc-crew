'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n';

/**
 * 별보러가자 화면의 소리.
 *
 * 음원 파일이 아니라 브라우저가 그 자리에서 만든다(Web Audio). 받아 놓은 곡이 없으니
 * 저작권이 걸릴 상대가 없고, 앱이 받아오는 바이트도 0이다. 무작위라 같은 구간이 두 번
 * 오지 않아서 루프의 이음매도 없다.
 *
 * **자동으로 켜진다 — 단, 브라우저가 허락할 때만.**
 * 소리는 사람이 한 번 건드린 적 있는 문서에서만 난다. 홈이나 둘러보기에서 카드를 눌러
 * 들어오면 그 누름이 같은 문서 안의 조작이라 그대로 난다(next/link 이동이다).
 * 주소를 직접 열거나 새로고침해서 들어오면 아직 아무것도 안 누른 문서라 막힌다 —
 * 그때는 화면 아무 데나 한 번 누르는 순간 켜진다.
 *
 * 끈 사람에게는 다시 켜지지 않는다. 그 선택은 이 기기에 남는다.
 */

const KEY = 'kk-sky-bgm';

/** 「별이 많이」 — 낮게 깔리는 소리는 옅게, 반짝임을 자주 */
const GAP_MS: [number, number] = [600, 1600];
const PAD_GAIN = 0.035;
const TWINKLE_GAIN = 0.2;
/**
 * 배경으로 깔리는 소리라 앞에 나서지 않는 크기.
 *
 * 이 값은 귀로 정하지 않고 재 봤다 — OfflineAudioContext로 30초를 렌더해서
 * 최대 -17 dBFS, 찌그러짐 0이 되는 자리다. 처음에 0.16으로 뒀더니 -29 dBFS라
 * 폰에서는 거의 안 들렸다.
 */
const LEVEL = 0.65;

const SCALE = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]; // D 장5음계
const PAD = [146.83, 220.0, 293.66]; // D3 · A3 · D4

const T = {
  /** 칩에 늘 적혀 있는 말 — 무엇에 대한 버튼인지 (상태는 색이 말한다) */
  label: { ko: '소리', en: 'Sound', es: 'Sonido' },
  on: { ko: '소리 끄기', en: 'Turn sound off', es: 'Silenciar' },
  off: { ko: '소리 켜기', en: 'Turn sound on', es: 'Activar sonido' },
};

/** 잔향 — 파일을 받지 않고 잡음을 지수로 깎아 만든다 */
function impulse(ac: AudioContext): AudioBuffer {
  const len = Math.floor(ac.sampleRate * 2.6);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

interface Rig {
  ac: AudioContext;
  master: GainNode;
  verb: ConvolverNode;
  timer: ReturnType<typeof setTimeout> | null;
}

export default function SkyBgm() {
  const t = useT();
  const rig = useRef<Rig | null>(null);
  const [on, setOn] = useState(false);

  /** 소리를 만들 배선. 처음 켤 때 한 번만 짓는다 */
  const build = useCallback((): Rig => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctor();

    const master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);

    const verb = ac.createConvolver();
    verb.buffer = impulse(ac);
    const wet = ac.createGain();
    wet.gain.value = 0.85;
    verb.connect(wet).connect(master);

    // 낮게 깔리는 소리 — 세 음을 살짝 어긋나게 겹치고 필터를 아주 느리게 흔든다
    const padGain = ac.createGain();
    padGain.gain.value = PAD_GAIN;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.6;
    padGain.connect(lp);
    lp.connect(master);
    lp.connect(verb);

    const lfo = ac.createOscillator();
    const amt = ac.createGain();
    lfo.frequency.value = 0.045; // 22초에 한 번쯤 오간다
    amt.gain.value = 260;
    lfo.connect(amt).connect(lp.frequency);
    lfo.start();

    PAD.forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 5; // 살짝 어긋나야 넓게 들린다
      const g = ac.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.28;
      o.connect(g).connect(padGain);
      o.start();
    });

    return { ac, master, verb, timer: null };
  }, []);

  /** 반짝 한 번 — 짧게 때리고 길게 사라진다 */
  const twinkle = useCallback((r: Rig) => {
    const { ac, master, verb } = r;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = SCALE[(Math.random() * SCALE.length) | 0]! * (Math.random() < 0.22 ? 2 : 1);

    const g = ac.createGain();
    const peak = TWINKLE_GAIN * (0.55 + Math.random() * 0.45);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.6 + Math.random() * 1.4);

    o.connect(g);
    // 좌우로 흩어 놓는다 (오래된 사파리에는 패너가 없다 — 없으면 그냥 가운데)
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = Math.random() * 1.6 - 0.8;
      g.connect(pan);
      pan.connect(master);
      pan.connect(verb);
    } else {
      g.connect(master);
      g.connect(verb);
    }

    o.start(now);
    o.stop(now + 3.2);
  }, []);

  const schedule = useCallback(
    (r: Rig) => {
      const [lo, hi] = GAP_MS;
      r.timer = setTimeout(() => {
        if (!rig.current) return;
        twinkle(r);
        schedule(r);
      }, lo + Math.random() * (hi - lo));
    },
    [twinkle]
  );

  /**
   * 켜기. 브라우저가 막으면 false를 준다 — 그때는 부른 쪽이 다음 누름을 기다린다.
   */
  const start = useCallback(async (): Promise<boolean> => {
    const r = (rig.current ??= build());
    try {
      await r.ac.resume();
    } catch {
      // resume 자체가 거부되는 브라우저도 있다 — 아래 state 검사로 함께 걸린다
    }
    if (r.ac.state !== 'running') return false;

    r.master.gain.cancelScheduledValues(r.ac.currentTime);
    r.master.gain.setValueAtTime(Math.max(r.master.gain.value, 0.0001), r.ac.currentTime);
    // 슬며시 들어온다 — 화면을 열자마자 소리가 튀어나오면 놀란다
    r.master.gain.linearRampToValueAtTime(LEVEL, r.ac.currentTime + 2.4);
    if (!r.timer) schedule(r);
    return true;
  }, [build, schedule]);

  const stop = useCallback(() => {
    const r = rig.current;
    if (!r) return;
    if (r.timer) {
      clearTimeout(r.timer);
      r.timer = null;
    }
    r.master.gain.cancelScheduledValues(r.ac.currentTime);
    r.master.gain.setValueAtTime(r.master.gain.value, r.ac.currentTime);
    r.master.gain.linearRampToValueAtTime(0.0001, r.ac.currentTime + 0.8);
  }, []);

  /*
   * 화면에 들어오면 켠다. 막히면 화면을 처음 누를 때 켜지도록 걸어 둔다 —
   * 그 한 번은 「소리를 켜려고」 누른 것이 아니어도 된다. 브라우저가 요구하는 것은
   * 이 문서에서 사람이 무언가 했다는 사실뿐이다.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let alive = true;
    let armed: (() => void) | null = null;

    // 끈 적이 있으면 그대로 둔다
    let muted = false;
    try {
      muted = localStorage.getItem(KEY) === 'off';
    } catch {
      // 저장소를 못 읽으면 켠다 (이 화면의 기본값이다)
    }

    if (!muted) {
      void (async () => {
        if (await start()) {
          if (alive) setOn(true);
          return;
        }
        if (!alive) return;
        const wake = () => {
          void start().then((ok) => {
            if (ok && alive) setOn(true);
          });
        };
        armed = () => {
          document.removeEventListener('pointerdown', wake);
          document.removeEventListener('keydown', wake);
        };
        document.addEventListener('pointerdown', wake, { once: true });
        document.addEventListener('keydown', wake, { once: true });
      })();
    }

    /*
     * 다른 화면을 보고 있는데 소리만 따라다니면 안 된다.
     *
     * 껐는지는 그때그때 다시 읽는다 — 처음 들어올 때 값을 붙들고 있으면,
     * 껐다가 탭을 다녀온 사람에게 소리가 되살아난다.
     */
    const onHide = () => {
      if (document.hidden) {
        stop();
        return;
      }
      let off = false;
      try {
        off = localStorage.getItem(KEY) === 'off';
      } catch {
        // 못 읽으면 켠다 (이 화면의 기본값이다)
      }
      if (!off) void start().then((ok) => ok && alive && setOn(true));
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      alive = false;
      armed?.();
      document.removeEventListener('visibilitychange', onHide);
      // 이 화면을 떠나면 소리도 같이 끝난다
      const r = rig.current;
      rig.current = null;
      if (r) {
        if (r.timer) clearTimeout(r.timer);
        try {
          r.master.gain.cancelScheduledValues(r.ac.currentTime);
          r.master.gain.linearRampToValueAtTime(0.0001, r.ac.currentTime + 0.35);
        } catch {
          // 이미 닫힌 컨텍스트면 아무것도 안 해도 된다
        }
        setTimeout(() => void r.ac.close().catch(() => {}), 500);
      }
    };
  }, [start, stop]);

  function toggle() {
    if (on) {
      stop();
      setOn(false);
      try {
        localStorage.setItem(KEY, 'off');
      } catch {
        // 못 적으면 이번 화면에서만 꺼진 채로 둔다
      }
      return;
    }
    void start().then((ok) => {
      if (!ok) return;
      setOn(true);
      try {
        localStorage.setItem(KEY, 'on');
      } catch {
        // 위와 같다
      }
    });
  }

  /*
   * 글리프만 있던 것을 글자까지 붙인 칩으로 바꿨다. 음표 하나로는 「이게 뭐지」가 되고,
   * 껐다는 표시로 쓰던 ♪̸(결합 빗금)는 기기마다 다르게 그려졌다.
   * 지금은 구독 토글과 같은 꼴이다 — 아이콘 + 글자, 켜지면 색이 붙는다.
   *
   * ♪ 뒤의 \uFE0E는 「이건 그림이 아니라 글자」라는 표시다. 안 붙이면 기기에 따라
   * 컬러 이모지로 그려져서 색을 바꿀 수 없게 된다.
   */
  return (
    <button
      type="button"
      className={`sky-bgm ${on ? 'on' : ''}`}
      onClick={toggle}
      aria-pressed={on}
      title={t(on ? T.on : T.off)}
    >
      <span className="sky-bgm-note" aria-hidden="true">
        {'\u266A\uFE0E'}
      </span>
      <span aria-hidden="true">{t(T.label)}</span>
      <span className="sr-only">{t(on ? T.on : T.off)}</span>
    </button>
  );
}
