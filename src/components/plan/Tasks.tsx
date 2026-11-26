"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import { addDays } from "@/lib/day";
import { PRIORITIES, dueLabel, type Goal, type Task } from "@/lib/plan";
import { formatMinutes } from "@/lib/day";
import type { TaskInput } from "@/app/plan/actions";

const ESTIMATES = [15, 25, 30, 45, 60, 90, 120];

/* ---------- Task editor: used for quick add and for editing ---------- */
export function TaskEditor({
  today,
  goals,
  initial,
  onSubmit,
  onCancel,
  autoFocus,
  submitLabel = "Add",
}: {
  today: string;
  goals: Goal[];
  initial?: Partial<TaskInput>;
  onSubmit: (t: TaskInput) => Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
  submitLabel?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? 2);
  const [due, setDue] = useState<string | null>(initial && "due" in initial ? (initial.due ?? null) : today);
  const [estimate, setEstimate] = useState<number | null>(initial?.estimate ?? null);
  const [goalId, setGoalId] = useState<string | null>(initial?.goalId ?? null);
  const [busy, setBusy] = useState(false);

  const tomorrow = addDays(today, 1);
  const chip = (on: boolean) => `h-9 rounded-xl px-3 text-sm font-semibold transition ${on ? "bg-ink text-bg" : "bg-surface ring-1 ring-line hover:ring-violet/40"}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit({ title, priority, due, estimate, goalId });
    setBusy(false);
    if (ok && !initial?.title) {
      setTitle("");
      setEstimate(null);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-surface p-3 ring-1 ring-line focus-within:ring-violet/50">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          autoFocus={autoFocus}
          placeholder="Add a task, e.g. Finish chapter 6 notes"
          aria-label="Task"
          className="h-11 min-w-0 flex-1 bg-transparent px-2 text-base outline-none"
        />
        <button disabled={!title.trim() || busy} className="flex h-11 items-center gap-1.5 rounded-2xl bg-violet px-4 font-semibold text-white disabled:opacity-40">
          <Plus size={16} /> {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Cancel" className="grid h-11 w-11 place-items-center rounded-2xl text-muted hover:text-ink">
            <X size={18} />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
        {PRIORITIES.map((p) => (
          <button
            type="button"
            key={p.v}
            onClick={() => setPriority(p.v)}
            aria-pressed={priority === p.v}
            className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 transition"
            style={priority === p.v ? { background: `color-mix(in srgb, ${p.color} 18%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${p.color}` } : { boxShadow: "inset 0 0 0 1px var(--line)" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" onClick={() => setDue(today)} className={chip(due === today)}>
          Today
        </button>
        <button type="button" onClick={() => setDue(tomorrow)} className={chip(due === tomorrow)}>
          Tomorrow
        </button>
        <label className={`${chip(!!due && due !== today && due !== tomorrow)} flex cursor-pointer items-center gap-1.5`}>
          <CalendarDays size={14} />
          <input
            type="date"
            value={due && due !== today && due !== tomorrow ? due : ""}
            min={today}
            onChange={(e) => setDue(e.target.value || null)}
            aria-label="Pick a date"
            className="w-[7.2rem] bg-transparent text-sm outline-none [color-scheme:inherit]"
          />
        </label>
        <button type="button" onClick={() => setDue(null)} className={chip(due === null)}>
          Someday
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <label className="flex h-9 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold ring-1 ring-line">
          <Clock size={14} className="text-muted" />
          <select value={estimate ?? ""} onChange={(e) => setEstimate(e.target.value ? Number(e.target.value) : null)} aria-label="Time needed" className="bg-transparent outline-none">
            <option value="">Time</option>
            {ESTIMATES.map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </select>
        </label>
        {goals.length > 0 && (
          <label className="flex h-9 items-center gap-1 rounded-xl px-2 text-sm font-semibold ring-1 ring-line">
            <select value={goalId ?? ""} onChange={(e) => setGoalId(e.target.value || null)} aria-label="Goal" className="max-w-40 bg-transparent outline-none">
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </form>
  );
}

/* ---------- One task row ---------- */
export function TaskRow({
  task,
  today,
  goals,
  onToggle,
  onDelete,
  onSave,
}: {
  task: Task;
  today: string;
  goals: Goal[];
  onToggle: () => void;
  onDelete: () => void;
  onSave: (t: TaskInput) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const p = PRIORITIES.find((x) => x.v === task.priority)!;
  const done = Boolean(task.done_at);
  const goal = goals.find((g) => g.id === task.goal_id);
  const label = dueLabel(task.due, today);
  const late = !done && task.due && task.due < today;

  if (editing)
    return (
      <TaskEditor
        today={today}
        goals={goals}
        autoFocus
        submitLabel="Save"
        initial={{ title: task.title, priority: task.priority, due: task.due, estimate: task.estimate_minutes, goalId: task.goal_id }}
        onCancel={() => setEditing(false)}
        onSubmit={async (t) => {
          const ok = await onSave(t);
          if (ok) setEditing(false);
          return ok;
        }}
      />
    );

  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface">
      <button
        onClick={onToggle}
        aria-label={`${task.title}: ${done ? "done" : "not done"}`}
        aria-pressed={done}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition"
        style={{ borderColor: p.color, background: done ? p.color : "transparent" }}
      >
        {done && <Check size={14} strokeWidth={3} className="text-white" />}
      </button>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${done ? "text-muted line-through" : ""}`}>{task.title}</span>
        {(label || task.estimate_minutes || goal) && (
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
            {label && <span className={late ? "font-semibold text-rose" : ""}>{label}</span>}
            {task.estimate_minutes && <span>{formatMinutes(task.estimate_minutes)}</span>}
            {goal && (
              <span>
                {goal.emoji} {goal.title}
              </span>
            )}
          </span>
        )}
      </span>
      <span className="flex opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button onClick={() => setEditing(true)} aria-label={`Edit ${task.title}`} className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:text-ink">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} aria-label={`Delete ${task.title}`} className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:text-rose">
          <Trash2 size={15} />
        </button>
      </span>
    </motion.li>
  );
}

export function TaskList(props: Omit<Parameters<typeof TaskRow>[0], "task" | "onToggle" | "onDelete" | "onSave"> & {
  tasks: Task[];
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onSave: (t: Task, input: TaskInput) => Promise<boolean>;
  empty?: string;
}) {
  const { tasks, onToggle, onDelete, onSave, empty, ...rest } = props;
  if (tasks.length === 0) return empty ? <p className="px-2 py-3 text-sm text-muted">{empty}</p> : null;
  return (
    <ul className="space-y-0.5">
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} {...rest} onToggle={() => onToggle(t)} onDelete={() => onDelete(t)} onSave={(i) => onSave(t, i)} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
