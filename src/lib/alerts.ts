// The LockIn alert catalogue and the rules for when each one is due.
import type { SoundName } from "./sounds";

export type AlertKind = "water" | "breaks" | "eyes" | "stretch" | "sleep" | "morning" | "evening";
export type RepeatingKind = "water" | "breaks" | "eyes" | "stretch";

export type AlertPrefs = {
  water: number; // minutes between reminders
  breaks: number;
  eyes: number;
  stretch: number;
  morning: boolean; // "how did you sleep?" after waking
  evening: boolean; // streak saver at 9 pm when the ring is low
  desktop: boolean; // also show system notifications when the tab is in the background
};

export const DEFAULT_PREFS: AlertPrefs = { water: 75, breaks: 90, eyes: 30, stretch: 60, morning: true, evening: true, desktop: false };

export const INTERVAL_CHOICES: Record<RepeatingKind, number[]> = {
  water: [45, 60, 75, 90, 120],
  breaks: [50, 60, 90, 120],
  eyes: [20, 30, 45, 60],
  stretch: [30, 45, 60, 90],
};

export type AlertDef = {
  kind: AlertKind;
  emoji: string;
  title: string;
  body: string;
  sound: SoundName;
  action: string; // main button
  color: string;
};

export const ALERTS: Record<AlertKind, AlertDef> = {
  water: { kind: "water", emoji: "💧", title: "Drink some water", body: "A glass now keeps your focus sharp.", sound: "water", action: "Log a glass", color: "var(--water)" },
  breaks: { kind: "breaks", emoji: "☕", title: "Time for a short break", body: "One minute of slow breathing resets your head.", sound: "break", action: "Breathe for 1 min", color: "var(--mint)" },
  eyes: { kind: "eyes", emoji: "👀", title: "Rest your eyes", body: "Look at something far away for 20 seconds.", sound: "eyes", action: "Start 20 seconds", color: "var(--cyan)" },
  stretch: { kind: "stretch", emoji: "🧍", title: "Stand up and stretch", body: "Roll your shoulders, stretch your back, shake out your legs.", sound: "stretch", action: "Done", color: "var(--amber)" },
  sleep: { kind: "sleep", emoji: "🌙", title: "Wind down for sleep", body: "Bedtime in 30 minutes. Screens off soon, and write tomorrow's first task.", sound: "sleep", action: "Okay, winding down", color: "var(--violet)" },
  morning: { kind: "morning", emoji: "🌅", title: "Good morning!", body: "How did you sleep? Log it to fill your sleep ring.", sound: "badge", action: "Log my sleep", color: "var(--amber)" },
  evening: { kind: "evening", emoji: "🔥", title: "Save your day", body: "Your ring is still low. One focus session or a few habits will lift it.", sound: "streak", action: "Start Lock In", color: "var(--rose)" },
};

/** Minutes since midnight, now, in the given time zone. */
export function minutesNow(timezone: string, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

export const toMinutes = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/** True between wake time and bedtime (handles bedtimes after midnight). */
export function isAwake(now: number, wake: number, sleep: number) {
  return wake < sleep ? now >= wake && now < sleep : now >= wake || now < sleep;
}

/** Minutes from `a` forward to `b` on a 24h clock. */
export const ahead = (a: number, b: number) => (b - a + 1440) % 1440;

/** Everything the alert engine needs from a profile. */
export function alertSetupFrom(p: {
  reminders: { water: boolean; breaks: boolean; eyes: boolean; stretch: boolean; sleep: boolean };
  alert_prefs?: Partial<AlertPrefs> | null;
  wake_time: string;
  sleep_time: string;
  timezone: string;
  sound_on: boolean;
}) {
  return {
    reminders: p.reminders,
    prefs: { ...DEFAULT_PREFS, ...(p.alert_prefs ?? {}) },
    wake: p.wake_time,
    sleep: p.sleep_time,
    timezone: p.timezone,
    soundOn: p.sound_on,
  };
}
