"use client";

// Background sounds for Lock In mode, generated live with the Web Audio API (no audio files).
import { getAudio } from "./sounds";

export type AmbientKind = "none" | "rain" | "cafe" | "forest" | "waves" | "brown";

export const AMBIENTS: { id: AmbientKind; emoji: string; label: string }[] = [
  { id: "none", emoji: "🔇", label: "Silence" },
  { id: "rain", emoji: "🌧️", label: "Rain" },
  { id: "cafe", emoji: "☕", label: "Café" },
  { id: "forest", emoji: "🌲", label: "Forest" },
  { id: "waves", emoji: "🌊", label: "Waves" },
  { id: "brown", emoji: "🟤", label: "Brown noise" },
];

function noiseBuffer(a: AudioContext, kind: "white" | "brown") {
  const len = a.sampleRate * 4;
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
  }
  return buf;
}

function loop(a: AudioContext, buf: AudioBuffer) {
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

/** A playing ambient sound. Call stop() when done. */
export type AmbientPlayer = { setVolume: (v: number) => void; stop: () => void };

export function playAmbient(kind: AmbientKind, volume: number): AmbientPlayer | null {
  const a = getAudio();
  if (!a || kind === "none") return null;

  const master = a.createGain();
  master.gain.setValueAtTime(0.0001, a.currentTime);
  master.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), a.currentTime + 1.2);
  master.connect(a.destination);

  const sources: AudioScheduledSourceNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const white = noiseBuffer(a, "white");
  const brown = noiseBuffer(a, "brown");

  const add = (src: AudioScheduledSourceNode) => {
    sources.push(src);
    src.start();
  };

  // Repeats a little one-shot sound at random intervals (rain drops, birds, cups)
  const sprinkle = (minMs: number, maxMs: number, fire: () => void) => {
    const next = () => {
      timers.push(
        setTimeout(() => {
          fire();
          next();
        }, minMs + Math.random() * (maxMs - minMs)),
      );
    };
    next();
  };

  const blip = (freq: number, to: number, dur: number, vol: number, type: OscillatorType = "sine") => {
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  if (kind === "rain") {
    const src = loop(a, white);
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7000;
    const g = a.createGain();
    g.gain.value = 0.35;
    src.connect(hp).connect(lp).connect(g).connect(master);
    add(src);
    sprinkle(40, 180, () => blip(2400 + Math.random() * 2400, 900, 0.04, 0.03 + Math.random() * 0.04));
  }

  if (kind === "brown") {
    const src = loop(a, brown);
    const g = a.createGain();
    g.gain.value = 0.9;
    src.connect(g).connect(master);
    add(src);
  }

  if (kind === "waves") {
    const src = loop(a, white);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const swell = a.createGain();
    swell.gain.value = 0.25;
    const lfo = a.createOscillator();
    lfo.frequency.value = 0.09; // one wave every ~11 seconds
    const depth = a.createGain();
    depth.gain.value = 0.22;
    lfo.connect(depth).connect(swell.gain);
    const lfo2 = a.createOscillator();
    lfo2.frequency.value = 0.09;
    const fdepth = a.createGain();
    fdepth.gain.value = 450;
    lfo2.connect(fdepth).connect(lp.frequency);
    src.connect(lp).connect(swell).connect(master);
    add(src);
    add(lfo);
    add(lfo2);
  }

  if (kind === "forest") {
    const src = loop(a, white);
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    bp.Q.value = 0.4;
    const g = a.createGain();
    g.gain.value = 0.06; // soft breeze
    src.connect(bp).connect(g).connect(master);
    add(src);
    sprinkle(1800, 6000, () => {
      // a short bird call: two to four quick chirps
      const base = 2200 + Math.random() * 1600;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) timers.push(setTimeout(() => blip(base, base * 1.35, 0.09, 0.05), i * 120));
    });
  }

  if (kind === "cafe") {
    const src = loop(a, brown);
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    bp.Q.value = 0.6;
    const g = a.createGain();
    g.gain.value = 0.8; // room murmur
    src.connect(bp).connect(g).connect(master);
    add(src);
    sprinkle(2500, 7000, () => blip(3200 + Math.random() * 1500, 2800, 0.25, 0.02, "triangle")); // cup clinks
  }

  return {
    setVolume(v) {
      master.gain.setTargetAtTime(Math.max(0.0001, v), a.currentTime, 0.1);
    },
    stop() {
      timers.forEach(clearTimeout);
      master.gain.setTargetAtTime(0.0001, a.currentTime, 0.25);
      setTimeout(() => {
        sources.forEach((s) => {
          try {
            s.stop();
          } catch {}
        });
        master.disconnect();
      }, 900);
    },
  };
}
