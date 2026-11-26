"use client";

import { motion } from "motion/react";

const COLORS = ["var(--violet)", "var(--cyan)", "var(--amber)", "var(--rose)", "var(--mint)", "var(--water)"];

// Burst of confetti from the centre of the ring when the day locks.
export default function Celebration() {
  const bits = Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * Math.PI * 2;
    const dist = 140 + ((i * 37) % 90);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, rot: (i * 47) % 360, color: COLORS[i % COLORS.length], round: i % 3 === 0 };
  });
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className={`absolute h-2.5 w-2.5 ${b.round ? "rounded-full" : "rounded-sm"}`}
          style={{ background: b.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: b.x, y: b.y + 60, opacity: 0, rotate: b.rot + 180, scale: 1 }}
          transition={{ duration: 1.6, ease: [0.2, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
