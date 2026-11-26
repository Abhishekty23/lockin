"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import DayRing, { type RingSegment } from "@/components/ui/DayRing";

const PARTS = [
  { key: "focus", label: "Focus", color: "var(--violet)" },
  { key: "water", label: "Water", color: "var(--water)" },
  { key: "sleep", label: "Sleep", color: "var(--cyan)" },
  { key: "habits", label: "Habits", color: "var(--mint)" },
  { key: "move", label: "Move", color: "var(--amber)" },
  { key: "mind", label: "Journal", color: "var(--rose)" },
];

const LINES = [
  "Every focus session fills a piece of your ring.",
  "Water, sleep and habits count too.",
  "Fill all six and the lock snaps shut.",
  "Keep the streak alive tomorrow.",
];

// Split screen used by every login page: a living day ring on the left, the form on the right.
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setT((v) => (v + 1) % 16), 700);
    return () => clearInterval(id);
  }, []);

  // 0..11 fills the ring, 12..15 holds it locked
  const progress = Math.min(t, 12) / 12;
  const segments: RingSegment[] = PARTS.map((p, i) => ({
    ...p,
    value: Math.max(0, Math.min(1, progress * 6 - i * 0.8)),
  }));
  const score = Math.round((segments.reduce((s, x) => s + x.value, 0) / 6) * 100);
  const line = LINES[Math.min(3, Math.floor(t / 4))];

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="sky relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex">
        <Link href="/" aria-label="LockIn home" className="w-fit">
          <Logo />
        </Link>

        <div className="flex flex-col items-center">
          <DayRing segments={segments} score={score} locked={score >= 100} size={340} />
          <div className="mt-8 h-8">
            <AnimatePresence mode="wait">
              <motion.p
                key={line}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="text-center text-lg text-muted"
              >
                {line}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted">
          {PARTS.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              {p.label}
            </li>
          ))}
        </ul>
      </aside>

      <main className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="LockIn home" className="lg:invisible">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="w-full max-w-[420px]"
          >
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-2 text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
