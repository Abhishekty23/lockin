import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import Onboarding from "@/components/onboarding/Onboarding";

export const metadata = { title: "Set up your day | LockIn" };

export default async function Page() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");
  if (profile?.onboarded) redirect("/today");
  return <Onboarding initialName={profile?.full_name ?? ""} email={user.email ?? ""} />;
}
