"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { colorVar, scheduleLabel, streakEmoji } from "@/lib/habits";
import type { HabitWithHistory } from "@/lib/habits-server";

// One habit with a big tick button. Used on the Habits page and the Today page.
export default function HabitRow({ habit, done, onToggle, compact }: { habit: HabitWithHistory; done: boolean; onToggle: () => void; compact?: boolean }) {
  const c = colorVar(habit.color);
  return (
    <motion.button
      layout
      onClick={onToggle}
      aria-pressed={done}
      aria-label={`${habit.name}: ${done ? "done" : "not done"}`}
      whileTap={{ scale: 0.98 }}
      className={`relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl text-left ring-1 transition ${compact ? "p-3" : "p-4"} ${done ? "ring-transparent" : "bg-surface ring-line hover:ring-2"}`}
      style={{ ["--tw-ring-color" as string]: done ? "transparent" : undefined, background: done ? `color-mix(in srgb, ${c} 14%, transparent)` : undefined }}
    >
      <span className={`grid shrink-0 place-items-center rounded-xl ${compact ? "h-10 w-10 text-xl" : "h-12 w-12 text-2xl"}`} style={{ background: `color-mix(in srgb, ${c} 16%, transparent)` }}>
        {habit.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-semibold ${done ? "text-muted line-through decoration-2" : ""}`} style={done ? { textDecorationColor: c } : undefined}>
          {habit.name}
        </span>
        <span className="block text-sm text-muted">
          {habit.streak > 0 ? `${streakEmoji(habit.streak)} ${habit.streak} day streak` : compact ? "Start a streak today" : scheduleLabel(habit.days)}
        </span>
      </span>
      <motion.span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2"
        initial={false}
        animate={{ background: done ? c : "rgba(0,0,0,0)", borderColor: done ? c : "var(--line)", scale: done ? [1, 1.25, 1] : 1 }}
        transition={{ duration: 0.3 }}
      >
        {done && (
          <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} className="text-white">
            <Check size={18} strokeWidth={3} />
          </motion.span>
        )}
      </motion.span>
    </motion.button>
  );
}
