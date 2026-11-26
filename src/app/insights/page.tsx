import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { alertSetupFrom } from "@/lib/alerts";
import { asRange, summarize, yearGrid } from "@/lib/insights";
import { loadInsights } from "@/lib/insights-server";
import AppHeader from "@/components/today/AppHeader";
import InsightsBoard from "@/components/insights/InsightsBoard";

export const metadata = { title: "Insights | LockIn" };

export default async function Page({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/insights");
  if (!profile?.onboarded) redirect("/onboarding");

  const data = await loadInsights(supabase, user.id, profile);
  const summary = summarize(data, asRange(sp.days));

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} />
      <InsightsBoard summary={summary} year={yearGrid(data)} />
    </div>
  );
}
