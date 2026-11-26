"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Copy,
  Crown,
  Info,
  Loader2,
  Lock,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { safe } from "@/lib/net";
import { addDays } from "@/lib/day";
import { sounds } from "@/lib/sounds";
import {
  activityStreaks,
  badgesFor,
  CHEER_EMOJI,
  flameFor,
  levelOf,
  TIER_STYLE,
  XP_RULES,
  type BadgeInput,
  type BoardRow,
  type Cheer,
  type Progress,
} from "@/lib/progress";
import type { Social } from "@/lib/social-server";
import Tilt from "@/components/ui/Tilt";
import {
  acceptFriend,
  addFriend,
  markCheersSeen,
  removeFriend,
  sendCheer,
} from "@/app/streaks/actions";

type Props = {
  today: string;
  username: string | null;
  soundOn: boolean;
  progress: Progress;
  badgeInput: BadgeInput;
  initialSocial: Social;
  cheers: Cheer[];
  demo?: boolean; // the public demo shows progress only
};
type Tab = "progress" | "friends";

const fmtShort = (d: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${d}T12:00:00Z`));
function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function StreaksBoard({
  today,
  username,
  soundOn,
  progress,
  badgeInput,
  initialSocial,
  cheers,
  demo = false,
}: Props) {
  const [tab, setTab] = useState<Tab>("progress");
  const [social, setSocial] = useState(initialSocial);
  const [toast, setToast] = useState<{
    text: string;
    tone: "good" | "error";
  } | null>(null);
  const flash = (text: string, tone: "good" | "error" = "good") =>
    setToast({ text, tone });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // Tabs follow the address (#friends) so they can be shared and bookmarked
  useEffect(() => {
    if (demo) return;
    const read = () =>
      setTab(location.hash === "#friends" ? "friends" : "progress");
    const t = setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", read);
    };
  }, [demo]);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(
      null,
      "",
      t === "friends" ? "#friends" : location.pathname,
    );
  };

  const unseen = cheers.filter((c) => !c.seen_at).length;
  const incoming = social.connections.filter(
    (c) => c.status === "pending" && c.direction === "in",
  ).length;
  useEffect(() => {
    if (tab === "friends" && unseen) void markCheersSeen();
  }, [tab, unseen]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Streaks
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Your streak, level and badges, and how your friends are doing.
          </p>
        </div>
        {!demo && (
          <nav
            aria-label="Sections"
            className="flex rounded-full bg-surface p-1 ring-1 ring-line"
          >
            {(
              [
                ["progress", "My progress", 0],
                ["friends", "Friends", unseen + incoming],
              ] as const
            ).map(([id, label, dot]) => (
              <button
                key={id}
                onClick={() => go(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`relative rounded-full px-4 py-2 text-sm font-semibold transition ${tab === id ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
              >
                {label}
                {dot > 0 && (
                  <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[11px] text-white">
                    {dot}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}
      </div>

      {tab === "progress" || demo ? (
        <ProgressTab today={today} progress={progress} input={badgeInput} />
      ) : (
        <FriendsTab
          today={today}
          username={username}
          soundOn={soundOn}
          social={social}
          setSocial={setSocial}
          cheers={cheers}
          flash={flash}
        />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className={`fixed bottom-24 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-2xl bg-surface-strong px-5 py-3 text-sm font-semibold shadow-2xl ring-1 lg:bottom-6 ${toast.tone === "error" ? "text-rose ring-rose/30" : "ring-mint/40"}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* =============================== My progress =============================== */
function ProgressTab({
  today,
  progress,
  input,
}: {
  today: string;
  progress: Progress;
  input: BadgeInput;
}) {
  const lvl = levelOf(progress.total_xp);
  const flame = flameFor(progress.current_streak);
  const todayLog = input.logs.find((l) => l.day === today);
  const todayKept = (todayLog?.score ?? 0) >= 50;
  const badges = useMemo(() => badgesFor(input), [input]);
  const earned = badges.filter((b) => b.earned).length;
  const streaks = useMemo(() => activityStreaks(input), [input]);
  const [showRules, setShowRules] = useState(false);

  // Five weeks, Monday first, ending this week
  const scores = new Map(input.logs.map((l) => [l.day, l.score]));
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const first = addDays(today, -wd - 28);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(first, i));

  return (
    <div className="mt-6 space-y-5">
      {/* Streak and level */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <section className="glass relative overflow-hidden rounded-[32px] p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-amber/20 blur-3xl"
            aria-hidden
          />
          <div className="relative flex items-center gap-5 sm:gap-7">
            <span
              className={`select-none text-7xl leading-none sm:text-8xl ${progress.current_streak ? "animate-flicker" : "opacity-70 grayscale"}`}
              aria-hidden
            >
              {flame.emoji.length > 2 ? flame.emoji.slice(0, 2) : flame.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-display text-5xl font-bold tabular-nums sm:text-6xl">
                {progress.current_streak}
                <span className="ml-2 text-2xl text-muted sm:text-3xl">
                  {progress.current_streak === 1 ? "day" : "days"}
                </span>
              </p>
              <p className="mt-1 font-semibold text-amber">
                {progress.current_streak
                  ? `${flame.label} streak`
                  : "No streak yet"}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Best ever: {progress.best_streak}{" "}
                {progress.best_streak === 1 ? "day" : "days"}
              </p>
            </div>
          </div>
          <div
            className={`relative mt-6 rounded-2xl p-4 text-sm ring-1 ${todayKept ? "bg-mint/10 ring-mint/30" : "bg-surface ring-line"}`}
          >
            {todayKept ? (
              <p>
                <span className="font-semibold text-mint">Today counts ✓</span>{" "}
                Your score is {todayLog?.score}. Come back tomorrow to keep the
                flame going.
              </p>
            ) : (
              <p>
                <span className="font-semibold">Reach a score of 50 today</span>{" "}
                to{" "}
                {progress.current_streak
                  ? "keep your streak"
                  : "start a streak"}
                . You&apos;re at {todayLog?.score ?? 0}.{" "}
                <Link
                  href="/today"
                  className="font-semibold text-violet hover:underline"
                >
                  Go to Today
                </Link>
              </p>
            )}
          </div>
        </section>

        <section className="glass rounded-[32px] p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-violet/15 text-4xl">
              {lvl.rankEmoji}
            </span>
            <div>
              <p className="font-display text-3xl font-bold">
                Level {lvl.level}
              </p>
              <p className="text-sm font-semibold text-violet">{lvl.rank}</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold tabular-nums">
                {progress.total_xp.toLocaleString("en-IN")} XP
              </span>
              <span className="text-muted tabular-nums">
                {(lvl.to - progress.total_xp).toLocaleString("en-IN")} XP to
                level {lvl.level + 1}
              </span>
            </div>
            <div
              className="mt-2 h-3 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={Math.round(lvl.pct * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress to next level"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet to-cyan"
                initial={{ width: 0 }}
                animate={{ width: `${lvl.pct * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
              <dt className="text-muted">Today</dt>
              <dd className="font-display text-xl font-bold tabular-nums">
                +{progress.today_xp} XP
              </dd>
            </div>
            <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
              <dt className="text-muted">This week</dt>
              <dd className="font-display text-xl font-bold tabular-nums">
                {progress.week_xp.toLocaleString("en-IN")} XP
              </dd>
            </div>
          </dl>
          <button
            onClick={() => setShowRules((x) => !x)}
            aria-expanded={showRules}
            className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
          >
            <Info size={15} /> How you earn XP
          </button>
          <AnimatePresence>
            {showRules && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden text-sm"
              >
                {XP_RULES.map((r) => (
                  <li key={r.text} className="mt-1.5 flex gap-2">
                    <span>{r.emoji}</span>
                    {r.text}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Five-week calendar + activity streaks */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] [&>*]:min-w-0">
        <section
          className="glass rounded-[28px] p-5 sm:p-6"
          aria-label="Last five weeks"
        >
          <h2 className="font-display text-lg font-bold">Last five weeks</h2>
          <p className="text-sm text-muted">
            🔥 marks a day with a score of 50 or more.
          </p>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span
                key={i}
                className="text-[11px] font-semibold text-muted"
                aria-hidden
              >
                {d}
              </span>
            ))}
            {cells.map((d) => {
              const s = scores.get(d);
              const future = d > today;
              const kept = (s ?? 0) >= 50;
              return (
                <span
                  key={d}
                  title={
                    future
                      ? undefined
                      : `${fmtShort(d)}: ${s == null ? "nothing logged" : `score ${s}`}`
                  }
                  className={`grid aspect-square place-items-center rounded-xl text-sm ${kept ? "bg-amber/20" : future ? "" : "bg-surface"} ${d === today ? "ring-2 ring-violet" : ""}`}
                >
                  {future ? (
                    ""
                  ) : kept ? (
                    <span className="text-lg">🔥</span>
                  ) : (
                    <span className="text-[11px] text-muted">
                      {Number(d.slice(8))}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </section>

        <section
          className="glass rounded-[28px] p-5 sm:p-6"
          aria-label="Streaks by activity"
        >
          <h2 className="font-display text-lg font-bold">
            Streaks by activity
          </h2>
          <p className="text-sm text-muted">Days in a row you did each one.</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {streaks.map((s) => (
              <li
                key={s.key}
                className="rounded-2xl bg-surface p-4 ring-1 ring-line"
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-lg">{s.emoji}</span>
                  {s.name}
                </p>
                <p
                  className="mt-2 font-display text-3xl font-bold tabular-nums"
                  style={{ color: s.current ? s.color : undefined }}
                >
                  {s.current}
                  <span className="ml-1 text-sm font-semibold text-muted">
                    {s.current === 1 ? "day" : "days"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {s.rule} · best {s.best}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Badges */}
      <section className="glass rounded-[28px] p-5 sm:p-6" aria-label="Badges">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">Badges</h2>
            <p className="text-sm text-muted">
              {earned} of {badges.length} earned
            </p>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-amber"
              style={{ width: `${(earned / badges.length) * 100}%` }}
            />
          </div>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {badges.map((b) => {
            const tier = TIER_STYLE[b.tier];
            return (
              <li key={b.key} className="flex">
                <Tilt
                  max={b.earned ? 12 : 4}
                  className={`flex w-full flex-col rounded-2xl p-4 ring-1 ${b.earned ? "bg-surface-strong" : "bg-surface ring-line"}`}
                  style={
                    b.earned
                      ? {
                          boxShadow: `inset 0 0 0 1.5px ${tier.color}, 0 10px 30px -12px ${tier.color}`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`text-4xl leading-none ${b.earned ? "" : "opacity-35 grayscale"}`}
                    aria-hidden
                  >
                    {b.emoji}
                  </span>
                  {!b.earned && (
                    <Lock
                      size={13}
                      className="absolute right-3 top-3 text-muted"
                      aria-label="Not earned yet"
                    />
                  )}
                  <p className="mt-3 font-semibold leading-tight">{b.name}</p>
                  <p className="mt-1 flex-1 text-xs text-muted">{b.desc}</p>
                  <p
                    className="mt-2 text-[11px] font-semibold"
                    style={{ color: tier.color }}
                  >
                    {tier.label}
                  </p>
                  {!b.earned && (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(b.value / b.target) * 100}%`,
                            background: tier.color,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] tabular-nums text-muted">
                        {b.value.toLocaleString("en-IN")} /{" "}
                        {b.target.toLocaleString("en-IN")}
                      </p>
                    </div>
                  )}
                </Tilt>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* =============================== Friends =============================== */
type Sort = "week" | "streak" | "total";

function FriendsTab({
  today,
  username,
  soundOn,
  social,
  setSocial,
  cheers,
  flash,
}: {
  today: string;
  username: string | null;
  soundOn: boolean;
  social: Social;
  setSocial: (s: Social) => void;
  cheers: Cheer[];
  flash: (t: string, tone?: "good" | "error") => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("week");
  const [cheered, setCheered] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const incoming = social.connections.filter(
    (c) => c.status === "pending" && c.direction === "in",
  );
  const outgoing = social.connections.filter(
    (c) => c.status === "pending" && c.direction === "out",
  );
  const friends = social.board.filter((r) => !r.is_me);
  const rows = [...social.board].sort((a, b) =>
    sort === "streak"
      ? b.current_streak - a.current_streak || b.week_xp - a.week_xp
      : sort === "total"
        ? b.total_xp - a.total_xp
        : b.week_xp - a.week_xp || b.current_streak - a.current_streak,
  );
  const nameOf = (id: string) => {
    const r = social.board.find((x) => x.id === id);
    return r ? r.full_name || `@${r.username}` : "A friend";
  };

  async function run<T extends { ok: true } | { ok: false; error: string }>(
    key: string,
    call: Promise<T>,
    after?: (r: Extract<T, { ok: true }>) => void,
  ) {
    setBusy(key);
    const res = await safe(call);
    setBusy(null);
    if (!res.ok) return flash(res.error, "error");
    after?.(res as Extract<T, { ok: true }>);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await run("add", addFriend(name), (r) => {
      if ("board" in r)
        setSocial({ board: r.board, connections: r.connections });
      flash(r.message ?? "Request sent.");
      setName("");
    });
  }

  async function cheer(row: BoardRow, emoji: string) {
    await run(`cheer-${row.id}`, sendCheer(row.id, emoji), () => {
      setCheered((s) => new Set(s).add(row.id));
      if (soundOn) sounds.badge();
      flash(`${emoji} Cheer sent to ${row.full_name || `@${row.username}`}`);
    });
  }

  return (
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&>*]:min-w-0">
      {/* Leaderboard */}
      <section
        className="glass rounded-[28px] p-5 sm:p-6"
        aria-label="Leaderboard"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Leaderboard</h2>
            <p className="text-sm text-muted">
              Friends see only this: your streak, XP, level and today&apos;s
              score.
            </p>
          </div>
          <div className="flex rounded-full bg-surface p-1 text-xs ring-1 ring-line">
            {(
              [
                ["week", "This week"],
                ["streak", "Streak"],
                ["total", "All time"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                aria-pressed={sort === k}
                className={`rounded-full px-3 py-1.5 font-semibold ${sort === k ? "bg-ink text-bg" : "text-muted"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <ol className="mt-5 space-y-2">
          {rows.map((r, i) => {
            const lvl = levelOf(r.total_xp);
            const value =
              sort === "streak"
                ? `${r.current_streak} 🔥`
                : sort === "total"
                  ? `${r.total_xp.toLocaleString("en-IN")} XP`
                  : `${r.week_xp.toLocaleString("en-IN")} XP`;
            return (
              <li
                key={r.id}
                className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${r.is_me ? "bg-violet/10 ring-violet/30" : "bg-surface ring-line"}`}
              >
                <span className="w-6 text-center font-display font-bold tabular-nums text-muted">
                  {i === 0 && rows.length > 1 ? (
                    <Crown
                      size={18}
                      className="mx-auto text-amber"
                      aria-label="First"
                    />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-strong text-2xl ring-1 ring-line">
                  {r.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {r.is_me ? "You" : r.full_name || `@${r.username}`}
                    <span className="ml-2 text-xs font-semibold text-violet">
                      {lvl.rankEmoji} Lv {lvl.level}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    🔥 {r.current_streak} day streak · today {r.today_score}
                    {r.username && !r.is_me ? ` · @${r.username}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-display font-bold tabular-nums">
                  {value}
                </span>
                {!r.is_me && (
                  <CheerMenu
                    disabled={cheered.has(r.id) || busy === `cheer-${r.id}`}
                    done={cheered.has(r.id)}
                    onCheer={(e) => cheer(r, e)}
                    onRemove={() =>
                      run(
                        `rm-${r.id}`,
                        removeFriend(r.id),
                        (x) =>
                          "board" in x &&
                          setSocial({
                            board: x.board,
                            connections: x.connections,
                          }),
                      )
                    }
                  />
                )}
              </li>
            );
          })}
        </ol>
        {friends.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">
            <p className="text-3xl">🤝</p>
            <p className="mt-2 font-semibold text-ink">
              Streaks are easier with friends
            </p>
            <p className="mt-1">
              Add a friend by their username. You&apos;ll see each other&apos;s
              streak and XP, and can send cheers.
            </p>
          </div>
        )}
      </section>

      <div className="space-y-5">
        {/* Add a friend */}
        <section
          className="glass rounded-[28px] p-5 sm:p-6"
          aria-label="Add a friend"
        >
          <h2 className="font-display text-lg font-bold">Add a friend</h2>
          <form onSubmit={add} className="mt-3 flex gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                @
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s/g, ""))}
                maxLength={21}
                placeholder="username"
                aria-label="Friend's username"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-12 w-full rounded-2xl border border-line bg-surface pl-9 pr-4 text-base outline-none focus:border-violet"
              />
            </label>
            <button
              disabled={busy === "add" || !name.trim()}
              className="flex h-12 items-center gap-2 rounded-2xl bg-violet px-4 font-semibold text-white disabled:opacity-50"
            >
              {busy === "add" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <UserPlus size={16} />
              )}
              <span className="hidden sm:inline">Add</span>
            </button>
          </form>
          {username ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-surface px-4 py-3 text-sm ring-1 ring-line">
              <span className="min-w-0 truncate">
                Your username:{" "}
                <span className="font-semibold">@{username}</span>
              </span>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(username);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex shrink-0 items-center gap-1 font-semibold text-violet"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Set a username in{" "}
              <Link
                href="/settings"
                className="font-semibold text-violet hover:underline"
              >
                Settings
              </Link>{" "}
              so friends can find you.
            </p>
          )}
        </section>

        {/* Requests */}
        {(incoming.length > 0 || outgoing.length > 0) && (
          <section
            className="glass rounded-[28px] p-5 sm:p-6"
            aria-label="Friend requests"
          >
            <h2 className="font-display text-lg font-bold">Requests</h2>
            <ul className="mt-3 space-y-2">
              {incoming.map((c) => (
                <li
                  key={c.other}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line"
                >
                  <span className="text-2xl">{c.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {c.full_name || `@${c.username}`}
                    </p>
                    <p className="truncate text-xs text-muted">
                      @{c.username} wants to be friends
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      run(`acc-${c.other}`, acceptFriend(c.other), (x) => {
                        if ("board" in x)
                          setSocial({
                            board: x.board,
                            connections: x.connections,
                          });
                        if (soundOn) sounds.badge();
                        flash(x.message ?? "You're friends now 🎉");
                      })
                    }
                    disabled={busy === `acc-${c.other}`}
                    className="rounded-xl bg-mint px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() =>
                      run(
                        `rm-${c.other}`,
                        removeFriend(c.other),
                        (x) =>
                          "board" in x &&
                          setSocial({
                            board: x.board,
                            connections: x.connections,
                          }),
                      )
                    }
                    aria-label={`Decline request from @${c.username}`}
                    className="grid h-9 w-9 place-items-center rounded-xl text-muted ring-1 ring-line hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
              {outgoing.map((c) => (
                <li
                  key={c.other}
                  className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-line"
                >
                  <span className="text-2xl">⏳</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      @{c.username}
                    </p>
                    <p className="text-xs text-muted">
                      Waiting for them to accept
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      run(
                        `rm-${c.other}`,
                        removeFriend(c.other),
                        (x) =>
                          "board" in x &&
                          setSocial({
                            board: x.board,
                            connections: x.connections,
                          }),
                      )
                    }
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-muted ring-1 ring-line hover:text-ink"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cheers */}
        <section
          className="glass rounded-[28px] p-5 sm:p-6"
          aria-label="Cheers you got"
        >
          <h2 className="font-display text-lg font-bold">Cheers you got</h2>
          {cheers.length === 0 ? (
            <p className="mt-1 text-sm text-muted">
              When friends cheer you on, it shows up here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {cheers.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 rounded-2xl p-3 text-sm ring-1 ${c.seen_at ? "ring-line" : "bg-rose/10 ring-rose/30"}`}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{nameOf(c.from_user)}</span>{" "}
                    cheered you{" "}
                    {c.day === today ? "today" : `on ${fmtShort(c.day)}`}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {ago(c.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function CheerMenu({
  disabled,
  done,
  onCheer,
  onRemove,
}: {
  disabled: boolean;
  done: boolean;
  onCheer: (e: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled && !open}
        aria-expanded={open}
        aria-label={done ? "Cheered today" : "Send a cheer"}
        className="grid h-10 w-10 place-items-center rounded-xl text-lg ring-1 ring-line transition hover:bg-surface-strong disabled:opacity-50"
      >
        {done ? "✅" : "👏"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-12 z-20 w-56 rounded-2xl bg-surface-strong p-2 shadow-2xl ring-1 ring-line"
          >
            {!done && (
              <>
                <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-muted">
                  Send a cheer (one a day)
                </p>
                <div className="flex justify-between px-1">
                  {CHEER_EMOJI.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setOpen(false);
                        onCheer(e);
                      }}
                      className="grid h-10 w-10 place-items-center rounded-xl text-2xl transition hover:scale-110 hover:bg-surface"
                      aria-label={`Cheer with ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="my-2 h-px bg-line" />
              </>
            )}
            {confirm ? (
              <div className="flex items-center gap-2 px-2 py-1 text-sm">
                <span className="flex-1">Remove friend?</span>
                <button
                  onClick={() => {
                    setOpen(false);
                    onRemove();
                  }}
                  className="rounded-lg bg-rose px-2.5 py-1 font-semibold text-white"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm(true)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold text-rose hover:bg-rose/10"
              >
                <UserMinus size={15} /> Remove friend
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
