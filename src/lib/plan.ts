// Types and small helpers for the Plan page.
import { addDays, weekdayOf } from "./plan-dates";
import type { HabitColor } from "./habits";

export type Task = {
  id: string;
  title: string;
  priority: 1 | 2 | 3;
  due: string | null;
  estimate_minutes: number | null;
  goal_id: string | null;
  done_at: string | null;
  created_at: string;
};

export type Milestone = { id: string; goal_id: string; title: string; done_at: string | null; position: number };

export type Goal = {
  id: string;
  title: string;
  why: string | null;
  emoji: string;
  color: HabitColor;
  target_date: string | null;
  achieved_at: string | null;
  created_at: string;
  milestones: Milestone[];
};

export type BlockKind = "study" | "work" | "health" | "break" | "personal" | "other";
export type Block = { id: string; day: string; start_min: number; end_min: number; title: string; kind: BlockKind };

export type WeekPlan = { week_start: string; priorities: string[]; wins: string | null; lessons: string | null };

export const BLOCK_KINDS: { id: BlockKind; label: string; color: string; emoji: string }[] = [
  { id: "study", label: "Study", color: "var(--violet)", emoji: "📚" },
  { id: "work", label: "Work", color: "var(--water)", emoji: "💼" },
  { id: "health", label: "Health", color: "var(--mint)", emoji: "💪" },
  { id: "break", label: "Break", color: "var(--amber)", emoji: "☕" },
  { id: "personal", label: "Personal", color: "var(--rose)", emoji: "🏠" },
  { id: "other", label: "Other", color: "var(--cyan)", emoji: "✨" },
];
export const kindOf = (k: BlockKind) => BLOCK_KINDS.find((x) => x.id === k) ?? BLOCK_KINDS[5];

export const PRIORITIES = [
  { v: 1 as const, label: "High", color: "var(--rose)" },
  { v: 2 as const, label: "Normal", color: "var(--amber)" },
  { v: 3 as const, label: "Low", color: "var(--muted)" },
];

/** Monday of the week that contains `day`. */
export const weekStart = (day: string) => addDays(day, -((weekdayOf(day) + 6) % 7));

export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function dueLabel(due: string | null, today: string) {
  if (!due) return null;
  if (due === today) return "Today";
  if (due === addDays(today, 1)) return "Tomorrow";
  if (due < today) return due === addDays(today, -1) ? "Yesterday" : "Overdue";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${due}T12:00:00Z`));
}

/** Open tasks first by date (overdue and today first), then priority. */
export function sortTasks(a: Task, b: Task) {
  if (!!a.done_at !== !!b.done_at) return a.done_at ? 1 : -1;
  const ad = a.due ?? "9999-12-31";
  const bd = b.due ?? "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.created_at < b.created_at ? -1 : 1;
}
