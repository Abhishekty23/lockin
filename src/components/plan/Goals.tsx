"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Pencil, Plus, Trash2, Trophy, X } from "lucide-react";
import { HABIT_COLORS, colorVar } from "@/lib/habits";
import type { Goal, Task } from "@/lib/plan";
import type { GoalInput } from "@/app/plan/actions";

const EMOJIS = [
  "🎯",
  "🎓",
  "💼",
  "💻",
  "📚",
  "🏃",
  "💪",
  "🧠",
  "🗣️",
  "🎸",
  "✍️",
  "💰",
  "🚀",
  "🏆",
  "🌍",
  "🧘",
];

function daysLeft(target: string, today: string) {
  return Math.round(
    (new Date(`${target}T12:00:00Z`).getTime() -
      new Date(`${today}T12:00:00Z`).getTime()) /
      86400000,
  );
}

export function GoalCard({
  goal,
  today,
  tasks,
  onEdit,
  onToggleMilestone,
  onAddMilestone,
  onDeleteMilestone,
  onAchieve,
}: {
  goal: Goal;
  today: string;
  tasks: Task[];
  onEdit: () => void;
  onToggleMilestone: (id: string, done: boolean) => void;
  onAddMilestone: (title: string) => Promise<boolean>;
  onDeleteMilestone: (id: string) => void;
  onAchieve: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const c = colorVar(goal.color);
  const ms = [...goal.milestones].sort((a, b) => a.position - b.position);
  const done = ms.filter((m) => m.done_at).length;
  const pct = ms.length ? done / ms.length : goal.achieved_at ? 1 : 0;
  const open = tasks.filter((t) => t.goal_id === goal.id && !t.done_at).length;
  const left = goal.target_date ? daysLeft(goal.target_date, today) : null;
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <motion.article
      layout
      className={`glass rounded-[28px] p-6 ${goal.achieved_at ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center">
          <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke="var(--line)"
              strokeWidth="6"
            />
            {pct > 0 && (
              <motion.circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke={c}
                strokeWidth="6"
                strokeLinecap="round"
                initial={false}
                animate={{ strokeDasharray: `${C * pct} ${C}` }}
                transition={{ type: "spring", stiffness: 70, damping: 16 }}
              />
            )}
          </svg>
          <span className="text-2xl">
            {goal.achieved_at ? "🏆" : goal.emoji}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight">
            {goal.title}
          </h3>
          {goal.why && <p className="mt-1 text-sm text-muted">{goal.why}</p>}
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs font-semibold text-muted">
            <span className="tabular-nums">{Math.round(pct * 100)}% done</span>
            {left != null && !goal.achieved_at && (
              <span className={left < 0 ? "text-rose" : ""}>
                {left < 0
                  ? `${-left} days past target`
                  : left === 0
                    ? "Target is today"
                    : `${left} days left`}
              </span>
            )}
            {open > 0 && (
              <span>
                {open} open task{open > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onEdit}
          aria-label={`Edit ${goal.title}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface hover:text-ink"
        >
          <Pencil size={16} />
        </button>
      </div>

      <ul className="mt-4 space-y-1">
        {ms.map((m) => (
          <li
            key={m.id}
            className="group flex items-center gap-3 rounded-xl px-1 py-1.5"
          >
            <button
              onClick={() => onToggleMilestone(m.id, !m.done_at)}
              aria-label={`${m.title}: ${m.done_at ? "done" : "not done"}`}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition"
              style={{
                borderColor: c,
                background: m.done_at ? c : "transparent",
              }}
            >
              {m.done_at && (
                <Check size={13} strokeWidth={3} className="text-white" />
              )}
            </button>
            <span
              className={`flex-1 text-sm ${m.done_at ? "text-muted line-through" : ""}`}
            >
              {m.title}
            </span>
            <button
              onClick={() => onDeleteMilestone(m.id)}
              aria-label={`Delete ${m.title}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted opacity-0 transition hover:text-rose group-hover:opacity-100 focus:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
      {!goal.achieved_at && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onAddMilestone(draft)) setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={100}
            placeholder="Add a milestone"
            aria-label={`Add a milestone to ${goal.title}`}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-violet"
          />
          <button
            disabled={!draft.trim()}
            aria-label="Add milestone"
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface-strong ring-1 ring-line disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </form>
      )}

      <button
        onClick={() => onAchieve(!goal.achieved_at)}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition"
        style={
          goal.achieved_at
            ? { boxShadow: "inset 0 0 0 1px var(--line)" }
            : {
                background: `color-mix(in srgb, ${c} 18%, transparent)`,
                color: "var(--ink)",
              }
        }
      >
        <Trophy size={16} />{" "}
        {goal.achieved_at ? "Mark as not achieved" : "Mark goal achieved"}
      </button>
    </motion.article>
  );
}

export function GoalDialog({
  goal,
  onClose,
  onSave,
  onRemove,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSave: (g: GoalInput) => Promise<string | null>;
  onRemove?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [why, setWhy] = useState(goal?.why ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯");
  const [color, setColor] = useState<string>(goal?.color ?? "violet");
  const [target, setTarget] = useState(goal?.target_date ?? "");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        role="dialog"
        aria-label={goal ? "Edit goal" : "New goal"}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const err = await onSave({
            title,
            why,
            emoji,
            color,
            targetDate: target || null,
            milestones: steps.split("\n"),
          });
          setBusy(false);
          setError(err);
        }}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[32px] bg-surface-strong p-6 ring-1 ring-line sm:max-w-lg sm:rounded-[32px]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">
            {goal ? "Edit goal" : "New goal"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          required
          autoFocus
          placeholder="e.g. Get my first freelance client"
          aria-label="Goal"
          className="mt-5 h-13 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-lg font-semibold outline-none focus:border-violet"
        />
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="Why it matters to you (optional)"
          aria-label="Why it matters"
          className="mt-2 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-violet"
        />
        <div className="mt-4 grid grid-cols-8 gap-1.5">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setEmoji(e)}
              aria-label={`Icon ${e}`}
              aria-pressed={emoji === e}
              className={`grid aspect-square place-items-center rounded-xl text-xl ${emoji === e ? "bg-violet/20 ring-2 ring-violet" : "hover:bg-surface"}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2.5">
          {HABIT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              className="h-9 w-9 rounded-full"
              style={{
                background: colorVar(c),
                boxShadow:
                  color === c
                    ? `0 0 0 3px var(--surface-strong), 0 0 0 5px ${colorVar(c)}`
                    : undefined,
              }}
            />
          ))}
        </div>
        <label className="mt-4 block rounded-2xl bg-surface p-3 ring-1 ring-line">
          <span className="block text-xs text-muted">
            Target date (optional)
          </span>
          <input
            type="date"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full bg-transparent text-base font-semibold outline-none"
          />
        </label>
        {!goal && (
          <label className="mt-3 block">
            <span className="text-sm font-semibold">
              Milestones, one per line (optional)
            </span>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={4}
              placeholder={
                "Build a portfolio site\nMake profiles on 2 freelance sites\nSend 20 proposals"
              }
              className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-violet"
            />
          </label>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-rose/10 px-4 py-3 text-sm ring-1 ring-rose/25"
          >
            {error}
          </p>
        )}
        <button
          disabled={busy || !title.trim()}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white disabled:opacity-50"
          style={{ background: colorVar(color as never) }}
        >
          {busy && <Loader2 size={16} className="animate-spin" />}{" "}
          {goal ? "Save goal" : "Add goal"}
        </button>
        {goal && onRemove && (
          <AnimatePresence mode="wait">
            {confirm ? (
              <motion.div
                key="c"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 flex gap-2"
              >
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="h-11 flex-1 rounded-2xl text-sm font-semibold ring-1 ring-line"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="h-11 flex-1 rounded-2xl bg-rose text-sm font-semibold text-white"
                >
                  Remove goal
                </button>
              </motion.div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-rose"
              >
                <Trash2 size={15} /> Remove goal
              </button>
            )}
          </AnimatePresence>
        )}
      </motion.form>
    </motion.div>
  );
}
