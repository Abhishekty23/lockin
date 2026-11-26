"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { dayIn, emptyDay, scoreOf, segmentsFor, type DayLog } from "@/lib/day";

export type DayPatch = Partial<Pick<DayLog, "water" | "focus_minutes" | "sleep_minutes" | "move_minutes" | "mood" | "note">>;

const int = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

// Saves changes to today's log and returns the saved row (with the score worked out on the server).
export async function updateToday(patch: DayPatch): Promise<{ ok: true; log: DayLog } | { ok: false; error: string }> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { ok: false, error: "You're logged out. Log in again to save." };

  const day = dayIn(profile.timezone);
  const { data: existing } = await supabase.from("day_logs").select("*").eq("user_id", user.id).eq("day", day).maybeSingle<DayLog>();
  const current = existing ?? emptyDay(day);

  const clean: DayPatch = {};
  if ("water" in patch) clean.water = int(patch.water, 0, 40);
  if ("focus_minutes" in patch) clean.focus_minutes = int(patch.focus_minutes, 0, 1440);
  if ("move_minutes" in patch) clean.move_minutes = int(patch.move_minutes, 0, 1440);
  if ("sleep_minutes" in patch) clean.sleep_minutes = patch.sleep_minutes == null ? null : int(patch.sleep_minutes, 0, 1440);
  if ("mood" in patch) clean.mood = patch.mood == null ? null : int(patch.mood, 1, 5);
  if ("note" in patch) clean.note = patch.note?.trim().slice(0, 280) || null;

  const next = { ...current, ...clean };
  const score = scoreOf(segmentsFor(next, profile));

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
        score,
        locked_at: current.locked_at ?? (score >= 100 ? new Date().toISOString() : null),
      },
      { onConflict: "user_id,day" },
    )
    .select("*")
    .single<DayLog>();

  if (error || !data) return { ok: false, error: "Couldn't save. Check your connection and try again." };
  return { ok: true, log: data };
}
