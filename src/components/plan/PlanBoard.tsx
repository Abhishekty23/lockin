"use client";

import { safe } from "@/lib/net";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, ChevronDown, Loader2, Plus } from "lucide-react";
import { sounds } from "@/lib/sounds";
import { addDays } from "@/lib/day";
import { BLOCK_KINDS, sortTasks, type Block, type BlockKind, type Goal, type Task, type WeekPlan } from "@/lib/plan";
import * as A from "@/app/plan/actions";
import { TaskEditor, TaskList } from "./Tasks";
import Timetable from "./Timetable";
import { GoalCard, GoalDialog } from "./Goals";

type Tab = "today" | "tasks" | "goals" | "week";
const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tasks", label: "All tasks" },
  { id: "goals", label: "Goals" },
  { id: "week", label: "Week" },
];

const BLOCK_KIND_IDS = BLOCK_KINDS.map((k) => k.id);
/** Same checks the server makes, so a new block can show at once. */
function draftBlock(b: A.BlockInput): Omit<Block, "id" | "day"> | string {
  const start = Math.round(Number(b.start));
  const end = Math.round(Number(b.end));
  const title = b.title.trim().slice(0, 60);
  if (!title) return "Give the block a name.";
  if (!(start >= 0 && start < 1440 && end > start && end <= 1440)) return "The end time has to be after the start time.";
  return { start_min: start, end_min: end, title, kind: (BLOCK_KIND_IDS.includes(b.kind as BlockKind) ? b.kind : "other") as BlockKind };
}

