// Turns raw logs into the numbers, charts and findings on the Insights page and in the PDF report.
// Pure functions only, so the page and the PDF always agree.
import { addDays, formatMinutes, sleepTarget, type DayGoals } from "@/lib/day";
import { isScheduled, weekday, type HabitColor } from "@/lib/habits";

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const asRange = (v: unknown): Range => (RANGES.includes(Number(v) as Range) ? (Number(v) as Range) : 30);

export type LogRow = {
  day: string;
  score: number;
  water: number;
  focus_minutes: number;
  sleep_minutes: number | null;
  move_minutes: number;
  steps: number;
  mood: number | null;
  journaled: boolean;
};
export type SessionRow = { day: string; label: string | null; actual_minutes: number; completed: boolean; distractions: number; started_at: string };
export type HabitRow = { id: string; name: string; emoji: string; color: HabitColor; days: number[]; created_at: string };
export type TaskRow = { due: string | null; done_at: string };

export type InsightData = {
  today: string;
  timezone: string;
  goals: DayGoals;
  logs: LogRow[]; // last ~370 days
  sessions: SessionRow[]; // last 180 days
  habits: HabitRow[];
  checks: { habit_id: string; day: string }[]; // last 180 days
  tasks: TaskRow[]; // finished in the last 180 days
  overdue: number;
  journal: { day: string; words: number }[]; // last 180 days
};

export type Finding = { emoji: string; text: string; tone: "good" | "watch" | "neutral" };

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MOOD_NAMES = ["Rough", "Low", "Okay", "Good", "Great"];
export const MOOD_EMOJI = ["😫", "😕", "😐", "🙂", "🤩"];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (n: number) => Math.round(n);

/** Hour of day (0–23) of a timestamp in the person's time zone. */
function hourIn(iso: string, timezone: string) {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: timezone }).format(new Date(iso));
    return Number(h) % 24;
  } catch {
    return new Date(iso).getUTCHours();
  }
}

export function hourLabel(h: number) {
  const s = h % 12 || 12;
  return `${s} ${h < 12 ? "am" : "pm"}`;
}

export const dateLabel = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export type DayPoint = LogRow & { logged: boolean };

