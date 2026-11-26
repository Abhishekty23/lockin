"use server";

import { getCurrentUser } from "@/lib/supabase/server";

const TRACKS = ["skills", "exam", "career", "fitness", "reading", "custom"] as const;
const AVATARS = ["🦉", "🦊", "🐼", "🐯", "🐺", "🦁", "🐨", "🐸", "🐧", "🦄", "🐙", "🌱"];

export type OnboardingInput = {
  fullName: string;
  avatar: string;
  tracks: string[];
  examName: string;
  customTrack: string;
  wakeTime: string;
  sleepTime: string;
  focusGoalMinutes: number;
  waterGoal: number;
  reminders: { water: boolean; breaks: boolean; eyes: boolean; stretch: boolean; sleep: boolean };
  soundOn: boolean;
  timezone: string;
};

const time = (v: string, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(n) || lo)));

// Saves the onboarding answers to the person's profile.
export async function saveOnboarding(input: OnboardingInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session ended. Log in again to finish setup." };

  const tracks = input.tracks.filter((t): t is (typeof TRACKS)[number] => (TRACKS as readonly string[]).includes(t));
  const name = input.fullName.trim().slice(0, 60);
  if (!name) return { ok: false, error: "Add your name on the first step." };
  if (tracks.length === 0) return { ok: false, error: "Pick at least one thing you're working on." };

  let timezone = "Asia/Kolkata";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: input.timezone });
    timezone = input.timezone;
  } catch {}

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: name,
      avatar: AVATARS.includes(input.avatar) ? input.avatar : "🦉",
      tracks,
      exam_name: tracks.includes("exam") ? input.examName.trim().slice(0, 60) || null : null,
      custom_track: tracks.includes("custom") ? input.customTrack.trim().slice(0, 60) || null : null,
      wake_time: time(input.wakeTime, "06:30"),
      sleep_time: time(input.sleepTime, "22:30"),
      focus_goal_minutes: clamp(input.focusGoalMinutes, 15, 960),
      water_goal: clamp(input.waterGoal, 1, 20),
      reminders: {
        water: Boolean(input.reminders.water),
        breaks: Boolean(input.reminders.breaks),
        eyes: Boolean(input.reminders.eyes),
        stretch: Boolean(input.reminders.stretch),
        sleep: Boolean(input.reminders.sleep),
      },
      sound_on: Boolean(input.soundOn),
      timezone,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Couldn't save your setup. Check your connection and try again." };
  return { ok: true };
}
