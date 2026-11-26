import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { addDays, dayIn } from "@/lib/day";
import { alertSetupFrom } from "@/lib/alerts";
import { weekStart, type Block, type Goal, type Milestone, type Task, type WeekPlan } from "@/lib/plan";
import AppHeader from "@/components/today/AppHeader";
import PlanBoard from "@/components/plan/PlanBoard";

export const metadata = { title: "Plan | LockIn" };

export default async function Page() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/plan");
  if (!profile?.onboarded) redirect("/onboarding");

  const today = dayIn(profile.timezone);
  const monday = weekStart(today);
  const lastMonday = addDays(monday, -7);

  const [tasks, goals, milestones, blocks, weeks] = await Promise.all([
    // open tasks, plus anything finished in the last 7 days
    supabase
      .from("tasks")
      .select("id, title, priority, due, estimate_minutes, goal_id, done_at, created_at")
      .eq("user_id", user.id)
      .or(`done_at.is.null,done_at.gte.${addDays(today, -7)}`)
      .limit(500)
      .returns<Task[]>(),
    supabase.from("goals").select("id, title, why, emoji, color, target_date, achieved_at, created_at").eq("user_id", user.id).is("archived_at", null).order("created_at").returns<Omit<Goal, "milestones">[]>(),
    supabase.from("milestones").select("id, goal_id, title, done_at, position").eq("user_id", user.id).returns<Milestone[]>(),
    supabase.from("timetable_blocks").select("id, day, start_min, end_min, title, kind").eq("user_id", user.id).eq("day", today).returns<Block[]>(),
    supabase.from("weekly_plans").select("week_start, priorities, wins, lessons").eq("user_id", user.id).in("week_start", [monday, lastMonday]).returns<WeekPlan[]>(),
  ]);

  const goalsWithSteps: Goal[] = (goals.data ?? []).map((g) => ({ ...g, milestones: (milestones.data ?? []).filter((m) => m.goal_id === g.id) }));
  const week = weeks.data?.find((w) => w.week_start === monday) ?? { week_start: monday, priorities: [], wins: null, lessons: null };
  const lastWeek = weeks.data?.find((w) => w.week_start === lastMonday) ?? null;

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} />
      <PlanBoard
        today={today}
        wake={profile.wake_time}
        sleep={profile.sleep_time}
        timezone={profile.timezone}
        soundOn={profile.sound_on}
        initialTasks={tasks.data ?? []}
        initialBlocks={blocks.data ?? []}
        initialGoals={goalsWithSteps}
        week={week}
        lastWeek={lastWeek}
      />
    </div>
  );
}
