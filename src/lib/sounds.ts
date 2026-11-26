"use client";

// All LockIn sounds are synthesized with the Web Audio API: no audio files to download.
// Browsers only allow sound after the person has clicked on the page, so call these from click handlers.

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = { type?: OscillatorType; from: number; to?: number; start?: number; dur: number; vol?: number };

function tone(a: AudioContext, { type = "sine", from, to, start = 0, dur, vol = 0.18 }: ToneOpts) {
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(a: AudioContext, start: number, dur: number, vol = 0.12) {
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const gain = a.createGain();
  const filter = a.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800;
  src.buffer = buffer;
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(a.currentTime + start);
}

export const sounds = {
  /** 💧 Drink water: a soft water-drop plip */
  water() {
    const a = audio();
    if (!a) return;
    tone(a, { from: 1400, to: 420, dur: 0.18, vol: 0.22 });
    tone(a, { from: 900, to: 600, start: 0.12, dur: 0.12, vol: 0.08 });
  },
  /** ☕ Take a break: gentle two-note chime */
  break() {
    const a = audio();
    if (!a) return;
    tone(a, { from: 880, dur: 1.2, vol: 0.12 });
    tone(a, { from: 1318, start: 0.18, dur: 1.4, vol: 0.1 });
  },
  /** 👀 Eye rest: soft bell */
  eyes() {
    const a = audio();
    if (!a) return;
    tone(a, { type: "triangle", from: 660, dur: 1.4, vol: 0.14 });
    tone(a, { from: 1980, dur: 0.6, vol: 0.03 });
  },
  /** 🧍 Stretch: light pop */
  stretch() {
    const a = audio();
    if (!a) return;
    tone(a, { from: 520, to: 980, dur: 0.12, vol: 0.18 });
  },
  /** 😴 Sleep time: calm descending night tone */
  sleep() {
    const a = audio();
    if (!a) return;
    tone(a, { from: 392, dur: 1.2, vol: 0.1 });
    tone(a, { from: 330, start: 0.35, dur: 1.4, vol: 0.1 });
    tone(a, { from: 262, start: 0.7, dur: 1.8, vol: 0.1 });
  },
  /** ✅ Task done: satisfying click */
  done() {
    const a = audio();
    if (!a) return;
    noise(a, 0, 0.03, 0.15);
    tone(a, { from: 1200, to: 1600, start: 0.01, dur: 0.09, vol: 0.12 });
  },
  /** 🔒 Daily goal reached: the lock snaps shut */
  lock() {
    const a = audio();
    if (!a) return;
    noise(a, 0, 0.04, 0.22);
    tone(a, { type: "square", from: 180, to: 90, dur: 0.08, vol: 0.08 });
    tone(a, { from: 784, start: 0.12, dur: 0.5, vol: 0.1 });
    tone(a, { from: 1175, start: 0.2, dur: 0.7, vol: 0.08 });
  },
  /** 🏅 Badge unlocked: little achievement jingle */
  badge() {
    const a = audio();
    if (!a) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(a, { type: "triangle", from: f, start: i * 0.09, dur: 0.35, vol: 0.12 }));
  },
  /** 🔥 Streak saver: warm alert */
  streak() {
    const a = audio();
    if (!a) return;
    tone(a, { type: "sawtooth", from: 440, dur: 0.18, vol: 0.05 });
    tone(a, { from: 554, start: 0.2, dur: 0.18, vol: 0.12 });
    tone(a, { from: 659, start: 0.4, dur: 0.4, vol: 0.12 });
  },
};

export type SoundName = keyof typeof sounds;
