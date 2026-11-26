import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { addDays, dayIn } from "@/lib/day";
import { alertSetupFrom } from "@/lib/alerts";
import { JOURNAL_COLS, type DayMood, type JournalEntry } from "@/lib/journal";
import AppHeader from "@/components/today/AppHeader";
import JournalBoard from "@/components/journal/JournalBoard";

export const metadata = { title: "Journal | LockIn" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/journal");
  if (!profile?.onboarded) redirect("/onboarding");

  const today = dayIn(profile.timezone);
  const from = addDays(today, -400);
  const [entries, days] = await Promise.all([
    supabase
      .from("journal_entries")
      .select(JOURNAL_COLS)
      .eq("user_id", user.id)
      .gte("day", from)
      .order("day", { ascending: false })
      .returns<JournalEntry[]>(),
    supabase
      .from("day_logs")
      .select("day, mood, note")
      .eq("user_id", user.id)
      .gte("day", from)
      .returns<DayMood[]>(),
  ]);

  const asked =
    sp.day &&
    /^\d{4}-\d{2}-\d{2}$/.test(sp.day) &&
    sp.day <= today &&
    sp.day >= addDays(today, -366)
      ? sp.day
      : today;

  return (
    <div className="sky min-h-screen">
      <AppHeader
        name={profile.full_name ?? "You"}
        avatar={profile.avatar}
        email={user.email ?? ""}
        alerts={alertSetupFrom(profile)}
        isAdmin={profile.role === "admin"}
      />
      <JournalBoard
        today={today}
        initialDay={asked}
        soundOn={profile.sound_on}
        initialEntries={entries.data ?? []}
        initialMoods={days.data ?? []}
      />
    </div>
  );
}
