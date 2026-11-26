import { getCurrentUser } from "@/lib/supabase/server";
import { dayIn, emptyDay, scoreOf, segmentsFor, type DayLog } from "@/lib/day";

export type DayPatch = Partial<Pick<DayLog, "water" | "focus_minutes" | "sleep_minutes" | "move_minutes" | "mood" | "note">>;

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
  const { data: existing } = await supabase.from("day_logs").select("*").eq("user_id", user.id).eq("day", day).maybeSingle<DayLog>();
  const current = existing ?? emptyDay(day);
  const patch = change(current);

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
