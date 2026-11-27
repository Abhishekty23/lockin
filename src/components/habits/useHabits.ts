"use client";

import { safe } from "@/lib/net";

import { useState } from "react";
import { sounds } from "@/lib/sounds";
import { addDays, type DayLog } from "@/lib/day";
import { bestStreak, currentStreak, isScheduled } from "@/lib/habits";
import type { HabitWithHistory } from "@/lib/habits-server";
import { archiveHabit, createHabit, toggleHabit, updateHabit, type HabitInput } from "@/app/habits/actions";

// Habits state for a page: ticking, adding, editing and removing, with instant updates on screen.
export function useHabits({
  initial,
  today,
  soundOn,
  onLog,
  onError,
}: {
  initial: HabitWithHistory[];
  today: string;
  soundOn: boolean;
  onLog?: (log: DayLog) => void;
  onError: (msg: string) => void;
}) {
  const [habits, setHabits] = useState(initial);
  const from = addDays(today, -119);

  const withStats = (h: HabitWithHistory, doneDays: string[]): HabitWithHistory => {
    const set = new Set(doneDays);
    return { ...h, doneDays, streak: currentStreak(h, set, today), best: bestStreak(h, set, from, today) };
  };

  const dueToday = habits.filter((h) => isScheduled(h, today));
  const doneToday = dueToday.filter((h) => h.doneDays.includes(today));
  const progress = { done: doneToday.length, total: dueToday.length };

  /** Ticks a habit on/off. Resolves true when that tick finished every habit due today. */
  async function toggle(id: string) {
    const h = habits.find((x) => x.id === id);
    if (!h) return false;
    const done = !h.doneDays.includes(today);
    const before = habits;
    const next = habits.map((x) => (x.id === id ? withStats(x, done ? [...x.doneDays, today] : x.doneDays.filter((d) => d !== today)) : x));
    setHabits(next);

    const allDone = done && next.filter((x) => isScheduled(x, today)).every((x) => x.doneDays.includes(today));
    if (done && soundOn) {
      if (allDone) sounds.badge();
      else sounds.done();
    }

    const res = await safe(toggleHabit(id, done));
    if (!res.ok) {
      setHabits(before);
      onError(res.error);
      return false;
    }
    onLog?.(res.log);
    return allDone;
  }

  // Same checks the server makes, so changes can show on screen before the save finishes
  function check(input: HabitInput): string | HabitInput {
    const name = input.name.trim().slice(0, 60);
    const days = [...new Set(input.days)].filter((d) => d >= 0 && d <= 6).sort();
    if (!name) return "Give your habit a name.";
    if (days.length === 0) return "Pick at least one day for this habit.";
    return { ...input, name, days, emoji: input.emoji || "✅" };
  }

  async function create(input: HabitInput) {
    const v = check(input);
    if (typeof v === "string") return v;
    if (habits.length >= 20) return "You can have up to 20 habits. Remove one to add another.";
    const id = crypto.randomUUID();
    setHabits((hs) => [...hs, { id, ...v, position: hs.length, created_at: new Date().toISOString(), doneDays: [], streak: 0, best: 0 } as HabitWithHistory]);
    void safe(createHabit(input, id)).then((res) => {
      if (!res.ok) {
        setHabits((hs) => hs.filter((h) => h.id !== id));
        onError(res.error);
      } else onLog?.(res.log);
    });
    return null;
  }

  async function update(id: string, input: HabitInput) {
    const v = check(input);
    if (typeof v === "string") return v;
    const before = habits.find((h) => h.id === id);
    setHabits((hs) => hs.map((h) => (h.id === id ? withStats({ ...h, ...v }, h.doneDays) : h)));
    void safe(updateHabit(id, input)).then((res) => {
      if (!res.ok) {
        if (before) setHabits((hs) => hs.map((h) => (h.id === id ? before : h)));
        onError(res.error);
      } else onLog?.(res.log);
    });
    return null;
  }

  async function remove(id: string) {
    const before = habits;
    setHabits((hs) => hs.filter((h) => h.id !== id));
    void safe(archiveHabit(id)).then((res) => {
      if (!res.ok) {
        setHabits(before);
        onError(res.error);
      } else onLog?.(res.log);
    });
    return null;
  }

  return { habits, dueToday, doneToday, progress, toggle, create, update, remove };
}
