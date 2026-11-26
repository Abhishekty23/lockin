import { addDays } from "@/lib/day";
import { bestStreak, currentStreak, type Habit } from "@/lib/habits";
import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

export type HabitWithHistory = Habit & { doneDays: string[]; streak: number; best: number };

/** Active habits with the days they were done (last 120 days) and their streaks. */
export async function loadHabits(supabase: DB, userId: string, today: string): Promise<HabitWithHistory[]> {
  const from = addDays(today, -119);
  const [{ data: habits }, { data: checks }] = await Promise.all([
    supabase
      .from("habits")
      .select("id, name, emoji, color, days, position, created_at")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("position")
      .order("created_at")
      .returns<Habit[]>(),
    supabase.from("habit_checks").select("habit_id, day").eq("user_id", userId).gte("day", from).lte("day", today),
  ]);

  const byHabit = new Map<string, string[]>();
  for (const c of checks ?? []) byHabit.set(c.habit_id, [...(byHabit.get(c.habit_id) ?? []), c.day]);

  return (habits ?? []).map((h) => {
    const doneDays = byHabit.get(h.id) ?? [];
    const set = new Set(doneDays);
    return { ...h, doneDays, streak: currentStreak(h, set, today), best: bestStreak(h, set, from, today) };
  });
}
