/* Tiny WebAudio synth — subtle casino UI sounds, fully client-side. */

let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {},
) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const { type = 'sine', gain = 0.12, delay = 0, slide } = opts;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const snd = {
  click() {
    tone(660, 0.06, { type: 'triangle', gain: 0.06 });
  },
  hover() {
    tone(440, 0.03, { type: 'sine', gain: 0.02 });
  },
  deal() {
    tone(320, 0.08, { type: 'triangle', gain: 0.06, slide: 560 });
  },
  chip() {
    tone(920, 0.09, { type: 'sine', gain: 0.07 });
    tone(1380, 0.1, { type: 'sine', gain: 0.04, delay: 0.02 });
  },
  raise() {
    tone(520, 0.09, { type: 'square', gain: 0.035, slide: 780 });
  },
  fold() {
    tone(340, 0.12, { type: 'triangle', gain: 0.05, slide: 190 });
  },
  win() {
    tone(523, 0.16, { type: 'triangle', gain: 0.1 });
    tone(659, 0.16, { type: 'triangle', gain: 0.1, delay: 0.12 });
    tone(784, 0.28, { type: 'triangle', gain: 0.11, delay: 0.24 });
    tone(1046, 0.4, { type: 'triangle', gain: 0.08, delay: 0.38 });
  },
  lose() {
    tone(300, 0.25, { type: 'triangle', gain: 0.07, slide: 150 });
    tone(150, 0.4, { type: 'triangle', gain: 0.06, delay: 0.22, slide: 90 });
  },
  coin() {
    tone(1245, 0.07, { type: 'sine', gain: 0.09 });
    tone(1660, 0.1, { type: 'sine', gain: 0.06, delay: 0.06 });
  },
  pop() {
    tone(180, 0.1, { type: 'sine', gain: 0.09, slide: 520 });
  },
  bell() {
    tone(880, 0.5, { type: 'sine', gain: 0.06 });
    tone(1320, 0.4, { type: 'sine', gain: 0.03, delay: 0.05 });
  },
  error() {
    tone(220, 0.16, { type: 'sawtooth', gain: 0.035, slide: 160 });
  },
};

export function primeAudio(): void {
  ac();
}