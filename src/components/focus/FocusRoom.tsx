"use client";

import { safe } from "@/lib/net";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Coffee,
  Droplets,
  Eye,
  Maximize,
  Minimize,
  Pause,
  Play,
  Square,
  Trash2,
  Volume2,
  Zap,
} from "lucide-react";
import { getAudio, sounds } from "@/lib/sounds";
import {
  AMBIENTS,
  playAmbient,
  type AmbientKind,
  type AmbientPlayer,
} from "@/lib/ambient";
import { formatMinutes } from "@/lib/day";
import {
  addWaterGlass,
  deleteFocusSession,
  saveFocusSession,
  type FocusSession,
} from "@/app/focus/actions";

const PRESETS = [
  {
    id: "pomodoro",
    name: "Pomodoro",
    focus: 25,
    brk: 5,
    text: "25 min focus, 5 min break",
  },
  {
    id: "deep",
    name: "Deep work",
    focus: 50,
    brk: 10,
    text: "50 min focus, 10 min break",
  },
  {
    id: "marathon",
    name: "Long haul",
    focus: 90,
    brk: 15,
    text: "90 min focus, 15 min break",
  },
  {
    id: "custom",
    name: "Custom",
    focus: 40,
    brk: 8,
    text: "Pick your own times",
  },
];

const BREAK_TIPS = [
  { icon: Droplets, text: "Drink a glass of water" },
  { icon: Eye, text: "Look at something far away for 20 seconds" },
  { icon: Zap, text: "Stand up and stretch your back and neck" },
  { icon: Coffee, text: "Step away from the screen. No phone scrolling." },
];

type Phase = "focus" | "break";
type Active = {
  phase: Phase;
  label: string;
  focusMin: number;
  breakMin: number;
  ambient: AmbientKind;
  startedAt: number; // when this phase started (wall clock)
  endAt: number | null; // set while running
  leftMs: number | null; // set while paused
  distractions: number;
  round: number;
};
type Done = {
  minutes: number;
  completed: boolean;
  label: string;
  round: number;
  breakMin: number;
  focusMin: number;
  ambient: AmbientKind;
  afterBreak?: boolean;
};

const STORE = "lockin-focus";
const load = (): Active | null => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null");
  } catch {
    return null;
  }
};
const store = (a: Active | null) => {
  try {
    if (a) localStorage.setItem(STORE, JSON.stringify(a));
    else localStorage.removeItem(STORE);
  } catch {}
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const timeOf = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));

