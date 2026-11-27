import Link from "next/link";
import { dayIn } from "@/lib/day";
import { asRange, summarize, yearGrid } from "@/lib/insights";
import { demoInsightData, demoProgress } from "@/lib/demo-data";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import InsightsBoard from "@/components/insights/InsightsBoard";
import StreaksBoard from "@/components/streaks/StreaksBoard";

export const metadata = {
  title: "Demo | LockIn",
  description: "Explore LockIn with sample data: insights, charts, streaks, levels and badges. No sign-up needed.",
};

// A public, read-only tour with sample data. Nothing here touches the database.
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; days?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === "streaks" ? "streaks" : "insights";
  const today = dayIn("Asia/Kolkata");
  const data = demoInsightData(today);
  const { progress, badgeInput } = demoProgress(data);

  return (
    <div className="sky min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 lg:bg-bg/80 lg:backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="LockIn home">
            <Logo />
          </Link>
          <span className="rounded-full bg-amber/15 px-2.5 py-1 text-xs font-semibold text-amber">Demo</span>
          <div className="flex-1" />
          <ThemeToggle />
          <Link href="/signup" className="cta-glow shrink-0 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 sm:px-5 text-sm font-semibold text-bg">
            Start free
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm">
          <span className="text-xl">👋</span>
          <p className="min-w-0 flex-1 basis-60">
            <span className="font-semibold">This is Aarav&apos;s sample LockIn.</span> <span className="text-muted">Made-up data, so you can see what months of tracking look like. Hover the charts.</span>
          </p>
          <nav aria-label="Demo pages" className="flex rounded-full bg-surface p-1 ring-1 ring-line">
            {(
              [
                ["insights", "Insights"],
                ["streaks", "Streaks & badges"],
              ] as const
            ).map(([id, label]) => (
              <Link
                key={id}
                href={`/demo?view=${id}`}
                scroll={false}
                aria-current={view === id ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 font-semibold transition ${view === id ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {view === "insights" ? (
        <InsightsBoard summary={summarize(data, asRange(sp.days))} year={yearGrid(data)} basePath="/demo" demo />
      ) : (
        <StreaksBoard today={today} username={null} soundOn={false} progress={progress} badgeInput={badgeInput} initialSocial={{ board: [], connections: [] }} cheers={[]} demo />
      )}

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="glass rounded-[2rem] p-8 text-center sm:p-12">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Your day could look like this</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">Set up in under a minute. Free, on your phone or laptop.</p>
          <Link href="/signup" className="cta-glow mt-7 inline-block rounded-full bg-ink px-8 py-4 font-semibold text-bg">
            Start free
          </Link>
        </div>
      </section>
    </div>
  );
}
