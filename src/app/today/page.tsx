import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { addDays, dayIn, emptyDay, type DayLog } from "@/lib/day";
import { loadHabits } from "@/lib/habits-server";
import type { Task } from "@/lib/plan";
import AppHeader from "@/components/today/AppHeader";
import { alertSetupFrom } from "@/lib/alerts";
import TodayDashboard from "@/components/today/TodayDashboard";
import { emptyProgress, type Progress } from "@/lib/progress";

export const metadata = { title: "Today | LockIn" };

function greetingAt(timezone: string) {
  let hour = 9;
  try {
    hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date()));
  } catch {}
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function Page() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/today");
  if (!profile?.onboarded) redirect("/onboarding");

  const today = dayIn(profile.timezone);
  const from = addDays(today, -6);
  const [{ data: rows }, habits, { data: tasks }, { data: prog }] = await Promise.all([
    supabase.from("day_logs").select("*").eq("user_id", user.id).gte("day", from).lte("day", today).returns<DayLog[]>(),
    loadHabits(supabase, user.id, today),
    supabase
      .from("tasks")
      .select("id, title, priority, due, estimate_minutes, goal_id, done_at, created_at")
      .eq("user_id", user.id)
      .lte("due", today)
      .or(`done_at.is.null,due.eq.${today}`)
      .order("priority")
      .limit(12)
      .returns<Task[]>(),
    supabase.rpc("my_progress"),
  ]);

  const byDay = new Map((rows ?? []).map((r) => [r.day, r]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(from, i);
    const label = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
    return { day, label: day === today ? "Today" : label, score: byDay.get(day)?.score ?? 0, isToday: day === today };
  });

  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: profile.timezone }).format(new Date());

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} />
      <TodayDashboard
        firstName={(profile.full_name ?? "there").split(" ")[0]}
        avatar={profile.avatar}
        greeting={greetingAt(profile.timezone)}
        dateLabel={dateLabel}
        goals={{
          water_goal: profile.water_goal,
          focus_goal_minutes: profile.focus_goal_minutes,
          move_goal_minutes: profile.move_goal_minutes ?? 30,
          steps_goal: profile.steps_goal ?? 8000,
          wake_time: profile.wake_time,
          sleep_time: profile.sleep_time,
        }}
        soundOn={profile.sound_on}
        initial={byDay.get(today) ?? emptyDay(today)}
        week={week}
        today={today}
        initialHabits={habits}
        initialTasks={tasks ?? []}
        progress={((prog as Progress[] | null) ?? [])[0] ?? emptyProgress}
      />
    </div>
  );
}