function measure(data: InsightData, range: Range) {
  const { today, goals } = data;
  const start = addDays(today, -(range - 1));
  const prevStart = addDays(start, -range);
  const byDay = new Map(data.logs.map((l) => [l.day, l]));
  const blank = (day: string): DayPoint => ({ day, score: 0, water: 0, focus_minutes: 0, sleep_minutes: null, move_minutes: 0, steps: 0, mood: null, journaled: false, logged: false });

  const days: DayPoint[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const l = byDay.get(d);
    days.push(l ? { ...l, logged: true } : blank(d));
  }
  const prevLogs = data.logs.filter((l) => l.day >= prevStart && l.day < start);
  const active = days.filter((d) => d.score > 0);

  /* ----- score ----- */
  const avgScore = round(avg(days.map((d) => d.score)));
  const prevAvg = round(sum(prevLogs.map((l) => l.score)) / range);
  const locked = days.filter((d) => d.score >= 100).length;
  const best = [...days].sort((a, b) => b.score - a.score)[0];

  /* ----- focus ----- */
  const sessions = data.sessions.filter((s) => s.day >= start && s.day <= today);
  const focusTotal = sum(days.map((d) => d.focus_minutes));
  const prevFocus = sum(prevLogs.map((l) => l.focus_minutes));
  const labels = new Map<string, number>();
  for (const s of sessions) {
    const k = s.label?.trim() || "No label";
    labels.set(k, (labels.get(k) ?? 0) + s.actual_minutes);
  }
  const sortedLabels = [...labels.entries()].sort((a, b) => b[1] - a[1]);
  const byLabel = sortedLabels.slice(0, 6).map(([label, minutes]) => ({ label, minutes }));
  const rest = sum(sortedLabels.slice(6).map(([, m]) => m));
  if (rest) byLabel.push({ label: "Other", minutes: rest });

  const byHour = Array.from({ length: 24 }, () => 0);
  for (const s of sessions) byHour[hourIn(s.started_at, data.timezone)] += s.actual_minutes;

  // Average per weekday, over the weekdays in the range (Monday first)
  const byWeekday = [1, 2, 3, 4, 5, 6, 0].map((w) => {
    const ds = days.filter((d) => weekday(d.day) === w);
    return { weekday: w, name: WEEKDAY_NAMES[w], minutes: round(avg(ds.map((d) => d.focus_minutes))) };
  });
  const completedRate = sessions.length ? round((sessions.filter((s) => s.completed).length / sessions.length) * 100) : 0;
  const longest = Math.max(0, ...sessions.map((s) => s.actual_minutes));

  /* ----- body ----- */
  const target = sleepTarget(goals);
  const nights = days.filter((d) => d.sleep_minutes != null);
  const sleepAvg = round(avg(nights.map((d) => d.sleep_minutes ?? 0)));
  const nightsOnTarget = nights.filter((d) => (d.sleep_minutes ?? 0) >= target - 15).length;
  const waterAvg = Math.round(avg(days.map((d) => d.water)) * 10) / 10;
  const waterDays = days.filter((d) => d.water >= goals.water_goal).length;
  const moveAvg = round(avg(days.map((d) => d.move_minutes)));
  const stepsAvg = round(avg(days.map((d) => d.steps ?? 0)));
  const moveDays = days.filter((d) => d.move_minutes >= goals.move_goal_minutes || (d.steps ?? 0) >= (goals.steps_goal || 8000)).length;

  /* ----- mood ----- */
  const moodDays = days.filter((d) => d.mood != null);
  const moodCounts = [1, 2, 3, 4, 5].map((v) => moodDays.filter((d) => d.mood === v).length);
  const moodAvg = moodDays.length ? Math.round(avg(moodDays.map((d) => d.mood ?? 0)) * 10) / 10 : null;
  const byMood = [1, 2, 3, 4, 5].map((v) => {
    const ds = moodDays.filter((d) => d.mood === v);
    const slept = ds.filter((d) => d.sleep_minutes != null);
    return {
      mood: v,
      days: ds.length,
      focus: round(avg(ds.map((d) => d.focus_minutes))),
      sleep: slept.length ? round(avg(slept.map((d) => d.sleep_minutes ?? 0))) : null,
      score: round(avg(ds.map((d) => d.score))),
    };
  });

  /* ----- habits ----- */
  const doneSet = new Set(data.checks.map((c) => `${c.habit_id}|${c.day}`));
  const habits = data.habits
    .map((h) => {
      const from = h.created_at.slice(0, 10) > start ? h.created_at.slice(0, 10) : start;
      let due = 0;
      let done = 0;
      for (let d = from; d <= today; d = addDays(d, 1)) {
        if (!isScheduled(h, d)) continue;
        due++;
        if (doneSet.has(`${h.id}|${d}`)) done++;
      }
      return { id: h.id, name: h.name, emoji: h.emoji, color: h.color, due, done, pct: due ? round((done / due) * 100) : 0 };
    })
    .filter((h) => h.due > 0)
    .sort((a, b) => b.pct - a.pct);

  /* ----- tasks and journal ----- */
  const tasks = data.tasks.filter((t) => t.done_at.slice(0, 10) >= start);
  const onTime = tasks.filter((t) => !t.due || t.done_at.slice(0, 10) <= t.due).length;
  const entries = data.journal.filter((j) => j.day >= start && j.day <= today);
  const words = sum(entries.map((j) => j.words));

  return {
    range,
    start,
    today,
    days,
    hasData: active.length > 0 || sessions.length > 0,
    score: { avg: avgScore, prev: prevAvg, delta: avgScore - prevAvg, locked, activeDays: active.length, best: best && best.score > 0 ? best : null },
    focus: {
      total: focusTotal,
      prev: prevFocus,
      perDay: round(focusTotal / range),
      sessions: sessions.length,
      completedRate,
      longest,
      byLabel,
      byHour,
      byWeekday,
      goal: goals.focus_goal_minutes,
      daysOnGoal: days.filter((d) => d.focus_minutes >= goals.focus_goal_minutes).length,
    },
    sleep: { avg: sleepAvg, target, nights: nights.length, onTarget: nightsOnTarget },
    water: { avg: waterAvg, goal: goals.water_goal, daysOnGoal: waterDays },
    move: { avg: moveAvg, steps: stepsAvg, goal: goals.move_goal_minutes, stepsGoal: goals.steps_goal || 8000, daysOnGoal: moveDays },
    mood: { counts: moodCounts, avg: moodAvg, logged: moodDays.length, byMood },
    habits,
    tasks: { done: tasks.length, onTime, overdue: data.overdue },
    journal: { entries: entries.length, words },
  };
}

type Measured = ReturnType<typeof measure>;

export function summarize(data: InsightData, range: Range) {
  const m = measure(data, range);
  return { ...m, findings: findingsFor(m, m.days) };
}

export type Summary = ReturnType<typeof summarize>;