export default function PlanBoard({
  today,
  wake,
  sleep,
  timezone,
  soundOn,
  initialTasks,
  initialBlocks,
  initialGoals,
  week,
  lastWeek,
}: {
  today: string;
  wake: string;
  sleep: string;
  timezone: string;
  soundOn: boolean;
  initialTasks: Task[];
  initialBlocks: Block[];
  initialGoals: Goal[];
  week: WeekPlan;
  lastWeek: WeekPlan | null;
}) {
  const [tab, setTab] = useState<Tab>("today");
  const [tasks, setTasks] = useState(initialTasks);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [goals, setGoals] = useState(initialGoals);
  const [toast, setToast] = useState<{ text: string; tone: "good" | "error" } | null>(null);
  const [goalDialog, setGoalDialog] = useState<Goal | "new" | null>(null);
  const [showDone, setShowDone] = useState(false);

  const flash = (text: string, tone: "good" | "error" = "good") => setToast({ text, tone });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Tabs follow the address (#tasks, #goals, #week) so they can be bookmarked
  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1) as Tab;
      setTab(TABS.some((t) => t.id === h) ? h : "today");
    };
    const t = setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "today" ? location.pathname : `#${t}`);
  };

  /* ---------- tasks ---------- */
  const sorted = [...tasks].sort(sortTasks);
  const open = sorted.filter((t) => !t.done_at);
  const overdue = open.filter((t) => t.due && t.due < today);
  const dueToday = open.filter((t) => t.due === today);
  const doneToday = sorted.filter((t) => t.done_at && t.due === today);
  const tomorrow = open.filter((t) => t.due === addDays(today, 1));
  const later = open.filter((t) => t.due && t.due > addDays(today, 1));
  const someday = open.filter((t) => !t.due);
  const done = sorted.filter((t) => t.done_at);

  // Adds and edits show on screen straight away; the save runs in the background and is undone if it fails
  const draftTask = (i: A.TaskInput): Omit<Task, "id" | "done_at" | "created_at"> => ({
    title: i.title.trim().slice(0, 140),
    priority: ([1, 2, 3].includes(Number(i.priority)) ? Number(i.priority) : 2) as Task["priority"],
    due: i.due || null,
    estimate_minutes: i.estimate && i.estimate >= 5 && i.estimate <= 600 ? Math.round(i.estimate) : null,
    goal_id: i.goalId || null,
  });
  async function add(i: A.TaskInput) {
    if (!i.title.trim()) return false;
    const id = crypto.randomUUID();
    setTasks((ts) => [...ts, { id, ...draftTask(i), done_at: null, created_at: new Date().toISOString() }]);
    void safe(A.addTask(i, id)).then((res) => {
      if (!res.ok) {
        setTasks((ts) => ts.filter((x) => x.id !== id));
        flash(res.error, "error");
      } else setTasks((ts) => ts.map((x) => (x.id === id ? res.task : x)));
    });
    return true;
  }
  async function save(t: Task, i: A.TaskInput) {
    if (!i.title.trim()) return flash("The task needs a title.", "error"), false;
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...draftTask(i) } : x)));
    void safe(A.updateTask(t.id, i)).then((res) => {
      if (!res.ok) {
        setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));
        flash(res.error, "error");
      } else setTasks((ts) => ts.map((x) => (x.id === t.id ? res.task : x)));
    });
    return true;
  }
  async function toggle(t: Task) {
    const doneNow = !t.done_at;
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done_at: doneNow ? new Date().toISOString() : null } : x)));
    if (doneNow && soundOn) sounds.done();
    const res = await safe(A.toggleTask(t.id, doneNow));
    if (!res.ok) {
      setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));
      flash(res.error, "error");
    } else if (doneNow && t.due === today && dueToday.length === 1 && overdue.length === 0) {
      if (soundOn) sounds.badge();
      flash("Every task for today is done! 🎉");
    }
  }
  async function remove(t: Task) {
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    const res = await safe(A.deleteTask(t.id));
    if (!res.ok) {
      setTasks((ts) => [...ts, t]);
      flash(res.error, "error");
    } else flash("Task deleted");
  }
  async function rollOver() {
    const res = await safe(A.rollOverTasks());
    if (!res.ok) return flash(res.error, "error");
    setTasks((ts) => ts.map((x) => (!x.done_at && x.due && x.due < today ? { ...x, due: today } : x)));
    flash(`Moved ${res.count} task${res.count === 1 ? "" : "s"} to today`);
  }
  const listProps = { today, goals, onToggle: toggle, onDelete: remove, onSave: save };

  /* ---------- goals ---------- */
  const patchGoal = (id: string, f: (g: Goal) => Goal) => setGoals((gs) => gs.map((g) => (g.id === id ? f(g) : g)));
  const activeGoals = goals.filter((g) => !g.achieved_at);
  const achieved = goals.filter((g) => g.achieved_at);

  const tasksLeft = dueToday.length + overdue.length;
  const minutesPlanned = [...dueToday, ...overdue].reduce((s, t) => s + (t.estimate_minutes ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Plan</h1>
          <p className="mt-2 text-muted">
            {tasksLeft === 0 ? "Nothing left for today." : `${tasksLeft} task${tasksLeft > 1 ? "s" : ""} left today`}
            {minutesPlanned > 0 && `, about ${Math.round(minutesPlanned / 6) / 10} hours of work`}.
          </p>
        </div>
        <nav className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface p-1 ring-1 ring-line" aria-label="Plan sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`relative h-10 rounded-xl px-4 text-sm font-semibold transition ${tab === t.id ? "text-bg" : "text-muted hover:text-ink"}`}
            >
              {tab === t.id && <motion.span layoutId="plan-tab" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-6">
          {/* ---------- TODAY ---------- */}
          {tab === "today" && (
            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
              <section className="glass rounded-[32px] p-5 sm:p-6">
                <h2 className="font-display text-lg font-bold">Today&apos;s tasks</h2>
                <div className="mt-4">
                  <TaskEditor today={today} goals={activeGoals} onSubmit={add} />
                </div>
                {overdue.length > 0 && (
                  <div className="mt-5 rounded-2xl bg-rose/10 p-3 ring-1 ring-rose/20">
                    <div className="flex items-center justify-between gap-2 px-2">
                      <span className="text-sm font-semibold">Left over from earlier</span>
                      <button onClick={rollOver} className="flex h-9 items-center gap-1.5 rounded-xl bg-surface-strong px-3 text-sm font-semibold ring-1 ring-line">
                        <CalendarClock size={14} /> Move all to today
                      </button>
                    </div>
                    <div className="mt-1">
                      <TaskList tasks={overdue} {...listProps} />
                    </div>
                  </div>
                )}
                <div className="mt-3">
                  <TaskList tasks={dueToday} {...listProps} empty={overdue.length ? undefined : "Nothing planned yet. Add the 1 to 3 things that would make today a win."} />
                  {doneToday.length > 0 && (
                    <div className="mt-2 border-t border-line pt-2">
                      <TaskList tasks={doneToday} {...listProps} />
                    </div>
                  )}
                </div>
              </section>
              <section className="glass rounded-[32px] p-5 sm:p-6">
                <Timetable
                  blocks={blocks}
                  wake={wake}
                  sleep={sleep}
                  timezone={timezone}
                  onAdd={async (b) => {
                    const v = draftBlock(b);
                    if (typeof v === "string") return v;
                    const id = crypto.randomUUID();
                    setBlocks((bs) => [...bs, { id, day: today, ...v }]);
                    void safe(A.addBlock(b, id)).then((res) => {
                      if (!res.ok) {
                        setBlocks((bs) => bs.filter((x) => x.id !== id));
                        flash(res.error, "error");
                      } else setBlocks((bs) => bs.map((x) => (x.id === id ? res.block : x)));
                    });
                    return null;
                  }}
                  onUpdate={async (id, b) => {
                    const v = draftBlock(b);
                    if (typeof v === "string") return v;
                    const before = blocks.find((x) => x.id === id);
                    setBlocks((bs) => bs.map((x) => (x.id === id ? { ...x, ...v } : x)));
                    void safe(A.updateBlock(id, b)).then((res) => {
                      if (!res.ok) {
                        if (before) setBlocks((bs) => bs.map((x) => (x.id === id ? before : x)));
                        flash(res.error, "error");
                      } else setBlocks((bs) => bs.map((x) => (x.id === id ? res.block : x)));
                    });
                    return null;
                  }}
                  onDelete={async (id) => {
                    const before = blocks.find((x) => x.id === id);
                    setBlocks((bs) => bs.filter((x) => x.id !== id));
                    const res = await safe(A.deleteBlock(id));
                    if (!res.ok) {
                      if (before) setBlocks((bs) => [...bs, before]);
                      flash(res.error, "error");
                    }
                  }}
                  onCopy={async () => {
                    const res = await safe(A.copyLastTimetable());
                    if (!res.ok) return flash(res.error, "error");
                    setBlocks(res.blocks);
                    flash(`Copied ${res.blocks.length} blocks`);
                  }}
                />
              </section>
            </div>
          )}

          {/* ---------- ALL TASKS ---------- */}
          {tab === "tasks" && (
            <section className="glass rounded-[32px] p-5 sm:p-6">
              <TaskEditor today={today} goals={activeGoals} onSubmit={add} />
              {open.length === 0 && <p className="mt-5 px-2 text-muted">No open tasks. Add one above, or enjoy the calm.</p>}
              {(
                [
                  ["Overdue", overdue],
                  ["Today", dueToday],
                  ["Tomorrow", tomorrow],
                  ["Later", later],
                  ["Someday", someday],
                ] as const
              ).map(([label, list]) =>
                list.length ? (
                  <div key={label} className="mt-5">
                    <h3 className={`px-2 text-sm font-semibold ${label === "Overdue" ? "text-rose" : "text-muted"}`}>
                      {label} <span className="font-normal">({list.length})</span>
                    </h3>
                    <TaskList tasks={list} {...listProps} />
                  </div>
                ) : null,
              )}
              {done.length > 0 && (
                <div className="mt-5 border-t border-line pt-3">
                  <button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1.5 px-2 text-sm font-semibold text-muted">
                    <ChevronDown size={16} className={`transition ${showDone ? "rotate-180" : ""}`} /> Done this week ({done.length})
                  </button>
                  {showDone && <TaskList tasks={done} {...listProps} />}
                </div>
              )}
            </section>
          )}

          {/* ---------- GOALS ---------- */}
          {tab === "goals" && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted">Big things you&apos;re working toward. Break them into milestones and link tasks to them.</p>
                <button onClick={() => setGoalDialog("new")} className="flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-ink px-4 font-semibold text-bg">
                  <Plus size={16} /> New goal
                </button>
              </div>
              {goals.length === 0 && (
                <div className="mt-6 rounded-[32px] border border-dashed border-line p-10 text-center">
                  <p className="text-5xl">🎯</p>
                  <h2 className="mt-3 font-display text-xl font-bold">What are you working toward?</h2>
                  <p className="mx-auto mt-1 max-w-md text-muted">A goal could be an exam, a skill, a job, a fitness target. Add one and split it into small milestones.</p>
                </div>
              )}
              <div className="mt-5 grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
                {activeGoals.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    today={today}
                    tasks={tasks}
                    onEdit={() => setGoalDialog(g)}
                    onToggleMilestone={async (id, d) => {
                      patchGoal(g.id, (x) => ({ ...x, milestones: x.milestones.map((m) => (m.id === id ? { ...m, done_at: d ? new Date().toISOString() : null } : m)) }));
                      if (d && soundOn) sounds.done();
                      const res = await safe(A.toggleMilestone(id, d));
                      if (!res.ok) flash(res.error, "error");
                    }}
                    onAddMilestone={async (title) => {
                      const t = title.trim().slice(0, 100);
                      if (!t) return false;
                      const id = crypto.randomUUID();
                      patchGoal(g.id, (x) => ({ ...x, milestones: [...x.milestones, { id, goal_id: g.id, title: t, done_at: null, position: x.milestones.length }] }));
                      void safe(A.addMilestone(g.id, t, id)).then((res) => {
                        if (!res.ok) {
                          patchGoal(g.id, (x) => ({ ...x, milestones: x.milestones.filter((m) => m.id !== id) }));
                          flash(res.error, "error");
                        }
                      });
                      return true;
                    }}
                    onDeleteMilestone={async (id) => {
                      patchGoal(g.id, (x) => ({ ...x, milestones: x.milestones.filter((m) => m.id !== id) }));
                      const res = await safe(A.deleteMilestone(id));
                      if (!res.ok) flash(res.error, "error");
                    }}
                    onAchieve={async (v) => {
                      patchGoal(g.id, (x) => ({ ...x, achieved_at: v ? new Date().toISOString() : null }));
                      if (v && soundOn) sounds.badge();
                      const res = await safe(A.setGoalAchieved(g.id, v));
                      if (!res.ok) flash(res.error, "error");
                      else if (v) flash(`Goal achieved: ${g.title} 🏆`);
                    }}
                  />
                ))}
              </div>
              {achieved.length > 0 && (
                <>
                  <h2 className="mt-8 font-display text-lg font-bold">Achieved 🏆</h2>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {achieved.map((g) => (
                      <GoalCard
                        key={g.id}
                        goal={g}
                        today={today}
                        tasks={tasks}
                        onEdit={() => setGoalDialog(g)}
                        onToggleMilestone={() => {}}
                        onAddMilestone={async () => false}
                        onDeleteMilestone={() => {}}
                        onAchieve={async (v) => {
                          patchGoal(g.id, (x) => ({ ...x, achieved_at: v ? x.achieved_at : null }));
                          const res = await safe(A.setGoalAchieved(g.id, v));
                          if (!res.ok) flash(res.error, "error");
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------- WEEK ---------- */}
          {tab === "week" && <Week week={week} lastWeek={lastWeek} today={today} onSaved={(ok, msg) => flash(msg, ok ? "good" : "error")} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {goalDialog && (
          <GoalDialog
            goal={goalDialog === "new" ? null : goalDialog}
            onClose={() => setGoalDialog(null)}
            onSave={async (input) => {
              if (goalDialog === "new") {
                const res = await safe(A.addGoal(input));
                if (!res.ok) return res.error;
                setGoals((gs) => [...gs, res.goal]);
                flash(`Added goal: ${res.goal.title}`);
              } else {
                const res = await safe(A.updateGoal(goalDialog.id, input));
                if (!res.ok) return res.error;
                patchGoal(goalDialog.id, (g) => ({ ...g, title: input.title.trim(), why: input.why.trim() || null, emoji: input.emoji, color: input.color as Goal["color"], target_date: input.targetDate }));
                flash("Goal saved");
              }
              setGoalDialog(null);
              return null;
            }}
            onRemove={
              goalDialog === "new"
                ? undefined
                : async () => {
                    const res = await safe(A.archiveGoal(goalDialog.id));
                    if (!res.ok) return flash(res.error, "error");
                    setGoals((gs) => gs.filter((g) => g.id !== goalDialog.id));
                    setTasks((ts) => ts.map((t) => (t.goal_id === goalDialog.id ? { ...t, goal_id: null } : t)));
                    setGoalDialog(null);
                    flash("Goal removed");
                  }
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={`fixed bottom-24 lg:bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-surface-strong px-5 py-3 text-sm font-semibold shadow-2xl ring-1 ${toast.tone === "error" ? "text-rose ring-rose/30" : "ring-mint/40"}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Weekly plan and review ---------- */
function Week({ week, lastWeek, today, onSaved }: { week: WeekPlan; lastWeek: WeekPlan | null; today: string; onSaved: (ok: boolean, msg: string) => void }) {
  const [p, setP] = useState([0, 1, 2].map((i) => week.priorities[i] ?? ""));
  const [wins, setWins] = useState(week.wins ?? "");
  const [lessons, setLessons] = useState(week.lessons ?? "");
  const [busy, setBusy] = useState(false);
  const fmt = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const daysIn = Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${week.week_start}T12:00:00Z`).getTime()) / 86400000);
  const reviewTime = daysIn >= 4; // Friday onwards

  async function save() {
    setBusy(true);
    const res = await safe(A.saveWeek({ week_start: week.week_start, priorities: p, wins, lessons }));
    setBusy(false);
    onSaved(res.ok, res.ok ? "Week saved" : res.error);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
      <section className="glass rounded-[32px] p-6 sm:p-8">
        <p className="text-sm font-semibold text-muted">
          Week of {fmt(week.week_start)} to {fmt(addDays(week.week_start, 6))}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">Your top 3 this week</h2>
        <p className="mt-1 text-sm text-muted">If you only got these three done, the week would still be a win.</p>
        <ol className="mt-5 space-y-2.5">
          {p.map((v, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet/15 font-display font-bold text-violet">{i + 1}</span>
              <input
                value={v}
                onChange={(e) => setP((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={120}
                placeholder={["e.g. Finish the portfolio project", "e.g. Revise 3 chapters", "e.g. Run 3 times"][i]}
                aria-label={`Priority ${i + 1}`}
                className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-base outline-none focus:border-violet"
              />
            </li>
          ))}
        </ol>

        <h2 className="mt-8 font-display text-xl font-bold">Weekly review {reviewTime ? "" : "(for the weekend)"}</h2>
        <label className="mt-3 block">
          <span className="text-sm font-semibold">What went well? 🏆</span>
          <textarea value={wins} onChange={(e) => setWins(e.target.value)} maxLength={1000} rows={3} className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-violet" />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-semibold">What will you do differently next week? 🔧</span>
          <textarea value={lessons} onChange={(e) => setLessons(e.target.value)} maxLength={1000} rows={3} className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-violet" />
        </label>
        <button onClick={save} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet font-semibold text-white disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Save my week
        </button>
      </section>

      <section className="rounded-[32px] border border-line p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold">Last week</h2>
        {lastWeek && (lastWeek.priorities.length || lastWeek.wins || lastWeek.lessons) ? (
          <div className="mt-3 space-y-4 text-sm">
            {lastWeek.priorities.length > 0 && (
              <ol className="list-inside list-decimal space-y-1">
                {lastWeek.priorities.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            )}
            {lastWeek.wins && (
              <p>
                <span className="font-semibold">Went well:</span> {lastWeek.wins}
              </p>
            )}
            {lastWeek.lessons && (
              <p>
                <span className="font-semibold">Change:</span> {lastWeek.lessons}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Nothing saved for last week. Next week, you&apos;ll see this week&apos;s plan and review here.</p>
        )}
      </section>
    </div>
  );
}
