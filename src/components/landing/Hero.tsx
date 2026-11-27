"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Play, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import DayRing, { type RingSegment } from "@/components/ui/DayRing";

// three.js loads only in the browser, after the page is ready
const Ring3D = dynamic(() => import("./Ring3D"), { ssr: false });
import { sounds } from "@/lib/sounds";

const PARTS = [
  { key: "focus", label: "Focus", color: "var(--violet)", fmt: (p: number) => `${hm(p * 8 * 60)} / 8h` },
  { key: "water", label: "Water", color: "var(--water)", fmt: (p: number) => `${Math.round(p * 8)} / 8 glasses` },
  { key: "sleep", label: "Sleep", color: "var(--cyan)", fmt: (p: number) => `${hm(p * 7.5 * 60)} / 7h 30m` },
  { key: "habits", label: "Habits", color: "var(--amber)", fmt: (p: number) => `${Math.round(p * 5)} / 5 done` },
  { key: "breaks", label: "Breaks", color: "var(--rose)", fmt: (p: number) => `${Math.round(p * 6)} / 6 taken` },
];
const COLOR_VARS = ["--violet", "--water", "--cyan", "--amber", "--rose"];
// Each part fills at a different pace through the day, so the ring feels alive
const PACE = [0.95, 0.8, 0.25, 0.7, 0.9];

function hm(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}
function clock(t: number) {
  const mins = 6.5 * 60 + t * 16 * 60; // 6:30 am to 10:30 pm
  const h24 = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const h = ((h24 + 11) % 12) + 1;
  return `${h}:${m.toString().padStart(2, "0")} ${h24 < 12 ? "am" : "pm"}`;
}
function partValue(i: number, t: number) {
  // sleep is logged first thing in the morning; the rest build up during the day
  if (i === 2) return Math.min(1, t / PACE[i]);
  return Math.min(1, Math.pow(t, 1 / (PACE[i] * 1.4)) * (t >= 0.999 ? 1 : 0.985));
}

export default function Hero() {
  const [t, setT] = useState(0);
  const [flat, setFlat] = useState(false); // no WebGL: show the 2D ring instead
  const raf = useRef(0);
  const withSound = useRef(false);

  const play = useCallback((sound: boolean) => {
    cancelAnimationFrame(raf.current);
    withSound.current = sound;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(1);
      if (sound) sounds.lock();
      return;
    }
    const start = performance.now();
    const dur = 4200;
    let last = 0;
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / dur)); // the first frame can be stamped a moment before start
      // ~25 updates a second is plenty for the numbers; the 3D ring eases between them itself
      if (p >= 1 || now - last >= 40) {
        last = now;
        setT(p);
      }
      if (p < 1) raf.current = requestAnimationFrame(step);
      else if (withSound.current) sounds.lock();
    };
    setT(0);
    raf.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => play(false), 700);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf.current);
    };
  }, [play]);

  const values = PARTS.map((_, i) => partValue(i, t));
  const segments: RingSegment[] = PARTS.map((p, i) => ({ key: p.key, label: p.label, color: p.color, value: values[i] }));
  const score = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100);
  const locked = score >= 100;

  return (
    <section className="sky fade-bottom overflow-hidden px-4 pb-24 pt-32 md:pt-40">
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Lock in.
            <br />
            <span className="text-muted">Track your</span>
            <br />
            whole day.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 max-w-md text-lg leading-relaxed text-muted"
          >
            Focus sessions, water, sleep, habits and goals in one place, with gentle reminders that keep you going.
            Whatever you&apos;re working on, see your whole day fill up.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/signup"
              className="cta-glow rounded-full bg-ink px-7 py-4 font-semibold text-bg shadow-xl shadow-black/20 transition hover:-translate-y-0.5"
            >
              Start free
            </Link>
            <button
              type="button"
              onClick={() => play(true)}
              className="glass inline-flex items-center gap-2 rounded-full px-6 py-4 font-semibold transition hover:-translate-y-0.5"
            >
              {t === 0 || t === 1 ? <Play size={17} /> : <RotateCcw size={17} />}
              Watch a day fill up
            </button>
          </motion.div>
          <p className="mt-6 text-sm text-muted">
            Free to use, on your phone or laptop.{" "}
            <Link href="/demo" className="font-semibold text-violet underline-offset-4 hover:underline">
              See a demo with sample data
            </Link>
          </p>
        </div>

        {flat ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative mx-auto w-full max-w-[460px] rounded-[2rem] p-6 sm:p-8"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Today</span>
              <span className="tabular-nums text-muted">{clock(t)}</span>
            </div>
            <div className="mt-4 flex justify-center">
              <DayRing segments={segments} score={score} locked={locked} size={300} />
            </div>
            <PartList values={values} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[540px]"
          >
            <div className="relative aspect-square w-full">
              <Ring3D values={values} colors={COLOR_VARS} locked={locked} onFail={() => setFlat(true)} />
              <span className="glass absolute left-3 top-3 rounded-full px-3.5 py-1.5 text-sm tabular-nums sm:left-6 sm:top-6">
                Today · {clock(t)}
              </span>
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center sm:bottom-6">
                <span className={`glass rounded-2xl px-5 py-2.5 text-center transition ${locked ? "ring-2 ring-mint/60" : ""}`}>
                  <span className="block font-display text-3xl font-bold tabular-nums">{locked ? "🔒 100" : score}</span>
                  <span className="block text-xs text-muted">{locked ? "Locked in!" : "today\u2019s score"}</span>
                </span>
              </div>
            </div>
            <PartList values={values} compact />
          </motion.div>
        )}
      </div>
    </section>
  );
}

function PartList({ values, compact = false }: { values: number[]; compact?: boolean }) {
  if (compact)
    return (
      <ul className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
        {PARTS.map((p, i) => (
          <li key={p.key} className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
            <span className="font-semibold">{p.label}</span>
            <span className="tabular-nums text-muted">{p.fmt(values[i])}</span>
          </li>
        ))}
      </ul>
    );
  return (
    <ul className="mt-6 grid gap-2.5 text-sm">
      {PARTS.map((p, i) => (
        <li key={p.key} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
            {p.label}
          </span>
          <span className="tabular-nums text-muted">{p.fmt(values[i])}</span>
        </li>
      ))}
    </ul>
  );
}
