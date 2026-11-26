// Shared rules for a LockIn day: what fills the ring and how the score is worked out.
import type { RingSegment } from "@/components/ui/DayRing";

export type DayLog = {
  day: string;
  water: number;
  focus_minutes: number;
  sleep_minutes: number | null;
  move_minutes: number;
  mood: number | null;
  note: string | null;
  steps: number;
  meals: Meals;
  score: number;
  locked_at: string | null;
};

export type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
export type MealRating = "good" | "okay" | "junk";
export type Meals = Partial<Record<MealKey, MealRating>>;

/** How many of today's scheduled habits are done. */
export type HabitProgress = { done: number; total: number };

export type DayGoals = {
  water_goal: number;
  focus_goal_minutes: number;
  move_goal_minutes: number;
  steps_goal: number;
  wake_time: string;
  sleep_time: string;
};

export const emptyDay = (day: string): DayLog => ({
  day,
  water: 0,
  focus_minutes: 0,
  sleep_minutes: null,
  move_minutes: 0,
  mood: null,
  note: null,
  steps: 0,
  meals: {},
  score: 0,
  locked_at: null,
});

/** "YYYY-MM-DD" for a moment in the given time zone. */
export function dayIn(timezone: string, date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Shift a "YYYY-MM-DD" date by whole days. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/** Minutes between bedtime and wake time, e.g. 22:30 → 06:30 = 480. */
export function sleepTarget(goals: Pick<DayGoals, "sleep_time" | "wake_time">) {
  const diff = (toMin(goals.wake_time) - toMin(goals.sleep_time) + 1440) % 1440;
  return diff === 0 ? 480 : diff;
}

export function minutesBetween(from: string, to: string) {
  return (toMin(to) - toMin(from) + 1440) % 1440;
}

export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function segmentsFor(log: DayLog, goals: DayGoals, habits?: HabitProgress): RingSegment[] {
  const segments: RingSegment[] = [
    { key: "focus", label: "Focus", color: "var(--violet)", value: clamp01(log.focus_minutes / goals.focus_goal_minutes) },
    { key: "water", label: "Water", color: "var(--water)", value: clamp01(log.water / goals.water_goal) },
    { key: "sleep", label: "Sleep", color: "var(--cyan)", value: clamp01((log.sleep_minutes ?? 0) / sleepTarget(goals)) },
    // Moving counts as minutes or steps, whichever is further along
    {
      key: "move",
      label: "Move",
      color: "var(--amber)",
      value: clamp01(Math.max(log.move_minutes / goals.move_goal_minutes, (log.steps ?? 0) / (goals.steps_goal || 8000))),
    },
    { key: "journal", label: "Journal", color: "var(--rose)", value: log.note?.trim() ? 1 : 0 },
  ];
  // Habits only join the ring on days that have habits scheduled
  if (habits && habits.total > 0) segments.splice(4, 0, { key: "habits", label: "Habits", color: "var(--mint)", value: clamp01(habits.done / habits.total) });
  return segments;
}

export function scoreOf(segments: RingSegment[]) {
  if (!segments.length) return 0;
  return Math.round((segments.reduce((s, x) => s + clamp01(x.value), 0) / segments.length) * 100);
}
