import { addDays, dayIn } from "@/lib/day";
import type { createClient, Profile } from "@/lib/supabase/server";
import type { HabitRow, InsightData, LogRow, SessionRow, TaskRow } from "@/lib/insights";

type DB = Awaited<ReturnType<typeof createClient>>;

/** Everything Insights and the PDF need, for the signed-in person. Read-only. */
export async function loadInsights(supabase: DB, userId: string, profile: Profile): Promise<InsightData> {
  const today = dayIn(profile.timezone);
  const year = addDays(today, -371);
  const half = addDays(today, -180);

  const [logs, sessions, habits, checks, tasks, overdue, journal] = await Promise.all([
    supabase
      .from("day_logs")
      .select("day, score, water, focus_minutes, sleep_minutes, move_minutes, steps, mood, journaled")
      .eq("user_id", userId)
      .gte("day", year)
      .order("day")
      .limit(400)
      .returns<LogRow[]>(),
    supabase
      .from("focus_sessions")
      .select("day, label, actual_minutes, completed, distractions, started_at")
      .eq("user_id", userId)
      .gte("day", half)
      .order("started_at", { ascending: false })
      .limit(1000)
      .returns<SessionRow[]>(),
    supabase.from("habits").select("id, name, emoji, color, days, created_at").eq("user_id", userId).is("archived_at", null).order("position").returns<HabitRow[]>(),
    supabase.from("habit_checks").select("habit_id, day").eq("user_id", userId).gte("day", half).limit(1000),
    supabase.from("tasks").select("due, done_at").eq("user_id", userId).gte("done_at", `${half}T00:00:00Z`).limit(1000).returns<TaskRow[]>(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).is("done_at", null).lt("due", today),
    supabase.from("journal_entries").select("day, words").eq("user_id", userId).gte("day", half).limit(400),
  ]);

  return {
    today,
    timezone: profile.timezone,
    goals: {
      water_goal: profile.water_goal,
      focus_goal_minutes: profile.focus_goal_minutes,
      move_goal_minutes: profile.move_goal_minutes,
      steps_goal: profile.steps_goal,
      wake_time: profile.wake_time,
      sleep_time: profile.sleep_time,
    },
    logs: (logs.data ?? []).map((l) => ({ ...l, steps: l.steps ?? 0, journaled: !!l.journaled })),
    sessions: sessions.data ?? [],
    habits: habits.data ?? [],
    checks: (checks.data ?? []) as { habit_id: string; day: string }[],
    tasks: tasks.data ?? [],
    overdue: overdue.count ?? 0,
    journal: (journal.data ?? []) as { day: string; words: number }[],
  };
}
