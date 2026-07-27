// Hand-rolled easing/tween helpers ported 1:1 from the reference prototype's
// `MOTION`/`Easing`/`interpolate`/`animate` (animations-v2.jsx + vsl-scenes.jsx), so the
// word-by-word "stomp" timing stays numerically identical. Deliberately independent of
// Remotion's own `interpolate` — everything here is driven by `sceneT` (seconds since the
// start of the current Sequence, i.e. `frame / fps`), which is itself frame-exact, so this
// stays fully deterministic under Remotion's per-frame seek-and-capture render model.

export const Easing = {
  linear: (t: number) => t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuad: (t: number) => t * t,
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export interface AnimateOpts {
  from?: number;
  to?: number;
  start?: number;
  end?: number;
  ease?: (t: number) => number;
}

// animate(t, {from,to,start,end,ease}) — single-segment tween. Returns `from` before
// `start`, `to` after `end` (port of the reference's curried `animate({...})(t)`).
export function animate(t: number, opts: AnimateOpts = {}): number {
  const { from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic } = opts;
  if (t <= start) return from;
  if (t >= end) return to;
  const local = (t - start) / (end - start);
  return from + (to - from) * ease(local);
}

// interpolateKeyframes(t, [in...], [out...], ease?) — Popmotion-style keyframe mapper.
// Named distinctly from Remotion's own `interpolate` export to avoid any ambiguity.
export function interpolateKeyframes(
  t: number,
  input: number[],
  output: number[],
  ease: ((t: number) => number) | ((t: number) => number)[] = Easing.linear
): number {
  if (t <= input[0]) return output[0];
  if (t >= input[input.length - 1]) return output[output.length - 1];
  for (let i = 0; i < input.length - 1; i++) {
    if (t >= input[i] && t <= input[i + 1]) {
      const span = input[i + 1] - input[i];
      const local = span === 0 ? 0 : (t - input[i]) / span;
      const easeFn = Array.isArray(ease) ? ease[i] || Easing.linear : ease;
      return output[i] + (output[i + 1] - output[i]) * easeFn(local);
    }
  }
  return output[output.length - 1];
}

export interface EnterOpts {
  start?: number;
  end: number;
  inDur?: number;
  outDur?: number;
  rise?: number;
  rot?: number;
  blur?: number;
}

export interface EnterResult {
  opacity: number;
  transform: string;
  filter?: string;
}

// The word/line "stomp-in" entrance: opacity 0->1, translateY(rise->0), scale(0.78->1.0,
// back-ease overshoot), rotate(rot->0), blur(blur->0). Numeric spec is final per the
// reference README — do not retune these defaults.
export function enter(sceneT: number, opts: EnterOpts): EnterResult {
  const { start = 0, end, inDur = 0.26, outDur = 0.18, rise = 46, rot = 0, blur = 0 } = opts;
  const inP = animate(sceneT, { from: 0, to: 1, start, end: start + inDur, ease: Easing.easeOutCubic });
  const outP = animate(sceneT, { from: 1, to: 0, start: end - outDur, end, ease: Easing.easeInCubic });
  const p = Math.min(inP, outP);
  const bClamped = clamp(p, 0, 1);
  const backP = animate(sceneT, { from: 0, to: 1, start, end: start + inDur, ease: Easing.easeOutBack });
  const b = Math.max(backP, 0);
  return {
    opacity: bClamped,
    transform: `translateY(${(1 - b) * rise}px) scale(${0.78 + 0.22 * b}) rotate(${(1 - b) * rot}deg)`,
    filter: blur ? `blur(${(1 - bClamped) * blur}px)` : undefined,
  };
}

// A drawing/reveal progress (SVG stroke-dashoffset, bar fill, etc).
export function draw(sceneT: number, start: number, end: number, ease = Easing.easeOutCubic): number {
  return animate(sceneT, { from: 0, to: 1, start, end, ease });
}

// A one-shot "pop" scale bump centered at `at`, lasting `dur` seconds.
export function pop(sceneT: number, at: number, opts: { dur?: number; amount?: number } = {}): number {
  const { dur = 0.34, amount = 0.28 } = opts;
  if (sceneT < at || sceneT > at + dur) return 1;
  const p = (sceneT - at) / dur;
  return 1 + amount * Math.sin(p * Math.PI);
}

// Deterministic stand-in for the reference's CSS `vslPulse` keyframe animation (opacity
// 1->0.35, scale 1->0.7, 1.1s loop) — CSS wall-clock animations don't stay in sync with
// Remotion's per-frame seek-and-capture render model, so this drives the same visual off
// `elapsedSec` instead.
export function pulse(elapsedSec: number, periodSec = 1.1): { opacity: number; scale: number } {
  const cycle = ((elapsedSec % periodSec) + periodSec) % periodSec / periodSec;
  const wave = (1 - Math.cos(cycle * Math.PI * 2)) / 2;
  return {
    opacity: 1 - wave * (1 - 0.35),
    scale: 1 - wave * (1 - 0.7),
  };
}
