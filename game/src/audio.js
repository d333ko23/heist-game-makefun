// Sound only: tiny WebAudio bleeps, synthesized in code, no audio files. The context is
// created lazily on the first user gesture (browsers keep it suspended until then) and every
// call is guarded, so a headless screenshot run stays silent and never throws.

let context = null;
let lastAlarmTick = 0;

function audio() {
  if (context === null) {
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }
  return context;
}

function tone(freq, duration, type, gainValue, when = 0) {
  const ctx = audio();
  if (ctx === null) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.05);
  } catch {
    // Sound is garnish: never let it break the game.
  }
}

/** Unlock the context from a user gesture. */
export function unlockAudio() {
  audio();
}

/** Two-note chime when a treasure is pocketed. */
export function playLoot() {
  tone(880, 0.12, 'sine', 0.12);
  tone(1318, 0.18, 'sine', 0.1, 0.09);
}

/** A short harsh tick while the thief is seen; throttled to twice a second. */
export function playAlarmTick(nowMs) {
  if (nowMs - lastAlarmTick < 500) return;
  lastAlarmTick = nowMs;
  tone(220, 0.09, 'square', 0.05);
}

/** Rising arpeggio for a clean getaway. */
export function playWin() {
  [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.12, i * 0.12));
}

/** Descending buzz for being caught. */
export function playCaught() {
  [330, 262, 196, 131].forEach((freq, i) => tone(freq, 0.25, 'sawtooth', 0.07, i * 0.14));
}
