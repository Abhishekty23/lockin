"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { saveToday } from "@/lib/day-server";
import { dayIn, type DayLog } from "@/lib/day";
import type { AlertKind } from "@/lib/alerts";

const KINDS: AlertKind[] = ["water", "breaks", "eyes", "stretch", "sleep", "morning", "evening"];
const ACTIONS = ["shown", "done", "snoozed", "skipped"] as const;

/** What an alert needs to know right before it shows (so it can skip itself when it isn't needed). */
export async function alertContext(): Promise<{ water: number; waterGoal: number; sleepLogged: boolean; score: number } | null> {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return null;
  const { data } = await supabase
    .from("day_logs")
    .select("water, sleep_minutes, score")
    .eq("user_id", user.id)
    .eq("day", dayIn(profile.timezone))
    .maybeSingle<Pick<DayLog, "water" | "sleep_minutes" | "score">>();
  return { water: data?.water ?? 0, waterGoal: profile.water_goal, sleepLogged: data?.sleep_minutes != null, score: data?.score ?? 0 };
}

export async function logAlert(kind: AlertKind, action: (typeof ACTIONS)[number]) {
  if (!KINDS.includes(kind) || !ACTIONS.includes(action)) return;
  const { supabase, user } = await getCurrentUser();
  if (!user) return;
  await supabase.from("alert_events").insert({ user_id: user.id, kind, action });
}

/** "Log a glass" straight from a water alert. */
export async function waterFromAlert(): Promise<{ ok: boolean; water?: number }> {
  const res = await saveToday((cur) => ({ water: cur.water + 1 }));
  if (res.ok) await logAlert("water", "done");
  return res.ok ? { ok: true, water: res.log.water } : { ok: false };
}
