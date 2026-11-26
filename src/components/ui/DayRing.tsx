"use client";

import { motion } from "motion/react";

export type RingSegment = { key: string; label: string; color: string; value: number }; // value 0..1

const SIZE = 320;
const R = 128;
const STROKE = 22;
const C = 2 * Math.PI * R;
const GAP = 14; // px gap between segments along the ring

// The LockIn day ring: one arc per part of your day. When everything is full, the lock snaps shut.
export default function DayRing({
  segments,
  score,
  locked,
  size = SIZE,
}: {
  segments: RingSegment[];
  score: number;
  locked: boolean;
  size?: number;
}) {
  const seg = C / segments.length;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* glow that brightens as the day fills */}
      <div
        className="absolute inset-6 rounded-full blur-3xl transition-opacity duration-700"
        style={{ background: "var(--glow)", opacity: 0.35 + score / 160 }}
      />
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative h-full w-full -rotate-90" role="img" aria-label={`Today's score ${score} out of 100`}>
        {segments.map((s, i) => {
          const len = seg - GAP;
          const offset = -(i * seg + GAP / 2);
          return (
            <g key={s.key}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke="var(--line)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${len} ${C}`}
                strokeDashoffset={offset}
              />
              <motion.circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDashoffset={offset}
                initial={false}
                animate={{ strokeDasharray: `${Math.max(0.001, len * Math.min(1, s.value))} ${C}` }}
                transition={{ type: "spring", stiffness: 60, damping: 18 }}
                style={{ filter: `drop-shadow(0 0 6px ${s.color})` }}
              />
            </g>
          );
        })}
      </svg>

      {/* centre: lock + score */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center">
          <svg width="64" height="72" viewBox="0 0 64 72" aria-hidden="true">
            <motion.path
              d="M18 34V22a14 14 0 0 1 28 0v12"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="6"
              strokeLinecap="round"
              initial={false}
              animate={{ y: locked ? 0 : -9 }}
              transition={{ type: "spring", stiffness: 700, damping: 14 }}
            />
            <motion.rect
              x="10"
              y="32"
              width="44"
              height="36"
              rx="11"
              initial={false}
              animate={{ fill: locked ? "var(--violet)" : "var(--surface-strong)", scale: locked ? [1, 1.12, 1] : 1 }}
              transition={{ duration: 0.45 }}
              stroke="var(--ink)"
              strokeWidth="2"
              style={{ transformOrigin: "32px 50px" }}
            />
            <circle cx="32" cy="49" r="4.5" fill="var(--ink)" />
          </svg>
          <p className="mt-2 font-display text-5xl font-extrabold tabular-nums leading-none">{score}</p>
          <p className="mt-1 text-sm text-muted">{locked ? "Locked in for today" : "today's score"}</p>
        </div>
      </div>

      {/* glow wave when the lock snaps */}
      {locked && (
        <motion.div
          key="wave"
          className="pointer-events-none absolute inset-0 rounded-full border-2"
          style={{ borderColor: "var(--violet)" }}
          initial={{ scale: 0.6, opacity: 0.9 }}
          animate={{ scale: 1.25, opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      )}
    </div>
  );
}
