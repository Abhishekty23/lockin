"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus } from "lucide-react";
import { addDays } from "@/lib/day";
import { TEMPLATES, colorVar, isScheduled, scheduleLabel, streakEmoji, weekday, type Habit } from "@/lib/habits";
import type { HabitWithHistory } from "@/lib/habits-server";
import HabitDialog from "./HabitDialog";
import HabitRow from "./HabitRow";
import { useHabits } from "./useHabits";

export default function HabitsBoard({ initial, today, soundOn }: { initial: HabitWithHistory[]; today: string; soundOn: boolean }) {
  const [toast, setToast] = useState<{ text: string; tone: "good" | "error" } | null>(null);
  const [dialog, setDialog] = useState<Habit | "new" | null>(null);
  const { habits, dueToday, doneToday, progress, toggle, create, update, remove } = useHabits({
    initial,
    today,
    soundOn,
    onError: (text) => setToast({ text, tone: "error" }),
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const notToday = habits.filter((h) => !isScheduled(h, today));
  const unused = TEMPLATES.filter((t) => !habits.some((h) => h.name.toLowerCase() === t.name.toLowerCase()));

  async function addTemplate(t: (typeof TEMPLATES)[number]) {
    const err = await create(t);
    setToast(err ? { text: err, tone: "error" } : { text: `Added "${t.name}"`, tone: "good" });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
      {/* ---------- Header + today ---------- */}
      <section className="glass rounded-[36px] p-6 sm:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Habits</h1>
            <p className="mt-2 max-w-lg text-muted">Small things you do on purpose, every day you planned them. Each tick fills the Habits part of your ring.</p>
          </div>
          <button
            onClick={() => setDialog("new")}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-ink px-5 font-semibold text-bg transition hover:opacity-90"
          >
            <Plus size={18} /> New habit
          </button>
        </div>

        {habits.length > 0 && (
          <>
            {progress.total > 0 && (
              <>
            <div className="mt-8 flex items-center justify-between text-sm">
                  <span className="font-semibold">Today</span>
                  <span className="tabular-nums text-muted">
                    {progress.done} of {progress.total} done
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
                  <motion.div
                    className="h-full rounded-full bg-mint"
                    initial={false}
                    animate={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                    transition={{ type: "spring", stiffness: 90, damping: 18 }}
                  />
                </div>
              </>
            )}

            {dueToday.length === 0 ? (
              <p className="mt-8 text-muted">Nothing scheduled today. Enjoy the rest day. 🌿</p>
            ) : (
              <div className="mt-5 grid gap-2.5 md:grid-cols-2">
                {dueToday.map((h) => (
                  <HabitRow key={h.id} habit={h} done={doneToday.includes(h)} onToggle={async () => (await toggle(h.id)) && setToast({ text: "Every habit done today. Streaks safe! 🎉", tone: "good" })} />
                ))}
              </div>
            )}

            {notToday.length > 0 && (
              <p className="mt-4 text-sm text-muted">
                Not today: {notToday.map((h) => `${h.emoji} ${h.name}`).join(", ")}
              </p>
            )}
          </>
        )}

        {habits.length === 0 && (
          <div className="mt-8 rounded-3xl border border-dashed border-line p-6 text-center">
            <p className="text-4xl">🌱</p>
            <h2 className="mt-3 font-display text-xl font-bold">Start with one or two</h2>
            <p className="mx-auto mt-1 max-w-md text-muted">Tap a starter below to add it, or make your own. Small habits you actually keep beat big ones you don&apos;t.</p>
          </div>
        )}
      </section>

      {/* ---------- Starters ---------- */}
      {unused.length > 0 && habits.length < 6 && (
        <section className="mt-4">
          <h2 className="px-1 font-semibold">Quick starters</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {unused.map((t) => (
              <button
                key={t.name}
                onClick={() => addTemplate(t)}
                className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-4 py-2.5 text-sm font-semibold ring-1 ring-line transition hover:ring-2"
                style={{ ["--tw-ring-color" as string]: colorVar(t.color) }}
              >
                <span className="text-lg">{t.emoji}</span> {t.name}
                <Plus size={14} className="text-muted" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Each habit's history ---------- */}
      {habits.length > 0 && (
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          {habits.map((h) => (
            <HabitCard key={h.id} habit={h} today={today} onEdit={() => setDialog(h)} />
          ))}
        </section>
      )}

      <AnimatePresence>
        {dialog && (
          <HabitDialog
            habit={dialog === "new" ? null : dialog}
            onClose={() => setDialog(null)}
            onSave={async (input) => {
              const err = dialog === "new" ? await create(input) : await update(dialog.id, input);
              if (!err) {
                setDialog(null);
                setToast({ text: dialog === "new" ? `Added "${input.name.trim()}"` : "Habit saved", tone: "good" });
              }
              return err;
            }}
            onDelete={
              dialog === "new"
                ? undefined
                : async () => {
                    const err = await remove(dialog.id);
                    if (!err) {
                      setDialog(null);
                      setToast({ text: "Habit removed", tone: "good" });
                    }
                    return err;
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

// A habit's last five weeks, Monday to Sunday, plus its streaks.
function HabitCard({ habit, today, onEdit }: { habit: HabitWithHistory; today: string; onEdit: () => void }) {
  const c = colorVar(habit.color);
  const done = new Set(habit.doneDays);
  // Start on the Monday five weeks back so the grid lines up by weekday
  const end = addDays(today, (7 - weekday(today)) % 7); // this coming Sunday
  const start = addDays(end, -34);
  const days = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  const created = habit.created_at.slice(0, 10);
  const due = days.filter((d) => d <= today && d >= created && isScheduled(habit, d));
  const rate = due.length ? Math.round((due.filter((d) => done.has(d)).length / due.length) * 100) : 0;

  return (
    <article className="glass rounded-[28px] p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)` }}>
          {habit.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-bold">{habit.name}</h3>
          <p className="text-sm text-muted">{scheduleLabel(habit.days)}</p>
        </div>
        <button onClick={onEdit} aria-label={`Edit ${habit.name}`} className="grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-surface hover:text-ink">
          <Pencil size={16} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat label="Streak" value={`${habit.streak}${habit.streak ? ` ${streakEmoji(habit.streak)}` : ""}`} />
        <Stat label="Best" value={String(habit.best)} />
        <Stat label="Last 5 weeks" value={`${rate}%`} />
      </div>

      <div className="mt-5 grid max-w-[260px] grid-cols-7 gap-1.5" role="img" aria-label={`${habit.name}: last five weeks`}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-center text-[11px] font-semibold text-muted">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const future = d > today || d < created;
          const sched = isScheduled(habit, d);
          const hit = done.has(d);
          return (
            <span
              key={d}
              title={d}
              className={`aspect-square rounded-md ${d === today ? "ring-2 ring-ink/60" : ""}`}
              style={{
                background: hit ? c : future || !sched ? "transparent" : "var(--line)",
                border: !hit && (future || !sched) ? "1px dashed var(--line)" : undefined,
                opacity: future ? 0.4 : 1,
              }}
            />
          );
        })}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface py-3 ring-1 ring-line">
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
