import { getCurrentUser } from "@/lib/supabase/server";
import { dayIn, emptyDay, scoreOf, segmentsFor, type DayLog, type HabitProgress, type MealKey, type MealRating, type Meals } from "@/lib/day";
import { isScheduled, type Habit } from "@/lib/habits";
import type { createClient } from "@/lib/supabase/server";

type DB = Awaited<ReturnType<typeof createClient>>;

/** How many of the habits scheduled for `day` are checked off. */
export async function habitProgress(supabase: DB, userId: string, day: string): Promise<HabitProgress> {
  const [{ data: habits }, { data: checks }] = await Promise.all([
    supabase.from("habits").select("id, days").eq("user_id", userId).is("archived_at", null).returns<Pick<Habit, "id" | "days">[]>(),
    supabase.from("habit_checks").select("habit_id").eq("user_id", userId).eq("day", day),
  ]);
  const due = (habits ?? []).filter((h) => isScheduled(h, day));
  const done = new Set((checks ?? []).map((c) => c.habit_id as string));
  return { total: due.length, done: due.filter((h) => done.has(h.id)).length };
}

const MEAL_KEYS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];
const RATINGS: MealRating[] = ["good", "okay", "junk"];

export type DayPatch = Partial<Pick<DayLog, "water" | "focus_minutes" | "sleep_minutes" | "move_minutes" | "mood" | "note" | "steps" | "meals">>;

const int = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

export type SaveResult = { ok: true; log: DayLog } | { ok: false; error: string };

/**
 * Loads today's log for the signed-in person, applies a change, re-scores it and saves it.
 * `change` receives the current row so it can add to values (e.g. focus minutes from a timer).
 */
export async function saveToday(change: (current: DayLog) => DayPatch): Promise<SaveResult> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { ok: false, error: "You're logged out. Log in again to save." };

  const day = dayIn(profile.timezone);
  const [{ data: existing }, habits] = await Promise.all([
    supabase.from("day_logs").select("*").eq("user_id", user.id).eq("day", day).maybeSingle<DayLog>(),
    habitProgress(supabase, user.id, day),
  ]);
  const current = existing ?? emptyDay(day);
  const patch = change(current);

  const clean: DayPatch = {};
  if ("water" in patch) clean.water = int(patch.water, 0, 40);
  if ("focus_minutes" in patch) clean.focus_minutes = int(patch.focus_minutes, 0, 1440);
  if ("move_minutes" in patch) clean.move_minutes = int(patch.move_minutes, 0, 1440);
  if ("sleep_minutes" in patch) clean.sleep_minutes = patch.sleep_minutes == null ? null : int(patch.sleep_minutes, 0, 1440);
  if ("mood" in patch) clean.mood = patch.mood == null ? null : int(patch.mood, 1, 5);
  if ("note" in patch) clean.note = patch.note?.trim().slice(0, 280) || null;
  if ("steps" in patch) clean.steps = int(patch.steps, 0, 100000);
  if ("meals" in patch) {
    const meals: Meals = {};
    for (const k of MEAL_KEYS) {
      const v = patch.meals?.[k];
      if (v && RATINGS.includes(v)) meals[k] = v;
    }
    clean.meals = meals;
  }

  const next = { ...current, ...clean };
  const score = scoreOf(segmentsFor(next, profile, habits));

  const { data, error } = await supabase
    .from("day_logs")
    .upsert(
      {
        user_id: user.id,
        day,
        water: next.water,
        focus_minutes: next.focus_minutes,
        sleep_minutes: next.sleep_minutes,
        move_minutes: next.move_minutes,
        mood: next.mood,
        note: next.note,
        steps: next.steps ?? 0,
        meals: next.meals ?? {},
        score,
        // A day counts as locked only while its score is 100; keep the first time it got there.
        locked_at: score >= 100 ? (current.locked_at ?? new Date().toISOString()) : null,
      },
      { onConflict: "user_id,day" },
    )
    .select("*")
    .single<DayLog>();

  if (error || !data) return { ok: false, error: "Couldn't save. Check your connection and try again." };
  return { ok: true, log: data };
}