export default function FocusRoom({
  initialSessions,
  initialFocusMinutes,
  goalMinutes,
  suggestions,
  soundOn,
  timezone,
  startLabel,
  startMinutes,
}: {
  initialSessions: FocusSession[];
  initialFocusMinutes: number;
  goalMinutes: number;
  suggestions: string[];
  soundOn: boolean;
  timezone: string;
  startLabel?: string; // from a timetable block's "Lock in for this"
  startMinutes?: number;
}) {
  // setup
  const matchesPreset = PRESETS.find(
    (p) => p.id !== "custom" && p.focus === startMinutes,
  );
  const [presetId, setPresetId] = useState(
    startMinutes ? (matchesPreset?.id ?? "custom") : "pomodoro",
  );
  const [customFocus, setCustomFocus] = useState(
    startMinutes && !matchesPreset ? startMinutes : 40,
  );
  const [customBreak, setCustomBreak] = useState(8);
  const [label, setLabel] = useState(startLabel ?? suggestions[0] ?? "");
  const [ambient, setAmbient] = useState<AmbientKind>("rain");
  const [volume, setVolume] = useState(0.5);

  // session
  const [active, setActive] = useState<Active | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [now, setNow] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    text: string;
    tone: "good" | "error";
  } | null>(null);
  const [full, setFull] = useState(false);
  const [tip, setTip] = useState(0);
  const [soundBlocked, setSoundBlocked] = useState(false); // browsers mute pages until you tap after a reload

  // today
  const [sessions, setSessions] = useState(initialSessions);
  const [focusToday, setFocusToday] = useState(initialFocusMinutes);

  const player = useRef<AmbientPlayer | null>(null);
  const room = useRef<HTMLDivElement>(null);
  const finishing = useRef(false);

  const preset = PRESETS.find((p) => p.id === presetId)!;
  const planFocus = presetId === "custom" ? customFocus : preset.focus;
  const planBreak = presetId === "custom" ? customBreak : preset.brk;

  const update = (a: Active | null) => {
    setActive(a);
    store(a);
  };

  const flash = (text: string, tone: "good" | "error" = "good") =>
    setToast({ text, tone });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- ambient sound follows the timer ---------- */
  const running = Boolean(active?.endAt);
  const wantAmbient =
    running && active?.phase === "focus" ? active.ambient : "none";
  useEffect(() => {
    player.current?.stop();
    player.current =
      wantAmbient === "none" ? null : playAmbient(wantAmbient, volume);
    return () => {
      player.current?.stop();
      player.current = null;
    };
    // volume changes are applied separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAmbient]);
  useEffect(() => player.current?.setVolume(volume), [volume]);

  /* ---------- save a focus session ---------- */
  const finishFocus = useCallback(
    async (a: Active, completed: boolean, leftMs: number) => {
      if (finishing.current) return;
      finishing.current = true;
      const minutes = completed
        ? a.focusMin
        : Math.floor((a.focusMin * 60000 - leftMs) / 60000);
      update(null);
      if (completed && soundOn) sounds.break();

      if (minutes < 1) {
        finishing.current = false;
        flash("Session ended. Under a minute isn't saved.");
        return;
      }
      setSaving(true);
      const res = await safe(
        saveFocusSession({
          label: a.label,
          plannedMinutes: a.focusMin,
          actualMinutes: minutes,
          startedAt: new Date(a.startedAt).toISOString(),
          completed,
          distractions: a.distractions,
          ambient: a.ambient,
        }),
      );
      setSaving(false);
      finishing.current = false;
      if (!res.ok) {
        flash(res.error, "error");
        return;
      }
      setSessions((s) => [res.session, ...s]);
      setFocusToday(res.log.focus_minutes);
      setDone({
        minutes,
        completed,
        label: a.label,
        round: a.round,
        breakMin: a.breakMin,
        focusMin: a.focusMin,
        ambient: a.ambient,
      });
    },

    [soundOn],
  );

  /* ---------- restore a timer after a reload ---------- */
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = load();
      if (!saved) return;
      if (saved.endAt && saved.endAt <= Date.now()) {
        if (saved.phase === "focus") void finishFocus(saved, true, 0);
        else store(null);
        return;
      }
      setActive(saved);
      setNow(Date.now());
      if (saved.phase === "focus" && saved.ambient !== "none" && saved.endAt)
        setSoundBlocked(true);
    }, 0);
    return () => clearTimeout(t);
  }, [finishFocus]);

  /* ---------- tick: count down, and act when a phase ends ---------- */
  const onPhaseEnd = useCallback(
    (a: Active) => {
      if (a.phase === "focus") {
        void finishFocus(a, true, 0);
        return;
      }
      update(null);
      if (soundOn) sounds.stretch();
      setDone((d) => (d ? { ...d, afterBreak: true } : null));
    },

    [finishFocus, soundOn],
  );

  useEffect(() => {
    const endAt = active?.endAt;
    if (!active || !endAt) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) {
        clearInterval(id);
        onPhaseEnd(active);
      }
    }, 250);
    return () => clearInterval(id);
  }, [active, onPhaseEnd]);

  const left = active
    ? active.endAt
      ? active.endAt - now
      : (active.leftMs ?? 0)
    : 0;
  const total = active
    ? (active.phase === "focus" ? active.focusMin : active.breakMin) * 60000
    : 1;

  // tab title shows the countdown
  useEffect(() => {
    const base = "Lock In mode | LockIn";
    document.title = active
      ? `${mmss(left)} ${active.phase === "focus" ? "focus" : "break"} | LockIn`
      : base;
    return () => {
      document.title = base;
    };
  }, [active, left]);

  // keep the screen awake while a timer runs
  useEffect(() => {
    if (!running) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
    };
  }, [running]);

  // rotate break tips
  useEffect(() => {
    if (active?.phase !== "break") return;
    const id = setInterval(
      () => setTip((t) => (t + 1) % BREAK_TIPS.length),
      8000,
    );
    return () => clearInterval(id);
  }, [active?.phase]);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ---------- controls ---------- */
  function start(
    round = 1,
    opts?: Partial<Pick<Active, "label" | "focusMin" | "breakMin" | "ambient">>,
  ) {
    const focusMin = opts?.focusMin ?? planFocus;
    setDone(null);
    if (soundOn) sounds.lock();
    update({
      phase: "focus",
      label: (opts?.label ?? label).trim(),
      focusMin,
      breakMin: opts?.breakMin ?? planBreak,
      ambient: opts?.ambient ?? ambient,
      startedAt: Date.now(),
      endAt: Date.now() + focusMin * 60000,
      leftMs: null,
      distractions: 0,
      round,
    });
    setNow(Date.now());
  }

  function startBreak(d: Done) {
    const long = d.round % 4 === 0;
    const mins = long ? d.breakMin * 3 : d.breakMin;
    setDone({ ...d });
    update({
      phase: "break",
      label: d.label,
      focusMin: d.focusMin,
      breakMin: mins,
      ambient: d.ambient,
      startedAt: Date.now(),
      endAt: Date.now() + mins * 60000,
      leftMs: null,
      distractions: 0,
      round: d.round,
    });
    setNow(Date.now());
  }

  function togglePause() {
    if (!active) return;
    if (active.endAt)
      update({ ...active, leftMs: active.endAt - Date.now(), endAt: null });
    else
      update({
        ...active,
        endAt: Date.now() + (active.leftMs ?? 0),
        leftMs: null,
      });
    setNow(Date.now());
  }

  function endBreak() {
    update(null);
    setDone((d) => (d ? { ...d, afterBreak: true } : null));
  }

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await room.current?.requestFullscreen();
    } catch {}
  }

  // keyboard: space = pause, F = full screen
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      }
      if (e.key.toLowerCase() === "f") void toggleFull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function remove(id: string) {
    const res = await safe(deleteFocusSession(id));
    if (!res.ok) return flash(res.error, "error");
    setSessions((s) => s.filter((x) => x.id !== id));
    setFocusToday(res.log.focus_minutes);
    flash("Session removed.");
  }

  async function logWater() {
    if (soundOn) sounds.water();
    const res = await safe(addWaterGlass());
    flash(
      res.ok ? `Water logged: ${res.log.water} glasses today 💧` : res.error,
      res.ok ? "good" : "error",
    );
  }

  const progress = Math.min(1, focusToday / goalMinutes);
  const R = 150;
  const C = 2 * Math.PI * R;
  const frac = active ? Math.max(0, Math.min(1, 1 - left / total)) : 0;
  const isBreak = active?.phase === "break";
  const accent = isBreak ? "var(--mint)" : "var(--violet)";
  const Tip = BREAK_TIPS[tip];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
      {/* ---------- Setup ---------- */}
      <section className="glass rounded-[36px] p-6 sm:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Lock In mode
            </h1>
            <p className="mt-2 max-w-lg text-muted">
              Pick a rhythm, name what you&apos;re working on, and let the timer
              guard your focus.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Focus today</span>
              <span className="font-semibold tabular-nums">
                {formatMinutes(focusToday)} / {formatMinutes(goalMinutes)}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full rounded-full bg-violet"
                initial={false}
                animate={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        <h2 className="mt-9 font-semibold">Rhythm</h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => {
            const on = p.id === presetId;
            return (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                aria-pressed={on}
                className={`rounded-3xl p-4 text-left transition ${on ? "bg-violet/15 ring-2 ring-violet" : "bg-surface ring-1 ring-line hover:ring-violet/40"}`}
              >
                <span className="block font-display text-2xl font-bold tabular-nums">
                  {p.id === "custom"
                    ? `${customFocus}/${customBreak}`
                    : `${p.focus}/${p.brk}`}
                </span>
                <span className="mt-1 block font-semibold">{p.name}</span>
                <span className="block text-sm text-muted">{p.text}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {presetId === "custom" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["Focus", customFocus, setCustomFocus, 5, 180, 5],
                    ["Break", customBreak, setCustomBreak, 1, 30, 1],
                  ] as const
                ).map(([name, v, set, min, max, step]) => (
                  <label
                    key={name}
                    className="rounded-2xl bg-surface p-4 ring-1 ring-line"
                  >
                    <span className="flex justify-between text-sm">
                      <span className="font-semibold">{name}</span>
                      <span className="tabular-nums text-muted">{v} min</span>
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={v}
                      onChange={(e) => set(Number(e.target.value))}
                      className="mt-3 w-full accent-[var(--violet)]"
                    />
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <h2 className="mt-8 font-semibold">What are you working on?</h2>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          placeholder="e.g. Chapter 5 practice questions"
          aria-label="What are you working on?"
          className="mt-3 h-13 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/20"
        />
        {suggestions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setLabel(s)}
                className="rounded-full bg-surface-strong px-3.5 py-1.5 text-sm font-semibold ring-1 ring-line transition hover:ring-violet/50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <h2 className="mt-8 font-semibold">Background sound</h2>
        <AmbientPicker
          value={ambient}
          onChange={setAmbient}
          volume={volume}
          onVolume={setVolume}
        />

        <button
          onClick={() => start()}
          disabled={saving}
          className="mt-9 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet to-cyan font-display text-lg font-bold text-white shadow-xl shadow-violet/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          <Play size={20} fill="currentColor" /> Lock in for {planFocus} minutes
        </button>
        <p className="mt-3 text-center text-sm text-muted">
          Space pauses, F goes full screen. You can leave this tab: the timer
          keeps going.
        </p>
      </section>

      {/* ---------- Today's sessions ---------- */}
      <section className="mt-4 rounded-[28px] border border-line p-6">
        <h2 className="font-display text-lg font-bold">
          Today&apos;s sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-muted">
            No sessions yet. Your first one is the hardest. Start small.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-4 py-3">
                <span className="w-12 shrink-0 text-sm tabular-nums text-muted">
                  {timeOf(s.started_at, timezone)}
                </span>
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${s.completed ? "bg-mint/15 text-mint" : "bg-amber/15 text-amber"}`}
                >
                  {s.completed ? <Check size={16} /> : <Square size={12} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {s.label || "Focus session"}
                  </span>
                  <span className="block text-sm text-muted">
                    {s.completed
                      ? "Full session"
                      : `Ended early of ${s.planned_minutes}m`}
                    {s.distractions > 0
                      ? `, ${s.distractions} distraction${s.distractions > 1 ? "s" : ""}`
                      : ""}
                  </span>
                </span>
                <span className="font-display font-bold tabular-nums">
                  {formatMinutes(s.actual_minutes)}
                </span>
                <button
                  onClick={() => remove(s.id)}
                  aria-label="Remove this session"
                  className="grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-rose/10 hover:text-rose"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/today"
          className="mt-4 inline-block text-sm font-semibold text-violet hover:underline"
        >
          See your full day
        </Link>
      </section>

      {/* ---------- Full-screen room ---------- */}
      <AnimatePresence>
        {(active || done) && (
          <motion.div
            ref={room}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sky fixed inset-0 z-50 flex flex-col overflow-y-auto"
            style={{ backgroundColor: "var(--bg)" }}
            role="dialog"
            aria-label={isBreak ? "Break" : "Focus session"}
          >
            <div className="flex items-center justify-between p-4 sm:p-6">
              <span className="rounded-full bg-surface-strong px-4 py-2 text-sm font-semibold ring-1 ring-line">
                {done && !active
                  ? "Session done"
                  : isBreak
                    ? "Break"
                    : `Round ${active?.round ?? 1}`}
              </span>
              <button
                onClick={toggleFull}
                aria-label={full ? "Exit full screen" : "Full screen"}
                className="grid h-11 w-11 place-items-center rounded-full bg-surface-strong ring-1 ring-line"
              >
                {full ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10">
              {active ? (
                <>
                  <p className="mb-6 max-w-md text-center text-lg text-muted">
                    {isBreak
                      ? "Rest. You earned it."
                      : active.label || "Deep focus"}
                  </p>
                  <div className="relative grid place-items-center">
                    <div
                      className="animate-breathe absolute inset-10 rounded-full blur-3xl"
                      style={{
                        background: isBreak
                          ? "rgb(79 227 164 / 0.25)"
                          : "var(--glow)",
                      }}
                    />
                    <svg
                      viewBox="0 0 340 340"
                      className="relative h-[min(78vw,340px)] w-[min(78vw,340px)] -rotate-90"
                    >
                      <circle
                        cx="170"
                        cy="170"
                        r={R}
                        fill="none"
                        stroke="var(--line)"
                        strokeWidth="14"
                      />
                      <circle
                        cx="170"
                        cy="170"
                        r={R}
                        fill="none"
                        stroke={accent}
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeDasharray={`${C * frac} ${C}`}
                        style={{
                          transition: "stroke-dasharray 0.3s linear",
                          filter: `drop-shadow(0 0 10px ${accent})`,
                        }}
                      />
                    </svg>
                    <div className="absolute text-center">
                      <p
                        className="font-display text-6xl font-extrabold tabular-nums sm:text-7xl"
                        aria-live="off"
                      >
                        {mmss(left)}
                      </p>
                      <p className="mt-1 text-muted">
                        {active.endAt
                          ? isBreak
                            ? "of break left"
                            : "left"
                          : "Paused"}
                      </p>
                    </div>
                  </div>

                  {isBreak ? (
                    <div className="mt-8 w-full max-w-md">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={tip}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="flex items-center justify-center gap-2.5 text-center text-lg font-semibold"
                        >
                          <Tip.icon size={20} className="text-mint" />{" "}
                          {Tip.text}
                        </motion.p>
                      </AnimatePresence>
                      <div className="mt-6 flex gap-2">
                        <button
                          onClick={logWater}
                          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-water font-semibold text-white"
                        >
                          <Droplets size={18} /> Log a glass
                        </button>
                        <button
                          onClick={endBreak}
                          className="h-12 flex-1 rounded-2xl bg-surface-strong font-semibold ring-1 ring-line"
                        >
                          Skip break
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-8 flex items-center gap-3">
                        <button
                          onClick={togglePause}
                          aria-label={active.endAt ? "Pause" : "Resume"}
                          className="grid h-16 w-16 place-items-center rounded-full bg-ink text-bg transition hover:scale-105"
                        >
                          {active.endAt ? (
                            <Pause size={24} fill="currentColor" />
                          ) : (
                            <Play size={24} fill="currentColor" />
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmEnd(true)}
                          aria-label="End session"
                          className="grid h-12 w-12 place-items-center rounded-full bg-surface-strong ring-1 ring-line transition hover:text-rose"
                        >
                          <Square size={18} />
                        </button>
                      </div>
                      {soundBlocked && active.ambient !== "none" && (
                        <button
                          onClick={() => {
                            void getAudio()?.resume();
                            setSoundBlocked(false);
                          }}
                          className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan px-5 py-2.5 text-sm font-semibold text-bg"
                        >
                          <Volume2 size={16} /> Tap to turn the sound back on
                        </button>
                      )}
                      <button
                        onClick={() =>
                          update({
                            ...active,
                            distractions: active.distractions + 1,
                          })
                        }
                        className="mt-6 rounded-full bg-surface px-5 py-2.5 text-sm font-semibold ring-1 ring-line transition hover:ring-amber/60"
                      >
                        I got distracted{" "}
                        {active.distractions > 0 && (
                          <span className="ml-1 rounded-full bg-amber/20 px-2 py-0.5 text-amber">
                            {active.distractions}
                          </span>
                        )}
                      </button>
                      <div className="mt-8 w-full max-w-xl">
                        <AmbientPicker
                          value={active.ambient}
                          onChange={(k) => update({ ...active, ambient: k })}
                          volume={volume}
                          onVolume={setVolume}
                          compact
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                done && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-md text-center"
                  >
                    <motion.div
                      initial={{ rotate: -20, scale: 0.5 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 12,
                      }}
                      className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br from-violet to-cyan text-5xl shadow-xl shadow-violet/30"
                    >
                      {done.afterBreak ? "⚡" : done.completed ? "🔥" : "👍"}
                    </motion.div>
                    <h2 className="mt-6 font-display text-3xl font-bold">
                      {done.afterBreak
                        ? "Break's over"
                        : done.completed
                          ? "Session complete!"
                          : "Session saved"}
                    </h2>
                    <p className="mt-2 text-muted">
                      {done.afterBreak ? (
                        `Feeling fresh? Today so far: ${formatMinutes(focusToday)} of ${formatMinutes(goalMinutes)}.`
                      ) : (
                        <>
                          +{formatMinutes(done.minutes)} focus
                          {done.label ? ` on ${done.label}` : ""}. Today:{" "}
                          {formatMinutes(focusToday)} of{" "}
                          {formatMinutes(goalMinutes)}.
                        </>
                      )}
                    </p>
                    <div className="mt-8 flex flex-col gap-2">
                      {done.breakMin > 0 && !done.afterBreak && (
                        <button
                          onClick={() => startBreak(done)}
                          className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-mint py-3.5 font-semibold text-bg"
                        >
                          <Coffee size={18} /> Take a{" "}
                          {done.round % 4 === 0
                            ? done.breakMin * 3
                            : done.breakMin}{" "}
                          min {done.round % 4 === 0 ? "long " : ""}break
                        </button>
                      )}
                      <button
                        onClick={() =>
                          start(done.round + 1, {
                            label: done.label,
                            focusMin: done.focusMin,
                            breakMin: done.breakMin,
                            ambient: done.ambient,
                          })
                        }
                        className="h-13 rounded-2xl bg-surface-strong py-3.5 font-semibold ring-1 ring-line"
                      >
                        Start round {done.round + 1} now
                      </button>
                      <button
                        onClick={() => setDone(null)}
                        className="py-3 text-sm font-semibold text-muted hover:text-ink"
                      >
                        I&apos;m done for now
                      </button>
                    </div>
                  </motion.div>
                )
              )}
            </div>

            {/* end-early dialog */}
            <AnimatePresence>
              {confirmEnd && active && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-10 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    className="w-full max-w-sm rounded-[28px] bg-surface-strong p-6 ring-1 ring-line"
                  >
                    {(() => {
                      const doneMin = Math.floor(
                        (active.focusMin * 60000 - left) / 60000,
                      );
                      return (
                        <>
                          <h3 className="font-display text-xl font-bold">
                            End this session?
                          </h3>
                          <p className="mt-2 text-muted">
                            You&apos;ve focused for{" "}
                            {formatMinutes(Math.max(0, doneMin))}.
                            {doneMin < 1
                              ? " Sessions under a minute aren't saved."
                              : " It still counts toward today."}
                          </p>
                          <div className="mt-6 flex flex-col gap-2">
                            <button
                              onClick={() => setConfirmEnd(false)}
                              className="h-12 rounded-2xl bg-ink font-semibold text-bg"
                            >
                              Keep going
                            </button>
                            <button
                              onClick={() => {
                                setConfirmEnd(false);
                                void finishFocus(active, false, left);
                              }}
                              className="h-12 rounded-2xl bg-surface font-semibold ring-1 ring-line"
                            >
                              {doneMin >= 1
                                ? `End and save ${formatMinutes(doneMin)}`
                                : "End session"}
                            </button>
                            {doneMin >= 1 && (
                              <button
                                onClick={() => {
                                  setConfirmEnd(false);
                                  update(null);
                                  flash("Session discarded.");
                                }}
                                className="h-11 text-sm font-semibold text-rose"
                              >
                                Discard without saving
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <Toast toast={toast} />
          </motion.div>
        )}
      </AnimatePresence>

      {!active && !done && <Toast toast={toast} />}
    </div>
  );
}

function AmbientPicker({
  value,
  onChange,
  volume,
  onVolume,
  compact,
}: {
  value: AmbientKind;
  onChange: (k: AmbientKind) => void;
  volume: number;
  onVolume: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "mt-3"}>
      <div
        className={`grid gap-2 ${compact ? "grid-cols-6" : "grid-cols-3 sm:grid-cols-6"}`}
      >
        {AMBIENTS.map((a) => {
          const on = a.id === value;
          return (
            <button
              key={a.id}
              onClick={() => onChange(a.id)}
              aria-pressed={on}
              aria-label={a.label}
              title={a.label}
              className={`flex flex-col items-center gap-1 rounded-2xl py-3 transition ${on ? "bg-cyan/15 ring-2 ring-cyan" : "bg-surface ring-1 ring-line hover:ring-cyan/40"}`}
            >
              <span className="text-2xl">{a.emoji}</span>
              {!compact && (
                <span className="text-xs font-semibold text-muted">
                  {a.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {value !== "none" && (
        <label className="mt-3 flex items-center gap-3 text-sm text-muted">
          <Volume2 size={18} />
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="flex-1 accent-[var(--cyan)]"
          />
        </label>
      )}
      {!compact && (
        <p className="mt-2 text-sm text-muted">
          Sounds play while the timer runs. Headphones recommended.
        </p>
      )}
    </div>
  );
}

function Toast({
  toast,
}: {
  toast: { text: string; tone: "good" | "error" } | null;
}) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className={`fixed bottom-24 md:bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-surface-strong px-5 py-3 text-sm font-semibold shadow-2xl ring-1 ${toast.tone === "error" ? "text-rose ring-rose/30" : "ring-mint/40"}`}
        >
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
