import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Settings2 } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

export const metadata = { title: "Today | LockIn" };

function greeting(timezone: string) {
  let hour = 9;
  try {
    hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date()));
  } catch {}
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const TRACK_NAMES: Record<string, string> = {
  skills: "Learning skills",
  exam: "Exam prep",
  career: "Career & work",
  fitness: "Health & fitness",
  reading: "Reading",
  custom: "Something else",
};

// Day 3 turns this into the full Today dashboard.
export default async function Page() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/today");
  if (!profile?.onboarded) redirect("/onboarding");

  const first = (profile.full_name ?? "there").split(" ")[0];
  const tracks = profile.tracks.map((t) => (t === "exam" && profile.exam_name ? profile.exam_name : t === "custom" && profile.custom_track ? profile.custom_track : TRACK_NAMES[t] ?? t));

  return (
    <div className="sky min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signOut}>
            <button className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted ring-1 ring-line transition hover:text-ink">
              <LogOut size={16} /> Log out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16 pt-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-surface-strong text-4xl ring-1 ring-line">{profile.avatar}</span>
          <div>
            <p className="text-muted">{greeting(profile.timezone)},</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{first}</h1>
          </div>
        </div>

        <section className="glass mt-8 rounded-[32px] p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">Your daily plan</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Item emoji="🎯" label="Working on" value={tracks.join(", ")} />
            <Item emoji="⏱️" label="Focus goal" value={`${Math.floor(profile.focus_goal_minutes / 60)}h${profile.focus_goal_minutes % 60 ? ` ${profile.focus_goal_minutes % 60}m` : ""}`} />
            <Item emoji="💧" label="Water goal" value={`${profile.water_goal} glasses`} />
            <Item emoji="🌙" label="Your day" value={`${profile.wake_time.slice(0, 5)} to ${profile.sleep_time.slice(0, 5)}`} />
          </ul>
        </section>

        <section className="mt-4 rounded-[32px] border border-dashed border-line p-8 text-center">
          <p className="text-4xl">🔒</p>
          <h2 className="mt-3 font-display text-xl font-bold">Your Today dashboard is being built</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Next update: the live day ring, your score, a water tracker and quick logging. Your account and settings are saved.
          </p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-bg">
            <Settings2 size={16} /> Back to home
          </Link>
        </section>
      </main>
    </div>
  );
}

function Item({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <li className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <span className="text-2xl">{emoji}</span>
      <span className="mt-2 block text-sm text-muted">{label}</span>
      <span className="block font-semibold">{value}</span>
    </li>
  );
}
