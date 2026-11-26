"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { saveToday } from "@/lib/day-server";
import { dayIn, type DayLog } from "@/lib/day";
import type { AmbientKind } from "@/lib/ambient";

export type FocusSession = {
  id: string;
  day: string;
  label: string | null;
  planned_minutes: number;
  actual_minutes: number;
  completed: boolean;
  distractions: number;
  ambient: AmbientKind | null;
  started_at: string;
  ended_at: string;
};

const AMBIENTS = ["none", "rain", "cafe", "forest", "waves", "brown"];

type Result = { ok: true; session: FocusSession; log: DayLog } | { ok: false; error: string };

// Saves a finished (or ended early) focus session and adds its minutes to today's Focus.
export async function saveFocusSession(input: {
  label: string;
  plannedMinutes: number;
  actualMinutes: number;
  startedAt: string;
  completed: boolean;
  distractions: number;
  ambient: string;
}): Promise<Result> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { ok: false, error: "You're logged out. Log in again to save this session." };

  const started = new Date(input.startedAt);
  const now = Date.now();
  const elapsed = (now - started.getTime()) / 60000;
  const planned = Math.round(Number(input.plannedMinutes));
  const actual = Math.round(Number(input.actualMinutes));

  // The timer runs in the browser, so check the numbers make sense before trusting them.
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 12 * 60) return { ok: false, error: "This session's start time looks wrong, so it wasn't saved." };
  if (!(planned >= 1 && planned <= 240) || !(actual >= 1 && actual <= planned)) return { ok: false, error: "Session length must be between 1 minute and the time you planned." };
  if (actual > elapsed + 1) return { ok: false, error: "That's more minutes than have passed since you started." };

  const { data: session, error } = await supabase
    .from("focus_sessions")
    .insert({
      user_id: user.id,
      day: dayIn(profile.timezone),
      label: input.label.trim().slice(0, 80) || null,
      planned_minutes: planned,
      actual_minutes: actual,
      completed: Boolean(input.completed),
      distractions: Math.min(99, Math.max(0, Math.round(Number(input.distractions) || 0))),
      ambient: AMBIENTS.includes(input.ambient) ? input.ambient : "none",
      started_at: started.toISOString(),
    })
    .select("*")
    .single<FocusSession>();

  if (error || !session) return { ok: false, error: "Couldn't save the session. Check your connection and try again." };

  const res = await saveToday((cur) => ({ focus_minutes: cur.focus_minutes + actual }));
  if (!res.ok) return res;
  return { ok: true, session, log: res.log };
}

// Removes one of today's sessions (e.g. started by mistake) and takes its minutes back off.
export async function deleteFocusSession(id: string): Promise<{ ok: true; log: DayLog } | { ok: false; error: string }> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return { ok: false, error: "You're logged out." };

  const { data: s } = await supabase.from("focus_sessions").select("actual_minutes, day").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!s) return { ok: false, error: "That session no longer exists." };
  if (s.day !== dayIn(profile.timezone)) return { ok: false, error: "Only today's sessions can be removed." };

  const { error } = await supabase.from("focus_sessions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't remove it. Try again." };

  return saveToday((cur) => ({ focus_minutes: Math.max(0, cur.focus_minutes - s.actual_minutes) }));
}

// Logs one glass of water from the break screen.
export async function addWaterGlass(): Promise<{ ok: true; log: DayLog } | { ok: false; error: string }> {
  return saveToday((cur) => ({ water: cur.water + 1 }));
}
