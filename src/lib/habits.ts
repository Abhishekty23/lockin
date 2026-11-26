// Habit rules shared by the server and the browser: schedules and streaks.
import { addDays } from "./day";

export type HabitColor = "violet" | "cyan" | "amber" | "water" | "rose" | "mint";

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: HabitColor;
  days: number[]; // 0 = Sunday … 6 = Saturday
  position: number;
  created_at: string;
};

export const HABIT_COLORS: HabitColor[] = ["violet", "cyan", "amber", "water", "rose", "mint"];
export const colorVar = (c: HabitColor) => `var(--${c})`;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day of the week (0 = Sunday) for a "YYYY-MM-DD" date. */
export const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

export const isScheduled = (habit: Pick<Habit, "days">, day: string) => habit.days.includes(weekday(day));

export function scheduleLabel(days: number[]) {
  const set = [...days].sort();
  if (set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "0,6") return "Weekends";
  return set.map((d) => WEEKDAYS[d]).join(", ");
}

/**
 * Current streak: scheduled days in a row that were done, counting back from today.
 * Today only counts once it's done, so an unfinished today doesn't break the streak.
 * Days the habit isn't scheduled are skipped.
 */
export function currentStreak(habit: Pick<Habit, "days" | "created_at">, done: Set<string>, today: string) {
  let streak = 0;
  const created = habit.created_at.slice(0, 10);
  for (let i = 0, day = today; i < 400 && day >= created; i++, day = addDays(day, -1)) {
    if (!isScheduled(habit, day)) continue;
    if (done.has(day)) streak++;
    else if (day !== today) break;
  }
  return streak;
}

/** Longest run of scheduled days done, within the dates given. */
export function bestStreak(habit: Pick<Habit, "days">, done: Set<string>, from: string, to: string) {
  let best = 0;
  let run = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (!isScheduled(habit, day)) continue;
    if (done.has(day)) best = Math.max(best, ++run);
    else if (day !== to) run = 0;
  }
  return best;
}

export function streakEmoji(n: number) {
  if (n >= 100) return "👑";
  if (n >= 30) return "☄️";
  if (n >= 14) return "💥";
  if (n >= 3) return "🔥";
  return n > 0 ? "🌱" : "";
}

export const TEMPLATES: { name: string; emoji: string; color: HabitColor; days: number[] }[] = [
  { name: "Read 10 pages", emoji: "📖", color: "violet", days: [0, 1, 2, 3, 4, 5, 6] },
  { name: "Meditate 5 minutes", emoji: "🧘", color: "cyan", days: [0, 1, 2, 3, 4, 5, 6] },
  { name: "No phone for the first hour", emoji: "📵", color: "rose", days: [0, 1, 2, 3, 4, 5, 6] },
  { name: "Work out", emoji: "💪", color: "amber", days: [1, 3, 5] },
  { name: "Revise today's notes", emoji: "🧠", color: "mint", days: [1, 2, 3, 4, 5] },
  { name: "Plan tomorrow", emoji: "📝", color: "water", days: [0, 1, 2, 3, 4, 5, 6] },
  { name: "Make my bed", emoji: "🛏️", color: "cyan", days: [0, 1, 2, 3, 4, 5, 6] },
  { name: "Eat a fruit", emoji: "🍎", color: "rose", days: [0, 1, 2, 3, 4, 5, 6] },
];
