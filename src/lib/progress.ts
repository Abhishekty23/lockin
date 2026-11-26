// Levels, badges and per-activity streaks. XP and the main streak come from the database (my_progress, board).
import { addDays, sleepTarget, type DayGoals } from "@/lib/day";

/* ---------------- Levels ---------------- */
// Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000, 1500…
export const levelStart = (n: number) => 50 * n * (n - 1);

export function levelOf(xp: number) {
  let n = 1;
  while (levelStart(n + 1) <= xp) n++;
  const from = levelStart(n);
  const to = levelStart(n + 1);
  return { level: n, from, to, into: xp - from, need: to - from, pct: Math.min(1, (xp - from) / (to - from)), ...rankOf(n) };
}

const RANKS = [
  { min: 25, name: "Legend", emoji: "👑" },
  { min: 17, name: "Diamond", emoji: "💎" },
  { min: 12, name: "Rocket", emoji: "🚀" },
  { min: 8, name: "Charged", emoji: "⚡" },
  { min: 5, name: "Spark", emoji: "🔥" },
  { min: 3, name: "Sprout", emoji: "🌿" },
  { min: 1, name: "Seedling", emoji: "🌱" },
];
export const rankOf = (level: number) => {
  const r = RANKS.find((x) => level >= x.min) ?? RANKS[RANKS.length - 1];
  return { rank: r.name, rankEmoji: r.emoji };
};

export const XP_RULES = [
  { emoji: "⏱️", text: "1 XP for every focus minute" },
  { emoji: "💧", text: "5 XP per glass of water" },
  { emoji: "✅", text: "10 XP per habit and per task done" },
  { emoji: "🎯", text: "5 XP for each focus session you finish" },
  { emoji: "🏃", text: "1 XP for every 2 minutes you move" },
  { emoji: "😴", text: "10 XP for logging sleep" },
  { emoji: "✍️", text: "20 XP for journaling" },
  { emoji: "📈", text: "Half your day score, plus 50 for a locked day" },
];

/** What a streak's flame looks like as it grows. */
export function flameFor(n: number) {
  if (n >= 100) return { emoji: "🌋", label: "Volcanic" };
  if (n >= 30) return { emoji: "☄️", label: "Unstoppable" };
  if (n >= 14) return { emoji: "🔥🔥🔥", label: "Blazing" };
  if (n >= 7) return { emoji: "🔥🔥", label: "On fire" };
  if (n >= 1) return { emoji: "🔥", label: "Lit" };
  return { emoji: "🪵", label: "Ready to light" };
}

/* ---------------- Inputs ---------------- */
export type ProgressLog = {
  day: string;
  score: number;
  focus_minutes: number;
  water: number;
  sleep_minutes: number | null;
  move_minutes: number;
  steps: number;
  note: string | null;
  journaled: boolean;
};

export type BadgeInput = {
  today: string;
  goals: DayGoals;
  logs: ProgressLog[];
  bestStreak: number;
  sessionsDone: number;
  focusMinutes: number;
  earlyBird: boolean; // a session started before 7 am
  nightOwl: boolean; // a session started at 10 pm or later
  habitChecks: number;
  journalEntries: number;
  journalWords: number;
  tasksDone: number;
  friends: number;
  cheersSent: number;
};

/* ---------------- Per-activity streaks ---------------- */
function runs(days: Set<string>, today: string) {
  let day = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best };
}

export function activityStreaks(input: Pick<BadgeInput, "logs" | "goals" | "today">) {
  const { logs, goals, today } = input;
  const target = sleepTarget(goals);
  const pick = (ok: (l: ProgressLog) => boolean) => runs(new Set(logs.filter(ok).map((l) => l.day)), today);
  return [
    { key: "focus", emoji: "⏱️", name: "Focus", rule: "25+ minutes", color: "var(--violet)", ...pick((l) => l.focus_minutes >= 25) },
    { key: "water", emoji: "💧", name: "Water", rule: `${goals.water_goal} glasses`, color: "var(--water)", ...pick((l) => l.water >= goals.water_goal) },
    { key: "sleep", emoji: "😴", name: "Sleep", rule: "on target", color: "var(--cyan)", ...pick((l) => (l.sleep_minutes ?? 0) >= target - 30) },
    { key: "move", emoji: "🏃", name: "Move", rule: "goal met", color: "var(--amber)", ...pick((l) => l.move_minutes >= goals.move_goal_minutes || (l.steps ?? 0) >= (goals.steps_goal || 8000)) },
    { key: "journal", emoji: "✍️", name: "Journal", rule: "something written", color: "var(--rose)", ...pick((l) => Boolean(l.note?.trim()) || l.journaled) },
  ];
}

/* ---------------- Badges ---------------- */
export type Tier = "common" | "rare" | "epic" | "legendary";
export type Badge = { key: string; emoji: string; name: string; desc: string; tier: Tier; value: number; target: number; earned: boolean };

