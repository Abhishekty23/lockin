// Sample data for the public demo at /demo. Made up, but shaped like a real person's last few months.
import { addDays } from "@/lib/day";
import type { InsightData } from "@/lib/insights";
import type { BadgeInput, Progress, ProgressLog } from "@/lib/progress";

const GOALS = { water_goal: 8, focus_goal_minutes: 180, move_goal_minutes: 30, steps_goal: 8000, wake_time: "06:30", sleep_time: "23:00" };

/** A seeded random generator, so the demo looks the same on every visit. */
function seeded(seed = 7) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function demoInsightData(today: string): InsightData {
  const r = seeded();
  const logs: InsightData["logs"] = [];
  const sessions: InsightData["sessions"] = [];
  const checks: InsightData["checks"] = [];
  const journal: InsightData["journal"] = [];
  for (let i = 0; i < 200; i++) {
    const day = addDays(today, -i);
    if (r() < 0.12 && i > 6) continue;
    const ramp = Math.min(1, 0.55 + (200 - i) / 300); // getting better over time
    const sleep = Math.round(340 + r() * 170);
    const focus = Math.round((60 + r() * 240) * ramp);
    const water = Math.round(3 + r() * 7 * ramp);
    const move = Math.round(r() * 60);
    // Better sleep and more focus tend to mean a better mood, like in real life
    const moodRaw = 2.6 + (sleep - 400) / 70 + (focus - 150) / 160 + (r() - 0.5) * 1.6;
    const mood = r() < 0.85 ? Math.max(1, Math.min(5, Math.round(moodRaw))) : null;
    const score = Math.min(100, Math.round((focus / 180 + water / 8 + sleep / 450 + Math.min(1, move / 30)) * 25 * (0.7 + r() * 0.35)));
    logs.push({ day, score: i === 3 || i === 11 ? 100 : score, water, focus_minutes: focus, sleep_minutes: r() < 0.9 ? sleep : null, move_minutes: move, steps: Math.round(2000 + r() * 9000), mood, journaled: r() < 0.55 });
    for (let k = 0; k < Math.round(focus / 50); k++) {
      const hour = [6, 9, 10, 11, 15, 16, 21][Math.floor(r() * 7)];
      sessions.push({
        day,
        label: ["DSA practice", "React project", "GATE maths", "Reading", "Portfolio", null][Math.floor(r() * 6)],
        actual_minutes: 25 + Math.round(r() * 30),
        completed: r() < 0.78,
        distractions: 0,
        started_at: new Date(`${day}T${String(hour).padStart(2, "0")}:10:00+05:30`).toISOString(),
      });
    }
    if (r() < 0.82) checks.push({ habit_id: "read", day });
    if (r() < 0.45) checks.push({ habit_id: "gym", day });
    if (r() < 0.62) checks.push({ habit_id: "phone", day });
    if (r() < 0.5) journal.push({ day, words: Math.round(60 + r() * 260) });
  }
  return {
    today,
    timezone: "Asia/Kolkata",
    goals: GOALS,
    logs: logs.reverse(),
    sessions,
    habits: [
      { id: "read", name: "Read 20 pages", emoji: "📚", color: "cyan", days: [0, 1, 2, 3, 4, 5, 6], created_at: "2026-01-01T00:00:00Z" },
      { id: "gym", name: "Gym", emoji: "💪", color: "amber", days: [1, 3, 5], created_at: "2026-01-01T00:00:00Z" },
      { id: "phone", name: "No phone after 11", emoji: "📵", color: "violet", days: [0, 1, 2, 3, 4, 5, 6], created_at: "2026-01-01T00:00:00Z" },
    ],
    checks,
    tasks: Array.from({ length: 64 }, (_, i) => ({ due: addDays(today, -Math.floor(i / 2)), done_at: `${addDays(today, -Math.floor(i / 2) + (i % 5 === 0 ? 1 : 0))}T10:00:00Z` })),
    overdue: 2,
    journal,
  };
}

export function demoProgress(data: InsightData): { progress: Progress; badgeInput: BadgeInput } {
  const logs: ProgressLog[] = data.logs.map((l) => ({ ...l, note: null }));
  // streak: days in a row at 50+, today allowed to be unfinished
  const kept = new Set(logs.filter((l) => l.score >= 50).map((l) => l.day));
  let d = kept.has(data.today) ? data.today : addDays(data.today, -1);
  let current = 0;
  while (kept.has(d)) {
    current++;
    d = addDays(d, -1);
  }
  const focusMinutes = logs.reduce((n, l) => n + l.focus_minutes, 0);
  return {
    progress: { current_streak: Math.max(current, 6), best_streak: 23, week_xp: 2140, total_xp: 18650, today_xp: 245 },
    badgeInput: {
      today: data.today,
      goals: data.goals,
      logs,
      bestStreak: 23,
      sessionsDone: data.sessions.filter((s) => s.completed).length,
      focusMinutes,
      earlyBird: true,
      nightOwl: false,
      habitChecks: data.checks.length,
      journalEntries: data.journal.length,
      journalWords: data.journal.reduce((n, j) => n + j.words, 0),
      tasksDone: data.tasks.length,
      friends: 3,
      cheersSent: 4,
    },
  };
}
