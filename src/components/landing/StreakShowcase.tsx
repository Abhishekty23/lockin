"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { sounds } from "@/lib/sounds";

const STAGES = [
  { from: 1, emoji: "🌱", name: "Sprout", note: "Day one counts. Everyone starts here." },
  { from: 3, emoji: "🔥", name: "Spark", note: "Three days in a row. A habit is forming." },
  { from: 7, emoji: "🔥🔥", name: "On fire", note: "A full week. You earn a streak freeze ❄️" },
  { from: 14, emoji: "💥", name: "Unstoppable", note: "Two weeks. This is who you are now." },
  { from: 30, emoji: "☄️", name: "Comet", note: "A month locked in. Share your card 📸" },
  { from: 100, emoji: "👑", name: "Locked-in legend", note: "100 days. Very few people get here." },
];
const MILESTONES = [3, 7, 14, 30, 50, 100];

function stageFor(days: number) {
  return [...STAGES].reverse().find((s) => days >= s.from) ?? STAGES[0];
}

// A sample month: what each day looked like
const MONTH = "🔥🔥✅🔥🔥😴🔥🔥🔥✅🔥❄️🔥🔥🔥🔥✅🔥🔥😴🔥🔥🔥🔥⬜🌱🔥🔥✅🔥".match(/\p{Extended_Pictographic}|⬜/gu) ?? [];

export default function StreakShowcase() {
  const [days, setDays] = useState(23);
  const last = useRef(23);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const stage = stageFor(days);
  const next = MILESTONES.find((m) => m > days);
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= days) ?? 0;

  function onChange(v: number) {
    const crossed = MILESTONES.find((m) => last.current < m && v >= m);
    last.current = v;
    setDays(v);
    if (crossed) {
      sounds.badge();
      setCelebrate(crossed);
      setTimeout(() => setCelebrate((c) => (c === crossed ? null : c)), 1800);
    }
  }

  return (
    <section id="streaks" className="sky fade-edges scroll-mt-24 px-4 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Watch your streak grow</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Your flame changes as you keep going, and big days get a proper celebration. Drag the slider to see it.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="glass relative flex flex-col justify-center overflow-hidden rounded-[2rem] p-8 sm:p-10">
            <div className="flex flex-col items-center text-center">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={stage.emoji}
                  initial={{ scale: 0.3, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.3, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="block animate-flicker select-none"
                  style={{ fontSize: `${64 + Math.min(days, 100) * 0.45}px`, lineHeight: 1.1 }}
                  aria-hidden
                >
                  {stage.emoji}
                </motion.span>
              </AnimatePresence>
              <p className="mt-4 font-display text-6xl font-extrabold tabular-nums">
                {days} <span className="text-3xl text-muted">{days === 1 ? "day" : "days"}</span>
              </p>
              <p className="mt-2 font-display text-xl font-semibold">{stage.name}</p>
              <p className="mt-1 text-muted">{stage.note}</p>
            </div>

            <div className="mt-10">
              <input
                type="range"
                min={1}
                max={120}
                value={days}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label="Streak length in days"
                className="w-full accent-[var(--violet)]"
              />
              <div className="mt-3 flex justify-between text-sm text-muted">
                <span>🏆 Best: {Math.max(days, 41)} days</span>
                <span>{next ? `${next - days} days to ${stageFor(next).emoji} ${next}` : "Legend status reached"}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--amber), var(--rose))" }}
                  animate={{ width: next ? `${((days - prevMilestone) / (next - prevMilestone)) * 100}%` : "100%" }}
                />
              </div>
            </div>

            <AnimatePresence>
              {celebrate && (
                <motion.div
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {Array.from({ length: 18 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="absolute text-2xl"
                      initial={{ x: 0, y: 0, scale: 0.5 }}
                      animate={{ x: Math.cos((i / 18) * Math.PI * 2) * 220, y: Math.sin((i / 18) * Math.PI * 2) * 160, scale: 1, opacity: 0 }}
                      transition={{ duration: 1.4, ease: "easeOut" }}
                    >
                      {["🎉", "✨", "🔥", "⭐"][i % 4]}
                    </motion.span>
                  ))}
                  <span className="glass rounded-full px-5 py-2.5 font-display font-bold">{celebrate}-day milestone 🎉</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid gap-4">
            <div className="glass rounded-3xl p-6">
              <p className="font-display text-lg font-bold">This month</p>
              <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-lg">
                {MONTH.map((e, i) => (
                  <span key={i} className="grid aspect-square place-items-center rounded-lg bg-line/40" title={`Day ${i + 1}`}>
                    {e}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                🔥 goal hit, ✅ good day, 😴 rest day, ❄️ freeze used, ⬜ missed
              </p>
            </div>
            <div className="glass rounded-3xl p-6">
              <p className="font-display text-lg font-bold">A streak for everything</p>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {[
                  ["🔒", "Locked-in days", 23],
                  ["🎯", "Focus", 31],
                  ["💧", "Water", 12],
                  ["😴", "Sleep on time", 9],
                  ["🏃", "Exercise", 6],
                  ["📝", "Journal", 15],
                ].map(([e, n, c]) => (
                  <li key={n as string} className="flex items-center justify-between gap-2">
                    <span>
                      {e} {n}
                    </span>
                    <span className="tabular-nums text-muted">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
