"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { saveToday } from "@/lib/day-server";
import { dayIn, type DayLog } from "@/lib/day";
import { HABIT_COLORS, type Habit, type HabitColor } from "@/lib/habits";

export type HabitInput = { name: string; emoji: string; color: HabitColor; days: number[] };
type Fail = { ok: false; error: string };

const MAX_HABITS = 20;

function clean(input: HabitInput): { error: string } | { value: HabitInput } {
  const name = input.name.trim().slice(0, 60);
  const days = [...new Set(input.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const emoji = [...(input.emoji || "✅")].slice(0, 4).join("") || "✅";
  const color = HABIT_COLORS.includes(input.color) ? input.color : "violet";
  if (!name) return { error: "Give your habit a name." };
  if (days.length === 0) return { error: "Pick at least one day for this habit." };
  return { value: { name, days, emoji, color } };
}

// Re-score today after habits change, so the ring stays right.
const rescore = () => saveToday(() => ({}));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createHabit(input: HabitInput, id?: string): Promise<{ ok: true; habit: Habit; log: DayLog } | Fail> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { ok: false, error: "You're logged out. Log in again." };
  const c = clean(input);
  if ("error" in c) return { ok: false, error: c.error };
  const v = c.value;

  const { count } = await supabase.from("habits").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("archived_at", null);
  if ((count ?? 0) >= MAX_HABITS) return { ok: false, error: `You can have up to ${MAX_HABITS} habits. Remove one to add another.` };

  const { data, error } = await supabase
    .from("habits")
    .insert({ ...(id && UUID.test(id) ? { id } : {}), user_id: user.id, ...v, position: count ?? 0 })
    .select("id, name, emoji, color, days, position, created_at")
    .single<Habit>();
  if (error || !data) return { ok: false, error: "Couldn't add the habit. Try again." };
  const res = await rescore();
  if (!res.ok) return res;
  return { ok: true, habit: data, log: res.log };
}

export async function updateHabit(id: string, input: HabitInput): Promise<{ ok: true; habit: Habit; log: DayLog } | Fail> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { ok: false, error: "You're logged out. Log in again." };
  const c = clean(input);
  if ("error" in c) return { ok: false, error: c.error };
  const v = c.value;

  const { data, error } = await supabase
    .from("habits")
    .update(v)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, emoji, color, days, position, created_at")
    .single<Habit>();
  if (error || !data) return { ok: false, error: "Couldn't save the habit. Try again." };
  const res = await rescore();
  if (!res.ok) return res;
  return { ok: true, habit: data, log: res.log };
}

// Removes a habit from the list. Its history is kept.
export async function archiveHabit(id: string): Promise<{ ok: true; log: DayLog } | Fail> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { ok: false, error: "You're logged out. Log in again." };
  const { error } = await supabase.from("habits").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove the habit. Try again." };
  return rescore();
}

// Ticks a habit on or off for today.
export async function toggleHabit(id: string, done: boolean): Promise<{ ok: true; log: DayLog } | Fail> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { ok: false, error: "You're logged out. Log in again." };
  const day = dayIn(profile.timezone);

  const { error } = done
    ? await supabase.from("habit_checks").upsert({ habit_id: id, user_id: user.id, day }, { onConflict: "habit_id,day", ignoreDuplicates: true })
    : await supabase.from("habit_checks").delete().eq("habit_id", id).eq("user_id", user.id).eq("day", day);
  if (error) return { ok: false, error: "Couldn't save that. Try again." };
  return rescore();
}
