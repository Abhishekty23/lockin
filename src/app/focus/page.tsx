import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { dayIn } from "@/lib/day";
import AppHeader from "@/components/today/AppHeader";
import { alertSetupFrom } from "@/lib/alerts";
import FocusRoom from "@/components/focus/FocusRoom";
import type { FocusSession } from "./actions";

export const metadata = { title: "Lock In mode | LockIn" };

const TRACK_NAMES: Record<string, string> = {
  skills: "Learning",
  exam: "Exam prep",
  career: "Career",
  fitness: "Fitness",
  reading: "Reading",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ label?: string; minutes?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/focus");
  if (!profile?.onboarded) redirect("/onboarding");

  const today = dayIn(profile.timezone);
  const [{ data: sessions }, { data: log }, { data: todayTasks }] = await Promise.all([
    supabase.from("focus_sessions").select("*").eq("user_id", user.id).eq("day", today).order("started_at", { ascending: false }).returns<FocusSession[]>(),
    supabase.from("day_logs").select("focus_minutes").eq("user_id", user.id).eq("day", today).maybeSingle(),
    supabase.from("tasks").select("title").eq("user_id", user.id).is("done_at", null).lte("due", today).order("priority").limit(4),
  ]);

  const suggestions = profile.tracks
    .map((t) => (t === "exam" ? profile.exam_name || "Exam prep" : t === "custom" ? profile.custom_track || null : TRACK_NAMES[t]))
    .filter((x): x is string => Boolean(x));
  // Today's open tasks make good labels too
  const taskLabels = (todayTasks ?? []).map((t) => t.title as string).filter((t) => !suggestions.includes(t));

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} />
      <FocusRoom
        initialSessions={sessions ?? []}
        initialFocusMinutes={log?.focus_minutes ?? 0}
        goalMinutes={profile.focus_goal_minutes}
        suggestions={[...taskLabels, ...suggestions].slice(0, 7)}
        soundOn={profile.sound_on}
        timezone={profile.timezone}
        startLabel={typeof sp.label === "string" ? sp.label.slice(0, 80) : undefined}
        startMinutes={sp.minutes ? Math.min(180, Math.max(5, Math.round(Number(sp.minutes) / 5) * 5 || 25)) : undefined}
      />
    </div>
  );
}
