import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { dayIn } from "@/lib/day";
import { loadHabits } from "@/lib/habits-server";
import AppHeader from "@/components/today/AppHeader";
import { alertSetupFrom } from "@/lib/alerts";
import HabitsBoard from "@/components/habits/HabitsBoard";

export const metadata = { title: "Habits | LockIn" };

export default async function Page() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/habits");
  if (!profile?.onboarded) redirect("/onboarding");

  const today = dayIn(profile.timezone);
  const habits = await loadHabits(supabase, user.id, today);

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} />
      <HabitsBoard initial={habits} today={today} soundOn={profile.sound_on} />
    </div>
  );
}
