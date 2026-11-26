"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { saveToday } from "@/lib/day-server";
import { DEFAULT_PREFS, INTERVAL_CHOICES, type AlertPrefs, type RepeatingKind } from "@/lib/alerts";

const AVATARS = ["🦉", "🦊", "🐼", "🐯", "🐺", "🦁", "🐨", "🐸", "🐧", "🦄", "🐙", "🌱"];

export type SettingsInput = {
  fullName: string;
  avatar: string;
  wakeTime: string;
  sleepTime: string;
  focusGoalMinutes: number;
  waterGoal: number;
  moveGoalMinutes: number;
  stepsGoal: number;
  soundOn: boolean;
  reminders: { water: boolean; breaks: boolean; eyes: boolean; stretch: boolean; sleep: boolean };
  prefs: AlertPrefs;
};

const time = (v: string, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(n) || lo)));

export async function saveSettings(input: SettingsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { ok: false, error: "You're logged out. Log in again." };
  const name = input.fullName.trim().slice(0, 60);
  if (!name) return { ok: false, error: "Your name can't be empty." };

  const prefs: AlertPrefs = { ...DEFAULT_PREFS };
  for (const k of ["water", "breaks", "eyes", "stretch"] as RepeatingKind[]) {
    const v = Number(input.prefs[k]);
    prefs[k] = INTERVAL_CHOICES[k].includes(v) ? v : DEFAULT_PREFS[k];
  }
  prefs.morning = Boolean(input.prefs.morning);
  prefs.evening = Boolean(input.prefs.evening);
  prefs.desktop = Boolean(input.prefs.desktop);

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: name,
      avatar: AVATARS.includes(input.avatar) ? input.avatar : "🦉",
      wake_time: time(input.wakeTime, "06:30"),
      sleep_time: time(input.sleepTime, "22:30"),
      focus_goal_minutes: clamp(input.focusGoalMinutes, 30, 720),
      water_goal: clamp(input.waterGoal, 4, 15),
      move_goal_minutes: clamp(input.moveGoalMinutes, 10, 180),
      steps_goal: clamp(input.stepsGoal, 2000, 30000),
      sound_on: Boolean(input.soundOn),
      reminders: {
        water: Boolean(input.reminders.water),
        breaks: Boolean(input.reminders.breaks),
        eyes: Boolean(input.reminders.eyes),
        stretch: Boolean(input.reminders.stretch),
        sleep: Boolean(input.reminders.sleep),
      },
      alert_prefs: prefs,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your settings. Try again." };

  // Goals changed: re-score today so the ring matches
  await saveToday(() => ({}));
  return { ok: true };
}
