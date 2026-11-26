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

export default async function Page() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/focus");
  if (!profile?.onboarded) redirect("/onboarding");

  const today = dayIn(profile.timezone);
  const [{ data: sessions }, { data: log }] = await Promise.all([
    supabase.from("focus_sessions").select("*").eq("user_id", user.id).eq("day", today).order("started_at", { ascending: false }).returns<FocusSession[]>(),
    supabase.from("day_logs").select("focus_minutes").eq("user_id", user.id).eq("day", today).maybeSingle(),
  ]);

  const suggestions = profile.tracks
    .map((t) => (t === "exam" ? profile.exam_name || "Exam prep" : t === "custom" ? profile.custom_track || null : TRACK_NAMES[t]))
    .filter((x): x is string => Boolean(x));

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} />
      <FocusRoom
        initialSessions={sessions ?? []}
        initialFocusMinutes={log?.focus_minutes ?? 0}
        goalMinutes={profile.focus_goal_minutes}
        suggestions={suggestions}
        soundOn={profile.sound_on}
        timezone={profile.timezone}
      />
    </div>
  );
}