export function badgesFor(b: BadgeInput): Badge[] {
  const target = sleepTarget(b.goals);
  const count = (ok: (l: ProgressLog) => boolean) => b.logs.filter(ok).length;
  const locked = count((l) => l.score >= 100);
  const list: Omit<Badge, "earned">[] = [
    { key: "first-focus", emoji: "🎯", name: "First lock-in", desc: "Finish your first focus session", tier: "common", value: b.sessionsDone, target: 1 },
    { key: "streak-3", emoji: "🔥", name: "On fire", desc: "Keep a 3-day streak", tier: "common", value: b.bestStreak, target: 3 },
    { key: "hydrated", emoji: "💧", name: "Hydrated", desc: "Hit your water goal on 7 days", tier: "common", value: count((l) => l.water >= b.goals.water_goal), target: 7 },
    { key: "diary", emoji: "✍️", name: "Dear diary", desc: "Write 7 journal entries", tier: "common", value: b.journalEntries, target: 7 },
    { key: "planner", emoji: "🗓️", name: "Planner", desc: "Finish 25 tasks", tier: "common", value: b.tasksDone, target: 25 },
    { key: "friend", emoji: "🤝", name: "Better together", desc: "Add your first friend", tier: "common", value: b.friends, target: 1 },
    { key: "locked", emoji: "🔒", name: "Locked in", desc: "Fill your whole ring (score 100) once", tier: "rare", value: locked, target: 1 },
    { key: "streak-7", emoji: "⚡", name: "Week warrior", desc: "Keep a 7-day streak", tier: "rare", value: b.bestStreak, target: 7 },
    { key: "deep-10", emoji: "⏱️", name: "Deep worker", desc: "Focus for 10 hours in total", tier: "rare", value: Math.floor(b.focusMinutes / 60), target: 10 },
    { key: "early", emoji: "🌅", name: "Early bird", desc: "Start a focus session before 7 am", tier: "rare", value: b.earlyBird ? 1 : 0, target: 1 },
    { key: "owl", emoji: "🦉", name: "Night owl", desc: "Start a focus session after 10 pm", tier: "rare", value: b.nightOwl ? 1 : 0, target: 1 },
    { key: "rested", emoji: "😴", name: "Well rested", desc: "Sleep on target for 7 nights", tier: "rare", value: count((l) => (l.sleep_minutes ?? 0) >= target - 30), target: 7 },
    { key: "mover", emoji: "🏃", name: "Mover", desc: "Meet your move goal on 10 days", tier: "rare", value: count((l) => l.move_minutes >= b.goals.move_goal_minutes || (l.steps ?? 0) >= (b.goals.steps_goal || 8000)), target: 10 },
    { key: "cheer", emoji: "👏", name: "Cheerleader", desc: "Send 5 cheers to friends", tier: "rare", value: b.cheersSent, target: 5 },
    { key: "habits-50", emoji: "✅", name: "Habit builder", desc: "Tick off 50 habits", tier: "epic", value: b.habitChecks, target: 50 },
    { key: "words", emoji: "📚", name: "Storyteller", desc: "Write 5,000 words in your journal", tier: "epic", value: b.journalWords, target: 5000 },
    { key: "streak-30", emoji: "☄️", name: "Unstoppable", desc: "Keep a 30-day streak", tier: "epic", value: b.bestStreak, target: 30 },
    { key: "deep-100", emoji: "🧠", name: "Centurion", desc: "Focus for 100 hours in total", tier: "legendary", value: Math.floor(b.focusMinutes / 60), target: 100 },
    { key: "legend", emoji: "🏆", name: "Lock-in legend", desc: "Lock in 10 days (score 100)", tier: "legendary", value: locked, target: 10 },
    { key: "streak-100", emoji: "🌋", name: "Volcanic", desc: "Keep a 100-day streak", tier: "legendary", value: b.bestStreak, target: 100 },
  ];
  return list.map((x) => ({ ...x, value: Math.min(x.value, x.target), earned: x.value >= x.target }));
}

export const TIER_STYLE: Record<Tier, { label: string; color: string }> = {
  common: { label: "Common", color: "var(--mint)" },
  rare: { label: "Rare", color: "var(--cyan)" },
  epic: { label: "Epic", color: "var(--violet)" },
  legendary: { label: "Legendary", color: "var(--amber)" },
};

/* ---------------- Board ---------------- */
export type BoardRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar: string;
  current_streak: number;
  best_streak: number;
  week_xp: number;
  total_xp: number;
  today_score: number;
  is_me: boolean;
};
export type Connection = { other: string; username: string | null; full_name: string | null; avatar: string; direction: "in" | "out"; status: "pending" | "accepted"; created_at: string };
export type Cheer = { id: string; from_user: string; to_user: string; emoji: string; day: string; created_at: string; seen_at: string | null };
export const CHEER_EMOJI = ["👏", "🔥", "💪", "🎉", "❤️"] as const;
export type Progress = { current_streak: number; best_streak: number; week_xp: number; total_xp: number; today_xp: number };
export const emptyProgress: Progress = { current_streak: 0, best_streak: 0, week_xp: 0, total_xp: 0, today_xp: 0 };
