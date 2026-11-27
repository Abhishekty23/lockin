"use client";

import { safe } from "@/lib/net";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { levelOf, type Progress } from "@/lib/progress";
import { CalendarCheck, Check, Footprints, ListChecks, Minus, Moon, NotebookPen, Pencil, Play, Plus, Salad, Timer } from "lucide-react";
import DayRing from "@/components/ui/DayRing";
import { sounds, type SoundName } from "@/lib/sounds";
import { formatMinutes, minutesBetween, scoreOf, segmentsFor, sleepTarget, type DayGoals, type DayLog, type MealKey, type MealRating, type Meals } from "@/lib/day";
import type { HabitWithHistory } from "@/lib/habits-server";
import HabitRow from "@/components/habits/HabitRow";
import { PRIORITIES, sortTasks, type Task } from "@/lib/plan";
import { toggleTask } from "@/app/plan/actions";
import { useHabits } from "@/components/habits/useHabits";
import { updateToday } from "@/app/today/actions";
import type { DayPatch } from "@/lib/day-server";
import Celebration from "./Celebration";
import MiniRing from "./MiniRing";

type Props = {
  firstName: string;
  avatar: string;
  greeting: string;
  dateLabel: string;
  goals: DayGoals;
  soundOn: boolean;
  initial: DayLog;
  week: { day: string; label: string; score: number; isToday: boolean }[];
  today: string;
  initialHabits: HabitWithHistory[];
  initialTasks: Task[];
  progress: Progress;
};

const MOODS = [
  { v: 1, emoji: "😫", label: "Rough" },
  { v: 2, emoji: "😕", label: "Low" },
  { v: 3, emoji: "😐", label: "Okay" },
  { v: 4, emoji: "🙂", label: "Good" },
  { v: 5, emoji: "🤩", label: "Great" },
];

