import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { dayIn } from "@/lib/day";
import { alertSetupFrom } from "@/lib/alerts";
import { loadSocial } from "@/lib/social-server";
import { emptyProgress, type Cheer, type Progress, type ProgressLog } from "@/lib/progress";
import AppHeader from "@/components/today/AppHeader";
import StreaksBoard from "@/components/streaks/StreaksBoard";

export const metadata = { title: "Streaks | LockIn" };

/** Hour (0–23) of a timestamp in the person's time zone. */
function hourIn(iso: string, tz: string) {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso))) % 24;
  } catch {
    return new Date(iso).getUTCHours();
  }
}

export default async function Page() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/streaks");
  if (!profile?.onboarded) redirect("/onboarding");

  const today = dayIn(profile.timezone);
  const [progress, logs, sessions, checks, journal, tasks, received, sent, social] = await Promise.all([
    supabase.rpc("my_progress"),
    supabase.from("day_logs").select("day, score, focus_minutes, water, sleep_minutes, move_minutes, steps, note, journaled").eq("user_id", user.id).order("day").limit(1000).returns<ProgressLog[]>(),
    supabase.from("focus_sessions").select("started_at, completed").eq("user_id", user.id).limit(1000),
    supabase.from("habit_checks").select("habit_id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("journal_entries").select("words").eq("user_id", user.id).limit(1000),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("done_at", "is", null),
    supabase.from("cheers").select("id, from_user, to_user, emoji, day, created_at, seen_at").eq("to_user", user.id).order("created_at", { ascending: false }).limit(20).returns<Cheer[]>(),
    supabase.from("cheers").select("id", { count: "exact", head: true }).eq("from_user", user.id),
    loadSocial(supabase),
  ]);

  const mine = ((progress.data as Progress[] | null) ?? [])[0] ?? emptyProgress;
  const done = (sessions.data ?? []).filter((s) => s.completed);
  const hours = done.map((s) => hourIn(s.started_at as string, profile.timezone));
  const allLogs = (logs.data ?? []).map((l) => ({ ...l, steps: l.steps ?? 0, journaled: !!l.journaled }));

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} />
      <StreaksBoard
        today={today}
        username={profile.username}
        soundOn={profile.sound_on}
        progress={mine}
        badgeInput={{
          today,
          goals: {
            water_goal: profile.water_goal,
            focus_goal_minutes: profile.focus_goal_minutes,
            move_goal_minutes: profile.move_goal_minutes,
            steps_goal: profile.steps_goal,
            wake_time: profile.wake_time,
            sleep_time: profile.sleep_time,
          },
          logs: allLogs,
          bestStreak: mine.best_streak,
          sessionsDone: done.length,
          focusMinutes: allLogs.reduce((n, l) => n + l.focus_minutes, 0),
          earlyBird: hours.some((h) => h < 7 && h >= 3),
          nightOwl: hours.some((h) => h >= 22 || h < 3),
          habitChecks: checks.count ?? 0,
          journalEntries: journal.data?.length ?? 0,
          journalWords: (journal.data ?? []).reduce((n, j) => n + ((j.words as number) ?? 0), 0),
          tasksDone: tasks.count ?? 0,
          friends: social.connections.filter((c) => c.status === "accepted").length,
          cheersSent: sent.count ?? 0,
        }}
        initialSocial={social}
        cheers={received.data ?? []}
      />
    </div>
  );
}
