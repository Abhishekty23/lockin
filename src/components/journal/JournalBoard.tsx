"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Flame,
  Loader2,
  Lock,
  Shuffle,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { safe } from "@/lib/net";
import { addDays } from "@/lib/day";
import { sounds } from "@/lib/sounds";
import {
  blankEntry,
  cleanTag,
  entryWords,
  hasContent,
  MOODS,
  promptFor,
  toMarkdown,
  writingStreak,
  type DayMood,
  type JournalEntry,
} from "@/lib/journal";
import { deleteEntry, saveEntry, setStar } from "@/app/journal/actions";
import { updateToday } from "@/app/today/actions";
import JournalSide from "./JournalSide";

type Props = {
  today: string;
  initialDay: string;
  soundOn: boolean;
  initialEntries: JournalEntry[];
  initialMoods: DayMood[];
};
type Status = "idle" | "saving" | "saved" | "error";

const fmtLong = (d: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${d}T12:00:00Z`));

function relative(day: string, today: string) {
  const n = Math.round(
    (new Date(`${today}T12:00:00Z`).getTime() -
      new Date(`${day}T12:00:00Z`).getTime()) /
      86400000,
  );
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 7) return `${n} days ago`;
  if (n < 30) return `${Math.round(n / 7)} week${n < 11 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

/** The editor always shows three gratitude lines, even when fewer were saved. */
function draftOf(e: JournalEntry | undefined, day: string): JournalEntry {
  const base = e ? { ...e } : blankEntry(day);
  const g = [...base.gratitude];
  while (g.length < 3) g.push("");
  return { ...base, gratitude: g };
}

const FIELD =
  "w-full rounded-2xl border border-line bg-surface px-4 text-base outline-none transition placeholder:text-muted/60 focus:border-rose focus:ring-4 focus:ring-rose/15";

export default function JournalBoard({
  today,
  initialDay,
  soundOn,
  initialEntries,
  initialMoods,
}: Props) {
  const [entries, setEntriesState] = useState<Record<string, JournalEntry>>(
    () => Object.fromEntries(initialEntries.map((e) => [e.day, e])),
  );
  const [moods, setMoods] = useState<Record<string, DayMood>>(() =>
    Object.fromEntries(initialMoods.map((m) => [m.day, m])),
  );
  const [day, setDay] = useState(initialDay);
  const [draft, setDraft] = useState(() =>
    draftOf(
      initialEntries.find((e) => e.day === initialDay),
      initialDay,
    ),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{
    text: string;
    tone: "good" | "error";
  } | null>(null);

  const entriesRef = useRef(entries);
  const draftRef = useRef(draft);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  const inflight = useRef<Promise<void> | null>(null);

  const setEntries = useCallback(
    (
      fn: (prev: Record<string, JournalEntry>) => Record<string, JournalEntry>,
    ) => {
      entriesRef.current = fn(entriesRef.current);
      setEntriesState(entriesRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  /** Saves the current draft now (if it changed). Waits for any save already on its way. */
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return inflight.current ?? undefined;
    dirty.current = false;
    const d = draftRef.current;
    const mine = ++seq.current;
    setStatus("saving");
    setError(null);
    const run = (async () => {
      const res = await safe(
        saveEntry({
          day: d.day,
          gratitude: d.gratitude,
          win: d.win,
          lesson: d.lesson,
          tomorrow: d.tomorrow,
          prompt: d.prompt,
          body: d.body,
          tags: d.tags,
        }),
      );
      if (!res.ok) {
        dirty.current = true; // keep the change so the next try sends it
        if (mine === seq.current) {
          setStatus("error");
          setError(res.error);
        }
        return;
      }
      const firstToday =
        d.day === today && !entriesRef.current[d.day] && res.entry;
      setEntries((prev) => {
        const next = { ...prev };
        if (res.entry) next[d.day] = res.entry;
        else delete next[d.day];
        return next;
      });
      if (firstToday) {
        setToast({
          text: "Journal written for today ✍️ Your ring's Journal part is full.",
          tone: "good",
        });
        if (soundOn) sounds.badge();
      }
      if (mine === seq.current) setStatus("saved");
    })();
    inflight.current = run;
    await run;
    if (inflight.current === run) inflight.current = null;
  }, [today, soundOn, setEntries]);

  function edit(patch: Partial<JournalEntry>) {
    const next = { ...draftRef.current, ...patch };
    // Remember which prompt the free write answered
    if ("body" in patch && !next.prompt)
      next.prompt = promptFor(next.day, shift);
    draftRef.current = next;
    setDraft(next);
    dirty.current = true;
    if (status === "saved" || status === "error") setStatus("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  }

  // Save before the tab is hidden or closed, and warn if a save is still pending
  useEffect(() => {
    const hide = () => document.visibilityState === "hidden" && void flush();
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", leave);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", leave);
    };
  }, [flush]);

  async function open(next: string) {
    if (next === day || next > today || next < addDays(today, -366)) return;
    await flush();
    const d = draftOf(entriesRef.current[next], next);
    draftRef.current = d;
    setDraft(d);
    setDay(next);
    setShift(0);
    setStatus("idle");
    setError(null);
    setConfirmDelete(false);
    window.history.replaceState(
      null,
      "",
      next === today ? "/journal" : `/journal?day=${next}`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const prompt = draft.prompt ?? promptFor(day, shift);
  function newPrompt() {
    const p = promptFor(day, shift + 1);
    setShift((s) => s + 1);
    if (hasContent(draftRef.current)) edit({ prompt: p });
    else {
      draftRef.current = { ...draftRef.current, prompt: p };
      setDraft(draftRef.current);
    }
  }

  async function chooseMood(v: number) {
    if (day !== today) return;
    const before = moods[today];
    const mood = before?.mood === v ? null : v;
    setMoods((m) => ({
      ...m,
      [today]: { day: today, note: before?.note ?? null, mood },
    }));
    const res = await safe(updateToday({ mood }));
    if (!res.ok) {
      setMoods((m) => ({
        ...m,
        [today]: before ?? { day: today, mood: null, note: null },
      }));
      setToast({ text: res.error, tone: "error" });
    }
  }

  async function saveNote(note: string) {
    const before = moods[today];
    const clean = note.trim().slice(0, 280) || null;
    if ((before?.note ?? null) === clean) return;
    setMoods((m) => ({
      ...m,
      [today]: { day: today, mood: before?.mood ?? null, note: clean },
    }));
    const res = await safe(updateToday({ note: clean }));
    if (!res.ok) {
      setMoods((m) => ({
        ...m,
        [today]: before ?? { day: today, mood: null, note: null },
      }));
      setToast({ text: res.error, tone: "error" });
    }
  }

  async function toggleStar() {
    await flush();
    const e = entriesRef.current[day];
    if (!e)
      return setToast({
        text: "Write something first, then star it.",
        tone: "error",
      });
    setEntries((p) => ({ ...p, [day]: { ...e, starred: !e.starred } }));
    const res = await safe(setStar(day, !e.starred));
    if (!res.ok) {
      setEntries((p) => ({ ...p, [day]: e }));
      setToast({ text: res.error, tone: "error" });
    } else if (!e.starred)
      setToast({ text: "Starred. Find it again under Starred.", tone: "good" });
  }

  async function remove() {
    clearTimeout(timer.current);
    dirty.current = false;
    await inflight.current;
    const res = await safe(deleteEntry(day));
    setConfirmDelete(false);
    if (!res.ok) return setToast({ text: res.error, tone: "error" });
    setEntries((p) => {
      const n = { ...p };
      delete n[day];
      return n;
    });
    const d = draftOf(undefined, day);
    draftRef.current = d;
    setDraft(d);
    setStatus("idle");
    setToast({ text: "Entry deleted.", tone: "good" });
  }

  function exportAll() {
    const md = toMarkdown(
      Object.values(entriesRef.current),
      new Map(Object.entries(moods)),
    );
    const url = URL.createObjectURL(
      new Blob([md], { type: "text/markdown;charset=utf-8" }),
    );
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `lockin-journal-${today}.md`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Header numbers
  const written = useMemo(() => {
    const s = new Set(Object.keys(entries));
    for (const m of Object.values(moods)) if (m.note?.trim()) s.add(m.day);
    return s;
  }, [entries, moods]);
  const streak = writingStreak(written, today);
  const monthWords = Object.values(entries)
    .filter((e) => e.day.startsWith(today.slice(0, 7)))
    .reduce((n, e) => n + e.words, 0);
  const allTags = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of Object.values(entries))
      for (const t of e.tags) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [entries]);

  const saved = entries[day];
  const mood = moods[day];
  const words = entryWords(draft);
  const isToday = day === today;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Journal
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
            <Lock size={14} /> Private. Only you can read it, not even LockIn
            admins.
          </p>
        </div>
        <dl className="flex flex-wrap gap-2 text-sm">
          <Stat
            label="writing streak"
            value={`${streak} ${streak === 1 ? "day" : "days"}`}
            icon={
              <Flame
                size={15}
                className={streak ? "text-amber" : "text-muted"}
              />
            }
          />
          <Stat label="entries" value={String(Object.keys(entries).length)} />
          <Stat
            label="words this month"
            value={monthWords.toLocaleString("en-IN")}
          />
        </dl>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <section
          className="glass rounded-[32px] p-5 sm:p-8"
          aria-label="Journal entry"
        >
          {/* Day switcher and save state */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <IconButton
                label="Previous day"
                onClick={() => open(addDays(day, -1))}
                disabled={day <= addDays(today, -366)}
              >
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton
                label="Next day"
                onClick={() => open(addDays(day, 1))}
                disabled={isToday}
              >
                <ChevronRight size={18} />
              </IconButton>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold leading-tight sm:text-2xl">
                {fmtLong(day)}
              </h2>
              <p className="text-sm text-muted">
                {relative(day, today)}
                {!isToday && (
                  <>
                    {" "}
                    ·{" "}
                    <button
                      onClick={() => open(today)}
                      className="font-semibold text-rose hover:underline"
                    >
                      Back to today
                    </button>
                  </>
                )}
              </p>
            </div>
            <SaveState
              status={status}
              error={error}
              onRetry={() => void flush()}
            />
            <IconButton
              label={saved?.starred ? "Remove star" : "Star this entry"}
              onClick={toggleStar}
              pressed={!!saved?.starred}
            >
              <Star
                size={18}
                className={saved?.starred ? "fill-amber text-amber" : ""}
              />
            </IconButton>
            {saved && (
              <IconButton
                label="Delete this entry"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={17} />
              </IconButton>
            )}
          </div>

          <AnimatePresence>
            {confirmDelete && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-rose/30 bg-rose/10 p-4 text-sm">
                  <p className="flex-1 font-semibold">
                    Delete this entry? This can&apos;t be undone.
                  </p>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-xl px-4 py-2 font-semibold hover:bg-surface"
                  >
                    Keep it
                  </button>
                  <button
                    onClick={remove}
                    className="rounded-xl bg-rose px-4 py-2 font-semibold text-white"
                  >
                    Delete entry
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {/* Mood */}
              <div className="mt-7">
                <p className="text-sm font-semibold">How was the day?</p>
                <div className="mt-2 grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
                  {MOODS.map((m) => {
                    const on = mood?.mood === m.v;
                    return (
                      <button
                        key={m.v}
                        onClick={() => chooseMood(m.v)}
                        disabled={!isToday}
                        aria-pressed={on}
                        title={m.label}
                        className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm sm:px-3.5 font-semibold ring-1 transition enabled:hover:-translate-y-0.5 ${
                          on
                            ? "bg-surface-strong ring-2"
                            : "ring-line disabled:opacity-40"
                        }`}
                        style={
                          on ? { boxShadow: `0 0 0 2px ${m.color}` } : undefined
                        }
                      >
                        <span className="text-2xl leading-none">{m.emoji}</span>
                        <span className="hidden sm:inline">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                {!isToday && (
                  <p className="mt-2 text-xs text-muted">
                    {mood?.mood
                      ? "Mood logged that day."
                      : "No mood was logged that day."}{" "}
                    Moods are set on the day itself.
                  </p>
                )}
              </div>

              {/* The one line from the Today page */}
              {isToday ? (
                <NoteLine
                  key={`note-${day}`}
                  initial={mood?.note ?? ""}
                  onSave={saveNote}
                />
              ) : (
                mood?.note && (
                  <blockquote className="mt-6 rounded-2xl border-l-4 border-rose bg-rose/5 px-4 py-3 text-[15px]">
                    <span className="block text-xs font-semibold text-muted">
                      One line about the day
                    </span>
                    {mood.note}
                  </blockquote>
                )
              )}

              {/* Gratitude */}
              <div className="mt-7">
                <p className="text-sm font-semibold">Three good things 🌱</p>
                <p className="text-xs text-muted">
                  Small counts. A good chai counts.
                </p>
                <div className="mt-2.5 space-y-2">
                  {draft.gratitude.map((g, i) => (
                    <input
                      key={i}
                      value={g}
                      maxLength={200}
                      onChange={(e) =>
                        edit({
                          gratitude: draft.gratitude.map((x, j) =>
                            j === i ? e.target.value : x,
                          ),
                        })
                      }
                      onBlur={() => void flush()}
                      aria-label={`Good thing ${i + 1}`}
                      placeholder={
                        [
                          "Chai with an old friend",
                          "Fixed the bug I was stuck on",
                          "Walked in the evening breeze",
                        ][i]
                      }
                      className={`${FIELD} h-12`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Area
                  label="Today's win 🏆"
                  value={draft.win ?? ""}
                  max={500}
                  placeholder="What went right?"
                  onChange={(v) => edit({ win: v })}
                  onBlur={flush}
                />
                <Area
                  label="What I'd do differently 🔧"
                  value={draft.lesson ?? ""}
                  max={500}
                  placeholder="One thing to change, no guilt."
                  onChange={(v) => edit({ lesson: v })}
                  onBlur={flush}
                />
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-semibold">
                  {isToday
                    ? "Tomorrow I will… 🎯"
                    : "The next day I wanted to… 🎯"}
                </span>
                <input
                  value={draft.tomorrow ?? ""}
                  maxLength={300}
                  onChange={(e) => edit({ tomorrow: e.target.value })}
                  onBlur={() => void flush()}
                  placeholder="Start with the hardest task before lunch"
                  className={`${FIELD} mt-1.5 h-12`}
                />
              </label>

              {/* Free write */}
              <div className="mt-8 rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <p className="flex-1 font-display text-lg font-semibold leading-snug">
                    {prompt}
                  </p>
                  <button
                    onClick={newPrompt}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted ring-1 ring-line transition hover:text-ink"
                  >
                    <Shuffle size={15} /> New prompt
                  </button>
                </div>
                <AutoText
                  value={draft.body ?? ""}
                  onChange={(v) => edit({ body: v })}
                  onBlur={flush}
                  placeholder="Write freely. Nobody else will read this."
                />
              </div>

              {/* Tags and words */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Tags
                  tags={draft.tags}
                  suggestions={allTags}
                  onChange={(tags) => edit({ tags })}
                />
                <span className="ml-auto text-sm tabular-nums text-muted">
                  {words} {words === 1 ? "word" : "words"}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        <JournalSide
          today={today}
          day={day}
          entries={entries}
          moods={moods}
          tags={allTags}
          onOpen={open}
          onExport={exportAll}
        />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className={`fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-surface-strong px-5 py-3 text-sm font-semibold shadow-2xl ring-1 md:bottom-6 ${toast.tone === "error" ? "text-rose ring-rose/30" : "ring-mint/40"}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ---------- small pieces ---------- */

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 ring-1 ring-line">
      {icon}
      <dd className="font-display font-bold tabular-nums">{value}</dd>
      <dt className="text-muted">{label}</dt>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="grid h-10 w-10 place-items-center rounded-xl text-muted ring-1 ring-line transition hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SaveState({
  status,
  error,
  onRetry,
}: {
  status: Status;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "saving")
    return (
      <span
        className="flex items-center gap-1.5 text-sm text-muted"
        role="status"
      >
        <Loader2 size={14} className="animate-spin" /> Saving
      </span>
    );
  if (status === "saved")
    return (
      <span
        className="flex items-center gap-1.5 text-sm text-mint"
        role="status"
      >
        <Check size={15} /> Saved
      </span>
    );
  if (status === "error")
    return (
      <button
        onClick={onRetry}
        title={error ?? undefined}
        className="flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-semibold text-rose hover:bg-rose/10"
      >
        <CloudOff size={15} /> Not saved. Retry
      </button>
    );
  return null;
}

function Area({
  label,
  value,
  max,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  max: number;
  placeholder: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-semibold">{label}</span>
      <textarea
        value={value}
        maxLength={max}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`${FIELD} mt-1.5 resize-none py-3`}
      />
    </label>
  );
}

/** A textarea that grows with what you write. */
function AutoText({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(220, el.scrollHeight)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      maxLength={20000}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label="Free write"
      className="mt-3 block min-h-[220px] w-full resize-none bg-transparent text-[17px] leading-8 outline-none placeholder:text-muted/60"
    />
  );
}

function NoteLine({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <label className="mt-6 block">
      <span className="text-sm font-semibold">One line about today</span>
      <span className="block text-xs text-muted">
        The same line as on your Today page.
      </span>
      <input
        value={v}
        maxLength={280}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(v)}
        onKeyDown={(e) =>
          e.key === "Enter" && (e.target as HTMLInputElement).blur()
        }
        placeholder="Finished chapter 4 and finally understood recursion."
        className={`${FIELD} mt-1.5 h-12`}
      />
    </label>
  );
}

function Tags({
  tags,
  suggestions,
  onChange,
}: {
  tags: string[];
  suggestions: string[];
  onChange: (t: string[]) => void;
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = cleanTag(raw);
    if (t && !tags.includes(t) && tags.length < 8) onChange([...tags, t]);
    setText("");
  };
  const offer = suggestions
    .filter((s) => !tags.includes(s) && (!text || s.startsWith(cleanTag(text))))
    .slice(0, 4);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 rounded-full bg-rose/15 py-1 pl-3 pr-1.5 text-sm font-semibold text-rose"
        >
          #{t}
          <button
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove tag ${t}`}
            className="grid h-5 w-5 place-items-center rounded-full hover:bg-rose/20"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {tags.length < 8 && (
        <input
          value={text}
          onChange={(e) =>
            e.target.value.endsWith(",")
              ? add(e.target.value.slice(0, -1))
              : setText(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && tags.length)
              onChange(tags.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          placeholder={tags.length ? "Add tag" : "Add a tag, like #exam"}
          aria-label="Add a tag"
          className="h-8 w-36 rounded-full bg-transparent px-3 text-sm outline-none ring-1 ring-line placeholder:text-muted/60 focus:ring-rose"
        />
      )}
      {offer.map((s) => (
        <button
          key={s}
          onClick={() => add(s)}
          className="rounded-full px-2.5 py-1 text-sm text-muted border border-dashed border-line hover:text-ink"
        >
          +#{s}
        </button>
      ))}
    </div>
  );
}