export default function TodayDashboard({ firstName, avatar, greeting, dateLabel, goals, soundOn, initial, week, today, initialHabits, initialTasks, progress }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [log, setLog] = useState<DayLog>(initial);
  const [toast, setToast] = useState<{ text: string; tone: "error" | "good" } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const saved = useRef<DayLog>(initial);
  const seq = useRef(0);

  const habitsState = useHabits({
    initial: initialHabits,
    today,
    soundOn,
    onLog: (l) => {
      saved.current = l;
      setLog((cur) => ({ ...cur, score: l.score, locked_at: l.locked_at }));
    },
    onError: (text) => setToast({ text, tone: "error" }),
  });

  const segments = segmentsFor(log, goals, habitsState.progress);
  const score = scoreOf(segments);
  const locked = score >= 100;
  const prevScore = useRef(score);

  // Streak: days in a row at 50+. Today joins it the moment the score reaches 50.
  const streakBefore = initial.score >= 50 ? Math.max(0, progress.current_streak - 1) : progress.current_streak;
  const streak = score >= 50 ? streakBefore + 1 : streakBefore;
  const lvl = levelOf(progress.total_xp);

  // Celebrate the moment the ring fills, and the moment today counts for the streak
  useEffect(() => {
    if (score >= 50 && score < 100 && prevScore.current < 50) {
      if (soundOn) sounds.streak();
      setToast({ text: `🔥 Today counts! Your streak is ${streakBefore + 1} ${streakBefore + 1 === 1 ? "day" : "days"}.`, tone: "good" });
    }
    if (score >= 100 && prevScore.current < 100) {
      if (soundOn) sounds.lock();
      setCelebrate(true);
      setToast({ text: "Locked in! You filled your whole day. 🔒", tone: "good" });
      const t = setTimeout(() => setCelebrate(false), 1800);
      prevScore.current = score;
      return () => clearTimeout(t);
    }
    prevScore.current = score;
  }, [score, soundOn, streakBefore]);

  // A water alert logged a glass somewhere else on the page
  useEffect(() => {
    const onWater = (e: Event) => {
      const water = (e as CustomEvent<number>).detail;
      setLog((l) => ({ ...l, water }));
      saved.current = { ...saved.current, water };
    };
    window.addEventListener("lockin:water", onWater);
    return () => window.removeEventListener("lockin:water", onWater);
  }, []);

  // If a save is still on its way, ask before the tab closes or reloads so the tap isn't lost
  const saving = useRef(0);
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (saving.current > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const play = (s: SoundName) => soundOn && sounds[s]();

  // Update the screen instantly, then save. If saving fails, go back to the last saved state.
  async function save(patch: DayPatch) {
    setLog((l) => ({ ...l, ...patch }));
    const mine = ++seq.current;
    saving.current++;
    const res = await safe(updateToday(patch));
    saving.current--;
    if (!res.ok) {
      setLog(saved.current);
      setToast({ text: res.error, tone: "error" });
      return;
    }
    saved.current = res.log;
    if (mine === seq.current) setLog((l) => ({ ...l, score: res.log.score, locked_at: res.log.locked_at }));
  }

  const weakest = [...segments].sort((a, b) => a.value - b.value)[0];
  const nextStep: string =
    locked
      ? "Everything's filled. Enjoy the rest of your day."
      : {
          focus: `Do a focus session. ${formatMinutes(Math.max(0, goals.focus_goal_minutes - log.focus_minutes))} left on your goal.`,
          water: `Drink a glass of water. ${Math.max(0, goals.water_goal - log.water)} to go.`,
          sleep: "Log how you slept last night.",
          move: `Move for ${Math.max(5, goals.move_goal_minutes - log.move_minutes)} minutes: a walk counts.`,
          journal: "Write one line, or a full entry in your journal.",
          habits: `Tick off your habits. ${habitsState.progress.total - habitsState.progress.done} left today.`,
        }[weakest.key] ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      {/* ---------- Hero: ring + breakdown ---------- */}
      <section className="glass relative overflow-hidden rounded-[36px] p-6 sm:p-10">
        <div className="grid items-center gap-10 lg:grid-cols-[auto_1fr]">
          <div className="relative mx-auto">
            <div className="hidden sm:block">
              <DayRing segments={segments} score={score} locked={locked} size={320} />
            </div>
            <div className="sm:hidden">
              <DayRing segments={segments} score={score} locked={locked} size={270} />
            </div>
            {celebrate && <Celebration />}
          </div>

          <div>
            <p className="text-muted">
              {greeting}, {dateLabel}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {firstName} {avatar}
            </h1>
            <Link
              href="/streaks"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber/15 px-3.5 py-1.5 text-sm font-semibold ring-1 ring-amber/30 transition hover:bg-amber/25"
            >
              <span className={streak ? "" : "grayscale"}>🔥</span>
              {streak ? `${streak}-day streak` : "Start a streak today"}
              <span className="text-muted">·</span>
              <span className="text-violet">
                {lvl.rankEmoji} Level {lvl.level}
              </span>
            </Link>
            <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl bg-surface-strong px-4 py-2.5 text-sm ring-1 ring-line">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: locked ? "var(--mint)" : weakest.color }} />
              {nextStep}
            </p>

            <ul className="mt-7 space-y-3.5">
              {segments.map((s) => (
                <li key={s.key} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-4 sm:grid-cols-[7rem_1fr_9rem_3rem]">
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-line">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: s.color }}
                      initial={false}
                      animate={{ width: `${Math.round(s.value * 100)}%` }}
                      transition={{ type: "spring", stiffness: 80, damping: 18 }}
                    />
                  </span>
                  <span className="hidden text-right text-sm tabular-nums text-muted sm:block">{detail(s.key, log, goals, habitsState.progress)}</span>
                  <span className="text-right text-sm font-bold tabular-nums">{Math.round(s.value * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Week strip ---------- */}
      <section aria-label="This week" className="mt-4 flex gap-1 rounded-[28px] border border-line p-2 sm:gap-2 sm:p-3">
        {week.map((d) => (
          <div
            key={d.day}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-2xl py-2.5 ${d.isToday ? "bg-surface-strong ring-1 ring-violet/40" : ""}`}
          >
            <span className={`text-xs font-semibold ${d.isToday ? "text-ink" : "text-muted"}`}>{d.label}</span>
            <MiniRing score={d.isToday ? score : d.score} />
            <span className="text-xs tabular-nums text-muted">{d.isToday ? score : d.score || "–"}</span>
          </div>
        ))}
      </section>

      {/* ---------- Log cards ---------- */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WaterCard
          water={log.water}
          goal={goals.water_goal}
          onChange={(n) => {
            if (n > log.water) play("water");
            save({ water: n });
          }}
        />

        <StepperCard
          icon={<Timer size={20} />}
          color="var(--violet)"
          title="Focus"
          value={log.focus_minutes}
          goal={goals.focus_goal_minutes}
          steps={[15, 30, 60]}
          note="Add time by hand, or let the timer track it for you."
          action={
            <Link href="/focus" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-violet font-semibold text-white transition hover:brightness-110">
              <Play size={16} fill="currentColor" /> Start Lock In mode
            </Link>
          }
          onChange={(n) => {
            if (n > log.focus_minutes) play("done");
            save({ focus_minutes: n });
          }}
        />

        <StepperCard
          icon={<Footprints size={20} />}
          color="var(--amber)"
          title="Move"
          value={log.move_minutes}
          goal={goals.move_goal_minutes}
          steps={[10, 20, 30]}
          note="Walks, workouts, sport, stretching: any movement counts. Steps below count too."
          onChange={(n) => {
            if (n > log.move_minutes) play("stretch");
            save({ move_minutes: n });
          }}
        />

        <div className="glass rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint/15 text-mint">
                <ListChecks size={20} />
              </span>
              <h2 className="font-display text-lg font-bold">Habits</h2>
            </div>
            {habitsState.progress.total > 0 && (
              <span className="text-sm font-semibold tabular-nums text-muted">
                {habitsState.progress.done}/{habitsState.progress.total}
              </span>
            )}
          </div>
          {habitsState.habits.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-muted">Add a few small daily habits. Ticking them fills a new Habits part of your ring.</p>
              <Link href="/habits" className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-mint font-semibold text-bg">
                <Plus size={16} /> Add your first habit
              </Link>
            </div>
          ) : habitsState.dueToday.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No habits planned for today. Rest day. 🌿</p>
          ) : (
            <div className="mt-4 space-y-2">
              {habitsState.dueToday.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  done={habitsState.doneToday.includes(h)}
                  compact
                  onToggle={async () => (await habitsState.toggle(h.id)) && setToast({ text: "Every habit done today! 🎉", tone: "good" })}
                />
              ))}
            </div>
          )}
          {habitsState.habits.length > 0 && (
            <Link href="/habits" className="mt-3 inline-block text-sm font-semibold text-mint hover:underline">
              Manage habits and streaks
            </Link>
          )}
        </div>

        <SleepCard value={log.sleep_minutes} goals={goals} onSave={(n) => save({ sleep_minutes: n })} />

        <div className="glass rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet/15 text-violet">
                <CalendarCheck size={20} />
              </span>
              <h2 className="font-display text-lg font-bold">Today&apos;s tasks</h2>
            </div>
            {tasks.length > 0 && (
              <span className="text-sm font-semibold tabular-nums text-muted">
                {tasks.filter((t) => t.done_at).length}/{tasks.length}
              </span>
            )}
          </div>
          {tasks.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No tasks for today yet. Pick the 1 to 3 things that would make today a win.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {[...tasks].sort(sortTasks).slice(0, 6).map((t) => {
                const p = PRIORITIES.find((x) => x.v === t.priority)!;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-1.5">
                    <button
                      onClick={async () => {
                        const done = !t.done_at;
                        setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done_at: done ? new Date().toISOString() : null } : x)));
                        if (done) play("done");
                        const res = await safe(toggleTask(t.id, done));
                        if (!res.ok) {
                          setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));
                          setToast({ text: res.error, tone: "error" });
                        }
                      }}
                      aria-label={`${t.title}: ${t.done_at ? "done" : "not done"}`}
                      aria-pressed={Boolean(t.done_at)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2"
                      style={{ borderColor: p.color, background: t.done_at ? p.color : "transparent" }}
                    >
                      {t.done_at && <Check size={12} strokeWidth={3} className="text-white" />}
                    </button>
                    <span className={`min-w-0 flex-1 truncate text-sm font-medium ${t.done_at ? "text-muted line-through" : ""}`}>{t.title}</span>
                    {t.due && t.due < today && !t.done_at && <span className="text-xs font-semibold text-rose">Overdue</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/plan" className="mt-3 inline-block text-sm font-semibold text-violet hover:underline">
            {tasks.length ? "Open your plan" : "Plan your day"}
          </Link>
        </div>

        <HealthCard
          steps={log.steps}
          stepsGoal={goals.steps_goal}
          meals={log.meals ?? {}}
          onSteps={(n) => {
            if (n > log.steps) play("stretch");
            save({ steps: n });
          }}
          onMeals={(m) => save({ meals: m })}
        />

        <div className="glass rounded-[28px] p-6">
          <h2 className="font-display text-lg font-bold">How are you feeling?</h2>
          <p className="text-sm text-muted">Your moods show up in Insights later.</p>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {MOODS.map((m) => {
              const on = log.mood === m.v;
              return (
                <motion.button
                  key={m.v}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => save({ mood: on ? null : m.v })}
                  aria-pressed={on}
                  aria-label={m.label}
                  className={`flex flex-col items-center gap-1 rounded-2xl py-3 transition ${on ? "bg-violet/15 ring-2 ring-violet" : "bg-surface ring-1 ring-line hover:ring-violet/40"}`}
                >
                  <motion.span animate={{ scale: on ? 1.2 : 1 }} className="text-2xl">
                    {m.emoji}
                  </motion.span>
                  <span className="text-[11px] font-semibold text-muted">{m.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <JournalCard note={log.note} onSave={(note) => save({ note })} />
      </div>

      {/* ---------- Toast ---------- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={`fixed bottom-24 lg:bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl ring-1 ${
              toast.tone === "error" ? "bg-surface-strong text-rose ring-rose/30" : "bg-surface-strong text-ink ring-mint/40"
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function detail(key: string, log: DayLog, goals: DayGoals, habits?: { done: number; total: number }) {
  switch (key) {
    case "focus":
      return `${formatMinutes(log.focus_minutes)} / ${formatMinutes(goals.focus_goal_minutes)}`;
    case "water":
      return `${log.water} / ${goals.water_goal} glasses`;
    case "sleep":
      return log.sleep_minutes == null ? "Not logged" : `${formatMinutes(log.sleep_minutes)} / ${formatMinutes(sleepTarget(goals))}`;
    case "move":
      return log.steps / goals.steps_goal > log.move_minutes / goals.move_goal_minutes
        ? `${log.steps.toLocaleString("en-IN")} steps`
        : `${formatMinutes(log.move_minutes)} / ${formatMinutes(goals.move_goal_minutes)}`;
    case "habits":
      return `${habits?.done ?? 0} / ${habits?.total ?? 0} done`;
    default:
      return log.note?.trim() || log.journaled ? "Written" : "Not yet";
  }
}

/* ---------- Water ---------- */
function WaterCard({ water, goal, onChange }: { water: number; goal: number; onChange: (n: number) => void }) {
  const pct = Math.min(1, water / goal);
  return (
    <div className="glass flex flex-col rounded-[28px] p-6 md:row-span-2">
      <h2 className="font-display text-lg font-bold">Water</h2>
      <p className="text-sm text-muted">Tap the glass to log one.</p>
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <button
          onClick={() => onChange(Math.min(40, water + 1))}
          aria-label="Log a glass of water"
          className="relative h-52 w-36 overflow-hidden rounded-b-[2.4rem] rounded-t-lg border-[3px] border-water/40 bg-water/5 transition active:scale-95"
        >
          <motion.div
            className="absolute inset-x-0 bottom-0"
            style={{ background: "linear-gradient(var(--water), var(--cyan))" }}
            initial={false}
            animate={{ height: `${pct * 100}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 14 }}
          >
            <div className="absolute -top-2.5 left-0 h-5 w-[200%] animate-[marquee_3s_linear_infinite] rounded-[50%] bg-white/25" />
          </motion.div>
          <AnimatePresence>
            <motion.span
              key={water}
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 60, opacity: [0, 1, 0] }}
              transition={{ duration: 0.6 }}
              className="absolute left-1/2 top-0 h-3 w-2 -translate-x-1/2 rounded-full bg-water"
            />
          </AnimatePresence>
        </button>
        <p className="mt-6 font-display text-5xl font-extrabold tabular-nums">
          {water}
          <span className="text-2xl text-muted">/{goal}</span>
        </p>
        <p className="mt-1 text-sm text-muted">{water >= goal ? "Goal hit. Nice! 💧" : `${goal - water} more to go`}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(Math.max(0, water - 1))}
          disabled={water === 0}
          aria-label="Remove a glass"
          className="grid h-12 w-12 place-items-center rounded-2xl bg-surface ring-1 ring-line transition hover:text-ink disabled:opacity-40"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={() => onChange(Math.min(40, water + 1))}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-water font-semibold text-white transition hover:brightness-110"
        >
          <Plus size={18} /> Add a glass
        </button>
      </div>
    </div>
  );
}

/* ---------- Focus / Move ---------- */
function StepperCard({
  icon,
  color,
  title,
  value,
  goal,
  steps,
  note,
  action,
  onChange,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  value: number;
  goal: number;
  steps: number[];
  note: string;
  action?: React.ReactNode;
  onChange: (n: number) => void;
}) {
  const pct = Math.min(1, value / goal);
  return (
    <div className="glass rounded-[28px] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
            {icon}
          </span>
          <h2 className="font-display text-lg font-bold">{title}</h2>
        </div>
        <p className="font-display text-2xl font-bold tabular-nums">
          {formatMinutes(value)}
          <span className="text-base font-semibold text-muted"> / {formatMinutes(goal)}</span>
        </p>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={false}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
        />
      </div>
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - steps[0]))}
          disabled={value === 0}
          aria-label={`Remove ${steps[0]} minutes`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface ring-1 ring-line disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        {steps.map((s) => (
          <button
            key={s}
            onClick={() => onChange(Math.min(1440, value + s))}
            className="h-11 flex-1 rounded-xl bg-surface-strong text-sm font-semibold ring-1 ring-line transition hover:ring-2 hover:ring-[color:var(--c)]"
            style={{ ["--c" as string]: color }}
          >
            +{s}m
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{note}</p>
      {action}
    </div>
  );
}

/* ---------- Sleep ---------- */
function SleepCard({ value, goals, onSave }: { value: number | null; goals: DayGoals; onSave: (n: number | null) => void }) {
  const [editing, setEditing] = useState(value == null);
  const [bed, setBed] = useState(goals.sleep_time.slice(0, 5));
  const [wake, setWake] = useState(goals.wake_time.slice(0, 5));
  const target = sleepTarget(goals);
  const preview = minutesBetween(bed, wake);

  return (
    <div className="glass rounded-[28px] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan/15 text-cyan">
            <Moon size={20} />
          </span>
          <h2 className="font-display text-lg font-bold">Last night&apos;s sleep</h2>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} aria-label="Edit sleep" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-ink">
            <Pencil size={16} />
          </button>
        )}
      </div>

      {editing ? (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(preview);
            setEditing(false);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Went to bed", bed, setBed],
                ["Woke up", wake, setWake],
              ] as const
            ).map(([label, v, set]) => (
              <label key={label} className="rounded-2xl bg-surface p-3 ring-1 ring-line">
                <span className="block text-xs text-muted">{label}</span>
                <input type="time" value={v} onChange={(e) => set(e.target.value)} required className="mt-1 w-full bg-transparent text-lg font-semibold outline-none" />
              </label>
            ))}
          </div>
          <button className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan font-semibold text-white transition hover:brightness-110">
            <Check size={16} /> Save {formatMinutes(preview)}
          </button>
          {value != null && (
            <button
              type="button"
              onClick={() => {
                onSave(null);
                setEditing(true);
              }}
              className="mt-2 h-10 w-full rounded-xl text-sm font-semibold text-muted transition hover:text-rose"
            >
              Clear sleep entry
            </button>
          )}
        </form>
      ) : (
        <div className="mt-4">
          <p className="font-display text-3xl font-bold tabular-nums">{formatMinutes(value ?? 0)}</p>
          <p className="mt-1 text-sm text-muted">
            {(value ?? 0) >= target
              ? "Fully rested. 😴"
              : `${formatMinutes(target - (value ?? 0))} short of your ${formatMinutes(target)} target.`}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Journal line ---------- */
function JournalCard({ note, onSave }: { note: string | null; onSave: (note: string | null) => void }) {
  const [text, setText] = useState(note ?? "");
  const [savedText, setSavedText] = useState(note ?? "");
  const dirty = text.trim() !== savedText.trim();

  function commit() {
    if (!dirty) return;
    setSavedText(text);
    onSave(text.trim() || null);
  }

  return (
    <div className="glass rounded-[28px] p-6 md:col-span-2">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose/15 text-rose">
          <NotebookPen size={20} />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold">One line about today</h2>
          <p className="text-sm text-muted">A win, a lesson, or how it went. It fills your journal segment.</p>
        </div>
        <Link href="/journal" className="ml-auto shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-rose ring-1 ring-rose/30 transition hover:bg-rose/10">
          Open journal
        </Link>
      </div>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          maxLength={280}
          placeholder="Finished chapter 4 and finally understood recursion."
          aria-label="One line about today"
          className="h-12 flex-1 rounded-2xl border border-line bg-surface px-4 text-base outline-none transition focus:border-rose focus:ring-4 focus:ring-rose/15"
        />
        <button
          disabled={!dirty}
          className="h-12 rounded-2xl bg-rose px-6 font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {savedText && !dirty ? "Saved" : "Save"}
        </button>
      </form>
    </div>
  );
}

/* ---------- Steps + meals ---------- */
const MEALS: { key: MealKey; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snacks", label: "Snacks" },
];
const RATINGS: { v: MealRating; emoji: string; label: string }[] = [
  { v: "good", emoji: "🥗", label: "Healthy" },
  { v: "okay", emoji: "🍛", label: "Okay" },
  { v: "junk", emoji: "🍔", label: "Junk" },
];

function HealthCard({
  steps,
  stepsGoal,
  meals,
  onSteps,
  onMeals,
}: {
  steps: number;
  stepsGoal: number;
  meals: Meals;
  onSteps: (n: number) => void;
  onMeals: (m: Meals) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(steps));
  const pct = Math.min(1, steps / stepsGoal);

  return (
    <div className="glass rounded-[28px] p-6 md:col-span-2">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber/15 text-amber">
              <Footprints size={20} />
            </span>
            <h2 className="font-display text-lg font-bold">Steps</h2>
          </div>
          {editing ? (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onSteps(Math.max(0, Math.min(100000, Math.round(Number(draft) || 0))));
                setEditing(false);
              }}
            >
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                aria-label="Steps today"
                className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-lg font-semibold outline-none focus:border-amber"
              />
              <button className="h-12 rounded-xl bg-amber px-5 font-semibold text-bg">Save</button>
            </form>
          ) : (
            <button
              onClick={() => {
                setDraft(String(steps));
                setEditing(true);
              }}
              className="mt-3 text-left"
              aria-label="Type your step count"
            >
              <span className="font-display text-3xl font-bold tabular-nums">{steps.toLocaleString("en-IN")}</span>
              <span className="text-muted"> / {stepsGoal.toLocaleString("en-IN")}</span>
            </button>
          )}
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line">
            <motion.div className="h-full rounded-full bg-amber" initial={false} animate={{ width: `${pct * 100}%` }} />
          </div>
          <div className="mt-4 flex gap-2">
            {[500, 1000, 2000].map((n) => (
              <button
                key={n}
                onClick={() => onSteps(Math.min(100000, steps + n))}
                className="h-10 flex-1 rounded-xl bg-surface-strong text-sm font-semibold ring-1 ring-line transition hover:ring-amber/60"
              >
                +{n >= 1000 ? `${n / 1000}k` : n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Copy the number from your phone&apos;s step counter, or tap to add.</p>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint/15 text-mint">
              <Salad size={20} />
            </span>
            <h2 className="font-display text-lg font-bold">Meals</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {MEALS.map((m) => (
              <li key={m.key} className="flex items-center gap-2">
                <span className="w-20 text-sm font-semibold">{m.label}</span>
                <div className="grid flex-1 grid-cols-3 gap-1.5">
                  {RATINGS.map((r) => {
                    const on = meals[m.key] === r.v;
                    return (
                      <button
                        key={r.v}
                        onClick={() => onMeals({ ...meals, [m.key]: on ? undefined : r.v })}
                        aria-pressed={on}
                        aria-label={`${m.label}: ${r.label}`}
                        title={r.label}
                        className={`h-10 rounded-xl text-lg transition ${on ? "bg-mint/15 ring-2 ring-mint" : "bg-surface ring-1 ring-line hover:ring-mint/40"}`}
                      >
                        {r.emoji}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">🥗 healthy, 🍛 okay, 🍔 junk. No calorie counting.</p>
        </div>
      </div>
    </div>
  );
}
