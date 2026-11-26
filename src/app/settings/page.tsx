import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { alertSetupFrom, DEFAULT_PREFS } from "@/lib/alerts";
import AppHeader from "@/components/today/AppHeader";
import SettingsForm from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings | LockIn" };

export default async function Page() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  if (!profile?.onboarded) redirect("/onboarding");

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} />
      <SettingsForm
        initial={{
          fullName: profile.full_name ?? "",
          avatar: profile.avatar,
          wakeTime: profile.wake_time.slice(0, 5),
          sleepTime: profile.sleep_time.slice(0, 5),
          focusGoalMinutes: profile.focus_goal_minutes,
          waterGoal: profile.water_goal,
          moveGoalMinutes: profile.move_goal_minutes ?? 30,
          stepsGoal: profile.steps_goal ?? 8000,
          soundOn: profile.sound_on,
          reminders: profile.reminders,
          prefs: { ...DEFAULT_PREFS, ...(profile.alert_prefs ?? {}) },
        }}
        email={user.email ?? ""}
      />
    </div>
  );
}
