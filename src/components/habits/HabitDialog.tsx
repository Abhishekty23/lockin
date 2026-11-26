"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Trash2, X } from "lucide-react";
import { HABIT_COLORS, WEEKDAYS, colorVar, type Habit, type HabitColor } from "@/lib/habits";
import type { HabitInput } from "@/app/habits/actions";

const EMOJIS = ["✅", "📖", "🧘", "💪", "🏃", "🚶", "🧠", "📝", "💧", "🍎", "🥗", "🛏️", "📵", "🎸", "🎨", "💻", "🗣️", "🙏", "🌅", "🚿", "🦷", "💊", "🧹", "💰"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // show Monday first

// Create or edit a habit: name, emoji, colour and the days it's due.
export default function HabitDialog({
  habit,
  onClose,
  onSave,
  onDelete,
}: {
  habit: Habit | null; // null = new habit
  onClose: () => void;
  onSave: (input: HabitInput) => Promise<string | null>; // returns an error message or null
  onDelete?: () => Promise<string | null>;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState(habit?.emoji ?? "✅");
  const [color, setColor] = useState<HabitColor>(habit?.color ?? "violet");
  const [days, setDays] = useState<number[]>(habit?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await onSave({ name, emoji, color, days });
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        onSubmit={submit}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        role="dialog"
        aria-label={habit ? "Edit habit" : "New habit"}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[32px] bg-surface-strong p-6 ring-1 ring-line sm:max-w-lg sm:rounded-[32px]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{habit ? "Edit habit" : "New habit"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: `color-mix(in srgb, ${colorVar(color)} 18%, transparent)` }}>
            {emoji}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            autoFocus
            placeholder="e.g. Read 10 pages"
            aria-label="Habit name"
            className="h-14 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-lg font-semibold outline-none focus:border-violet focus:ring-4 focus:ring-violet/20"
          />
        </div>

        <h3 className="mt-6 text-sm font-semibold">Icon</h3>
        <div className="mt-2 grid grid-cols-8 gap-1.5">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setEmoji(e)}
              aria-label={`Icon ${e}`}
              aria-pressed={emoji === e}
              className={`grid aspect-square place-items-center rounded-xl text-xl transition ${emoji === e ? "bg-violet/20 ring-2 ring-violet" : "hover:bg-surface"}`}
            >
              {e}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-sm font-semibold">Colour</h3>
        <div className="mt-2 flex gap-2.5">
          {HABIT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              className="grid h-10 w-10 place-items-center rounded-full transition"
              style={{ background: colorVar(c), boxShadow: color === c ? `0 0 0 3px var(--surface-strong), 0 0 0 5px ${colorVar(c)}` : undefined }}
            />
          ))}
        </div>

        <h3 className="mt-6 text-sm font-semibold">Repeat on</h3>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {ORDER.map((d) => {
            const on = days.includes(d);
            return (
              <button
                type="button"
                key={d}
                onClick={() => toggleDay(d)}
                aria-pressed={on}
                className={`h-11 rounded-xl text-sm font-semibold transition ${on ? "text-white" : "bg-surface text-muted ring-1 ring-line"}`}
                style={on ? { background: colorVar(color) } : undefined}
              >
                {WEEKDAYS[d].slice(0, 2)}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2 text-sm">
          {(
            [
              ["Every day", [0, 1, 2, 3, 4, 5, 6]],
              ["Weekdays", [1, 2, 3, 4, 5]],
              ["Weekends", [0, 6]],
            ] as const
          ).map(([l, ds]) => (
            <button type="button" key={l} onClick={() => setDays([...ds])} className="rounded-full px-3 py-1.5 font-semibold text-muted ring-1 ring-line hover:text-ink">
              {l}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert" className="mt-4 rounded-xl bg-rose/10 px-4 py-3 text-sm text-ink ring-1 ring-rose/25">
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          disabled={busy || !name.trim() || days.length === 0}
          className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          style={{ background: colorVar(color) }}
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          {habit ? "Save changes" : "Add habit"}
        </button>

        {habit && onDelete && (
          <div className="mt-3">
            {confirmDelete ? (
              <div className="rounded-2xl bg-rose/10 p-4 ring-1 ring-rose/25">
                <p className="text-sm">Remove &ldquo;{habit.name}&rdquo;? Its past check-ins stay in your history.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)} className="h-10 flex-1 rounded-xl bg-surface font-semibold ring-1 ring-line">
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy(true);
                      const err = await onDelete();
                      setBusy(false);
                      if (err) setError(err);
                    }}
                    className="h-10 flex-1 rounded-xl bg-rose font-semibold text-white"
                  >
                    Remove habit
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-rose">
                <Trash2 size={16} /> Remove habit
              </button>
            )}
          </div>
        )}
      </motion.form>
    </motion.div>
  );
}
