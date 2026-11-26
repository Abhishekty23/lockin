"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Download, Moon, Droplets, Footprints, Timer, CheckCircle2, NotebookPen, Lock } from "lucide-react";
import { formatMinutes } from "@/lib/day";
import { colorVar } from "@/lib/habits";
import { dateLabel, hourLabel, MOOD_EMOJI, MOOD_NAMES, RANGES, type Range, type Summary } from "@/lib/insights";
import { BarChart, HBars, YearHeatmap, type BarPoint } from "./Charts";

type Props = {
  summary: Summary;
  basePath?: string; // where the range links point ("/demo" in the demo)
  demo?: boolean;
  year: { weeks: { day: string; score: number | null; future: boolean }[][]; daysLogged: number };
};

const fmtH = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}h` : `${m}m`);

export default function InsightsBoard({ summary: s, year, basePath = "/insights", demo = false }: Props) {
  const range = s.range as Range;
  // Tick labels: every day for a week, about weekly for a month, about every two weeks for 90 days
  const every = range === 7 ? 1 : range === 30 ? 7 : 14;
  const tick = (i: number, d: string) => ((s.days.length - 1 - i) % every === 0 ? (range === 7 ? dateLabel(d, { weekday: "short" }) : dateLabel(d)) : undefined);
  const daily = (value: (d: Summary["days"][number]) => number, tip: (d: Summary["days"][number]) => string, highlight?: (d: Summary["days"][number]) => boolean): BarPoint[] =>
    s.days.map((d, i) => ({ key: d.day, value: value(d), tick: tick(i, d.day), tip: `${dateLabel(d.day, { weekday: "short", day: "numeric", month: "short" })}: ${tip(d)}`, highlight: highlight?.(d), empty: !d.logged }));

  const moodTop = (s.mood.usual ?? 3) - 1;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Insights</h1>
          <p className="mt-1.5 text-sm text-muted">
            {dateLabel(s.start, { day: "numeric", month: "short" })} to {dateLabel(s.today, { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Time range" className="flex rounded-full bg-surface p-1 ring-1 ring-line">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`${basePath}?${demo ? "view=insights&" : ""}days=${r}`}
                scroll={false}
                aria-current={r === range ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${r === range ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
              >
                {r} days
              </Link>
            ))}
          </nav>
          <a
            href={demo ? "/signup" : `/insights/report?days=${range}`}
            className="flex h-11 items-center gap-2 rounded-full bg-violet px-5 text-sm font-semibold text-white shadow-lg shadow-violet/25 transition hover:brightness-110"
          >
            <Download size={16} /> {demo ? "Get your own report" : "PDF report"}
          </a>
        </div>
      </div>

      {!s.hasData ? (
        <section className="glass mt-6 rounded-[32px] p-8 text-center sm:p-12">
          <p className="text-5xl">📊</p>
          <h2 className="mt-4 font-display text-2xl font-bold">Your insights grow with every day you log</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">Log water, a focus session or your sleep today. After a few days, this page shows your patterns: when you focus best, how sleep changes your day, and which habits stick.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/today" className="rounded-full bg-ink px-6 py-3 font-semibold text-bg">
              Go to Today
            </Link>
            <Link href="/focus" className="rounded-full px-6 py-3 font-semibold ring-1 ring-line">
              Start a focus session
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Average day score" value={String(s.score.avg)} unit="/ 100" delta={s.score.prev ? s.score.delta : null} deltaText={(d) => `${Math.abs(d)} ${Math.abs(d) === 1 ? "pt" : "pts"}`} range={range} />
            <Tile label="Total focus" value={formatMinutes(s.focus.total)} unit={`${formatMinutes(s.focus.perDay)} a day`} delta={s.focus.prev ? s.focus.total - s.focus.prev : null} deltaText={(d) => formatMinutes(Math.abs(d))} range={range} />
            <Tile label="Days fully locked in" value={String(s.score.locked)} unit={`of ${range}`} icon={<Lock size={15} className="text-violet" />} />
            <Tile
              label="Usual mood"
              value={s.mood.logged ? MOOD_EMOJI[moodTop] : "–"}
              unit={s.mood.logged ? `${MOOD_NAMES[moodTop]}, ${s.mood.logged} days logged` : "No moods logged"}
            />
          </div>

          {/* Trend */}
          <Card
            className="mt-5"
            title="Day score"
            note={s.score.best ? `Best: ${s.score.best.score} on ${dateLabel(s.score.best.day, { weekday: "long", day: "numeric", month: "short" })}` : "Your score for each day"}
          >
            <BarChart
              label="Day score for each day"
              color="var(--violet)"
              max={100}
              height={200}
              points={daily(
                (d) => d.score,
                (d) => (d.logged ? `score ${d.score}${d.score >= 100 ? " 🔒" : ""}` : "nothing logged"),
                (d) => d.score >= 100,
              )}
            />
          </Card>

          {/* Findings */}
          <Card className="mt-5" title="What stands out" note="Patterns found in your own data">
            {s.findings.length ? (
              <ul className="grid gap-2.5 md:grid-cols-2">
                {s.findings.map((f, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl bg-surface p-3.5 text-[15px] leading-snug ring-1 ring-line">
                    <span className="text-xl leading-none">{f.emoji}</span>
                    <span>
                      {f.text}
                      {f.tone === "watch" && <span className="ml-1.5 inline-block rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">Worth a look</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Keep logging for a few more days. Findings appear once there&apos;s enough to compare.</p>
            )}
          </Card>

          {/* Focus */}
          <Card
            className="mt-5"
            title="Focus"
            icon={<Timer size={18} className="text-violet" />}
            note={`${s.focus.sessions} sessions · ${s.focus.completedRate}% finished · longest ${formatMinutes(s.focus.longest)} · goal met on ${s.focus.daysOnGoal} days`}
          >
            <div className="grid gap-8 lg:grid-cols-3 [&>*]:min-w-0">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-muted">What you focused on</h3>
                {s.focus.byLabel.length ? (
                  <HBars color="var(--violet)" rows={s.focus.byLabel.map((l) => ({ key: l.label, label: l.label, value: l.minutes, text: formatMinutes(l.minutes) }))} />
                ) : (
                  <p className="text-sm text-muted">No timer sessions yet. Time added by hand counts in totals but has no label.</p>
                )}
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-muted">Time of day</h3>
                <BarChart
                  label="Focus minutes by hour of day"
                  color="var(--violet)"
                  height={140}
                  format={fmtH}
                  points={s.focus.byHour.map((m, h) => ({ key: String(h), value: m, tick: h % 6 === 0 ? hourLabel(h) : undefined, tip: `${hourLabel(h)}: ${formatMinutes(m)}` }))}
                />
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-muted">Average by weekday</h3>
                <BarChart
                  label="Average focus minutes by weekday"
                  color="var(--violet)"
                  height={140}
                  format={fmtH}
                  target={{ value: s.focus.goal, label: "Goal" }}
                  points={s.focus.byWeekday.map((w) => ({ key: w.name, value: w.minutes, tick: w.name.slice(0, 3), tip: `${w.name}s: ${formatMinutes(w.minutes)} on average` }))}
                />
              </div>
            </div>
          </Card>

          {/* Body */}
          <div className="mt-5 grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
            <Card title="Sleep" icon={<Moon size={18} className="text-cyan" />} note={s.sleep.nights ? `${formatMinutes(s.sleep.avg)} a night on average · on target ${s.sleep.onTarget} of ${s.sleep.nights} nights` : "No nights logged yet"}>
              <BarChart
                label="Sleep each night"
                color="var(--cyan)"
                height={130}
                format={fmtH}
                target={{ value: s.sleep.target, label: formatMinutes(s.sleep.target) }}
                points={daily(
                  (d) => d.sleep_minutes ?? 0,
                  (d) => (d.sleep_minutes == null ? "not logged" : formatMinutes(d.sleep_minutes)),
                )}
              />
            </Card>
            <Card title="Water" icon={<Droplets size={18} className="text-water" />} note={`${s.water.avg} glasses a day · goal met on ${s.water.daysOnGoal} days`}>
              <BarChart
                label="Glasses of water each day"
                color="var(--water)"
                height={130}
                target={{ value: s.water.goal, label: `${s.water.goal}` }}
                points={daily(
                  (d) => d.water,
                  (d) => `${d.water} ${d.water === 1 ? "glass" : "glasses"}`,
                )}
              />
            </Card>
            <Card title="Move" icon={<Footprints size={18} className="text-amber" />} note={`${formatMinutes(s.move.avg)} and ${s.move.steps.toLocaleString("en-IN")} steps a day · goal met on ${s.move.daysOnGoal} days`}>
              <BarChart
                label="Minutes moved each day"
                color="var(--amber)"
                height={130}
                format={fmtH}
                target={{ value: s.move.goal, label: formatMinutes(s.move.goal) }}
                points={daily(
                  (d) => d.move_minutes,
                  (d) => `${formatMinutes(d.move_minutes)}${d.steps ? `, ${d.steps.toLocaleString("en-IN")} steps` : ""}`,
                )}
              />
            </Card>
          </div>

          {/* Mood + habits */}
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            <Card title="Mood" note={s.mood.logged ? `${s.mood.logged} of ${range} days logged` : "Pick a mood on the Today page to see this"}>
              {s.mood.logged > 0 && (
                <>
                  <HBars
                    color="var(--rose)"
                    rows={[4, 3, 2, 1, 0].map((i) => ({
                      key: String(i),
                      label: (
                        <>
                          <span className="mr-2 text-lg">{MOOD_EMOJI[i]}</span>
                          {MOOD_NAMES[i]}
                        </>
                      ),
                      value: s.mood.counts[i],
                      text: `${s.mood.counts[i]} ${s.mood.counts[i] === 1 ? "day" : "days"}`,
                    }))}
                  />
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[320px] text-sm">
                      <caption className="mb-2 text-left text-xs font-semibold text-muted">On days you felt…</caption>
                      <thead>
                        <tr className="text-left text-xs text-muted">
                          <th className="py-1.5 font-semibold">Mood</th>
                          <th className="py-1.5 text-right font-semibold">Focus</th>
                          <th className="py-1.5 text-right font-semibold">Sleep before</th>
                          <th className="py-1.5 text-right font-semibold">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...s.mood.byMood].reverse().filter((m) => m.days > 0).map((m) => (
                          <tr key={m.mood} className="border-t border-line">
                            <td className="py-2">
                              {MOOD_EMOJI[m.mood - 1]} {MOOD_NAMES[m.mood - 1]}
                            </td>
                            <td className="py-2 text-right tabular-nums">{formatMinutes(m.focus)}</td>
                            <td className="py-2 text-right tabular-nums">{m.sleep == null ? "–" : formatMinutes(m.sleep)}</td>
                            <td className="py-2 text-right tabular-nums">{m.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
            <Card title="Habits" note={s.habits.length ? "How often you did each habit on the days it was planned" : "Add habits to see how consistent you are"}>
              {s.habits.length > 0 ? (
                <HBars
                  color="var(--mint)"
                  max={100}
                  rows={s.habits.map((h) => ({
                    key: h.id,
                    label: (
                      <>
                        <span className="mr-2">{h.emoji}</span>
                        {h.name}
                      </>
                    ),
                    value: h.pct,
                    text: `${h.pct}% · ${h.done}/${h.due}`,
                    color: colorVar(h.color),
                  }))}
                />
              ) : (
                <Link href="/habits" className="inline-block rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line hover:bg-surface">
                  Add a habit
                </Link>
              )}
            </Card>
          </div>

          {/* Small totals */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Mini icon={<CheckCircle2 size={17} className="text-mint" />} value={String(s.tasks.done)} label="tasks finished" sub={s.tasks.done ? `${s.tasks.onTime} on time` : undefined} />
            <Mini icon={<CheckCircle2 size={17} className="text-amber" />} value={String(s.tasks.overdue)} label="tasks overdue now" />
            <Mini icon={<NotebookPen size={17} className="text-rose" />} value={String(s.journal.entries)} label="journal entries" sub={`${s.journal.words.toLocaleString("en-IN")} words`} />
            <Mini icon={<Timer size={17} className="text-violet" />} value={String(s.score.activeDays)} label="days with anything logged" sub={`of ${range}`} />
          </div>
        </>
      )}

      {/* Year */}
      <Card className="mt-5" title="Your year" note={`${year.daysLogged} days logged in the last 12 months. Darker means a higher score.`}>
        <YearHeatmap weeks={year.weeks} today={s.today} />
      </Card>
    </main>
  );
}

function Card({ title, note, icon, className = "", children }: { title: string; note?: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`glass min-w-0 rounded-[28px] p-5 sm:p-6 ${className}`}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        {icon}
        {title}
      </h2>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Tile({
  label,
  value,
  unit,
  delta,
  deltaText,
  range,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  delta?: number | null;
  deltaText?: (d: number) => string;
  range?: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-[24px] p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-2 whitespace-nowrap font-display text-2xl font-bold tabular-nums sm:text-3xl lg:text-4xl">{value}</p>
      <p className="mt-1 text-xs text-muted">{unit}</p>
      {delta != null && deltaText && delta !== 0 && (
        <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${delta > 0 ? "bg-mint/15 text-mint" : "bg-amber/15 text-amber"}`}>
          {delta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {deltaText(delta)} vs previous {range} days
        </p>
      )}
    </div>
  );
}

function Mini({ icon, value, label, sub }: { icon: React.ReactNode; value: string; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] p-4 ring-1 ring-line">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface">{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted">
          {label}
          {sub ? ` · ${sub}` : ""}
        </p>
      </div>
    </div>
  );
}