/** Plain-language findings. Each one only appears when there's enough data behind it. */
function findingsFor(s: Measured, days: DayPoint[]): Finding[] {
  const out: Finding[] = [];
  const range = s.range;

  // Trend versus the previous period
  if (s.score.prev > 0 && Math.abs(s.score.delta) >= 5) {
    out.push(
      s.score.delta > 0
        ? { emoji: "📈", tone: "good", text: `Your average score is up ${s.score.delta} points from the ${range} days before.` }
        : { emoji: "📉", tone: "watch", text: `Your average score is down ${-s.score.delta} points from the ${range} days before.` },
    );
  }

  // Sleep and the next day's score
  const slept = days.filter((d) => d.sleep_minutes != null && d.score > 0);
  const good = slept.filter((d) => (d.sleep_minutes ?? 0) >= 420);
  const short = slept.filter((d) => (d.sleep_minutes ?? 0) < 420);
  if (good.length >= 3 && short.length >= 3) {
    const diff = round(avg(good.map((d) => d.score)) - avg(short.map((d) => d.score)));
    if (diff >= 5) out.push({ emoji: "😴", tone: "good", text: `On days after 7+ hours of sleep, your score averaged ${diff} points higher.` });
    else if (diff <= -5) out.push({ emoji: "😴", tone: "neutral", text: `Interesting: your score was ${-diff} points higher after shorter nights.` });
  }

  // Best weekday and best hour for focus
  const topDay = [...s.focus.byWeekday].sort((a, b) => b.minutes - a.minutes)[0];
  if (range >= 14 && topDay && topDay.minutes >= 15) out.push({ emoji: "📅", tone: "neutral", text: `You focus most on ${topDay.name}s, about ${formatMinutes(topDay.minutes)} on average.` });
  if (s.focus.sessions >= 4) {
    // best two-hour window
    let bestH = 0;
    let bestM = 0;
    for (let h = 0; h < 24; h++) {
      const m = s.focus.byHour[h] + s.focus.byHour[(h + 1) % 24];
      if (m > bestM) [bestH, bestM] = [h, m];
    }
    if (bestM > 0) out.push({ emoji: "⏰", tone: "neutral", text: `Your most focused time is ${hourLabel(bestH)} to ${hourLabel((bestH + 2) % 24)}. Protect it for hard work.` });
  }

  // Mood and focus
  const happy = days.filter((d) => (d.mood ?? 0) >= 4);
  const low = days.filter((d) => d.mood != null && (d.mood ?? 0) <= 2);
  if (happy.length >= 3 && low.length >= 2) {
    const diff = round(avg(happy.map((d) => d.focus_minutes)) - avg(low.map((d) => d.focus_minutes)));
    if (Math.abs(diff) >= 15) out.push({ emoji: "🙂", tone: "neutral", text: `On good-mood days you focused ${formatMinutes(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than on low days.` });
  }

  // Goals hit
  const logged = days.filter((d) => d.logged).length;
  if (logged >= 3) {
    out.push({
      emoji: "💧",
      tone: s.water.daysOnGoal >= logged / 2 ? "good" : "watch",
      text: `You hit your water goal on ${s.water.daysOnGoal} of ${range} days.`,
    });
  }
  if (s.focus.sessions >= 3) {
    out.push({
      emoji: "🎯",
      tone: s.focus.completedRate >= 70 ? "good" : "watch",
      text: `You finished ${s.focus.completedRate}% of your focus sessions without stopping early.`,
    });
  }

  // Habits
  if (s.habits.length >= 2) {
    const top = s.habits[0];
    const low2 = s.habits[s.habits.length - 1];
    out.push({ emoji: top.emoji, tone: "good", text: `${top.name} is your most consistent habit (${top.pct}%).` });
    if (low2.pct < 50 && low2.id !== top.id) out.push({ emoji: low2.emoji, tone: "watch", text: `${low2.name} needs attention: done ${low2.done} of ${low2.due} times.` });
  }

  if (s.score.locked > 0) out.push({ emoji: "🔒", tone: "good", text: `You fully locked in ${s.score.locked} ${s.score.locked === 1 ? "day" : "days"} (score 100).` });
  if (s.tasks.overdue > 0) out.push({ emoji: "⏳", tone: "watch", text: `${s.tasks.overdue} ${s.tasks.overdue === 1 ? "task is" : "tasks are"} past their due date.` });

  return out.slice(0, 7);
}

/** One year of scores for the heatmap, Monday-first weeks ending this week. */
export function yearGrid(data: InsightData) {
  const byDay = new Map(data.logs.map((l) => [l.day, l.score]));
  const lastSunday = addDays(data.today, (7 - weekday(data.today)) % 7);
  const first = addDays(lastSunday, -(53 * 7) + 1); // a Monday
  const weeks: { day: string; score: number | null; future: boolean }[][] = [];
  for (let w = 0; w < 53; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(first, w * 7 + i);
      col.push({ day, score: byDay.get(day) ?? null, future: day > data.today });
    }
    weeks.push(col);
  }
  const daysLogged = [...byDay.entries()].filter(([d, s]) => d > addDays(data.today, -365) && s > 0).length;
  return { weeks, daysLogged };
}
