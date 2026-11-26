"use client";

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

    const res = await toggleHabit(id, done);
    if (!res.ok) {
      setHabits(before);
      onError(res.error);
      return false;
    }
    onLog?.(res.log);
    return allDone;
  }

  async function create(input: HabitInput) {
    const res = await createHabit(input);
    if (!res.ok) return res.error;
    setHabits((hs) => [...hs, { ...res.habit, doneDays: [], streak: 0, best: 0 }]);
    onLog?.(res.log);
    return null;
  }

  async function update(id: string, input: HabitInput) {
    const res = await updateHabit(id, input);
    if (!res.ok) return res.error;
    setHabits((hs) => hs.map((h) => (h.id === id ? withStats({ ...h, ...res.habit }, h.doneDays) : h)));
    onLog?.(res.log);
    return null;
  }

  async function remove(id: string) {
    const res = await archiveHabit(id);
    if (!res.ok) return res.error;
    setHabits((hs) => hs.filter((h) => h.id !== id));
    onLog?.(res.log);
    return null;
  }

  return { habits, dueToday, doneToday, progress, toggle, create, update, remove };
}
