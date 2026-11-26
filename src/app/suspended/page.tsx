import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import Logo from "@/components/ui/Logo";

export const metadata = { title: "Account paused | LockIn" };

// Shown instead of the app when an admin has paused the account.
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("suspended_at, suspended_reason").eq("id", data.claims.sub).single();
  if (!profile?.suspended_at) redirect("/today");

  return (
    <main className="sky grid min-h-screen place-items-center px-4 text-center">
      <div className="max-w-md">
        <Link href="/" aria-label="LockIn home" className="inline-block">
          <Logo />
        </Link>
        <p className="mt-12 text-6xl">⏸️</p>
        <h1 className="mt-6 font-display text-3xl font-bold">Your account is paused</h1>
        <p className="mt-3 text-muted">An admin has paused this account, so you can&apos;t use LockIn right now. Your data is kept safe and comes back if the account is restored.</p>
        {profile.suspended_reason && (
          <p className="mt-5 rounded-2xl bg-surface px-4 py-3 text-sm ring-1 ring-line">
            <span className="font-semibold">Reason:</span> {profile.suspended_reason}
          </p>
        )}
        <form action={signOut} className="mt-8">
          <button className="rounded-full bg-ink px-7 py-3.5 font-semibold text-bg">Log out</button>
        </form>
      </div>
    </main>
  );
}
