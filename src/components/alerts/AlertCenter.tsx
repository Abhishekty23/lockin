"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Clock, X } from "lucide-react";
import { sounds } from "@/lib/sounds";
import { dayIn } from "@/lib/day";
import { ALERTS, DEFAULT_PREFS, ahead, isAwake, minutesNow, toMinutes, type AlertKind, type AlertPrefs, type RepeatingKind } from "@/lib/alerts";
import { alertContext, logAlert, waterFromAlert } from "@/app/alerts/actions";
import { BreathingOverlay, EyeRestOverlay } from "./Overlays";

export type AlertSetup = {
  reminders: { water: boolean; breaks: boolean; eyes: boolean; stretch: boolean; sleep: boolean };
  prefs: AlertPrefs;
  wake: string;
  sleep: string;
  timezone: string;
  soundOn: boolean;
};

type Memory = {
  last: Partial<Record<AlertKind, number>>; // when each repeating alert last fired
  snooze: Partial<Record<AlertKind, number>>; // don't fire before this time
  once: Partial<Record<AlertKind, string>>; // day a once-a-day alert already fired
};

const KEY = "lockin-alerts";
const REPEATING: RepeatingKind[] = ["water", "breaks", "eyes", "stretch"];
const SNOOZE_MIN = 10;

const read = (): Memory => {
  try {
    return { last: {}, snooze: {}, once: {}, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { last: {}, snooze: {}, once: {} };
  }
};
const write = (m: Memory) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
};

// A Lock In session is running in some tab: hold most alerts until it ends.
const focusRunning = () => {
  try {
    const f = JSON.parse(localStorage.getItem("lockin-focus") ?? "null");
    return Boolean(f && f.phase === "focus" && f.endAt && f.endAt > Date.now());
  } catch {
    return false;
  }
};

/** Watches the clock on every signed-in page and shows reminders when they're due. */
export default function AlertCenter({ setup }: { setup: AlertSetup }) {
  const router = useRouter();
  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...setup.prefs }), [setup.prefs]);
  const [current, setCurrent] = useState<AlertKind | null>(null);
  const [overlay, setOverlay] = useState<"breathe" | "eyes" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const showing = useRef<AlertKind | null>(null);

  const show = useCallback(
    (kind: AlertKind) => {
      if (showing.current) return;
      showing.current = kind;
      setResult(null);
      setCurrent(kind);
      const def = ALERTS[kind];
      if (setup.soundOn) sounds[def.sound]();
      void logAlert(kind, "shown");
      // System notification when LockIn is in a background tab
      if (prefs.desktop && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const n = new Notification(`${def.emoji} ${def.title}`, { body: def.body, tag: `lockin-${kind}` });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {}
      }
    },
    [setup.soundOn, prefs.desktop],
  );

  /* ---------- the clock ---------- */
  useEffect(() => {
    const wake = toMinutes(setup.wake);
    const bed = toMinutes(setup.sleep);

    async function tick() {
      if (showing.current) return;
      const now = Date.now();
      const nowMin = minutesNow(setup.timezone);
      const today = dayIn(setup.timezone);
      const awake = isAwake(nowMin, wake, bed);
      const nearBed = ahead(nowMin, bed) <= 30;
      const m = read();
      const free = (k: AlertKind) => (m.snooze[k] ?? 0) <= now;

      // Bedtime wind-down: once, in the 30 minutes before bed
      if (setup.reminders.sleep && nearBed && m.once.sleep !== today && free("sleep")) {
        m.once.sleep = today;
        write(m);
        return show("sleep");
      }

      if (!awake || focusRunning()) return;

      // Morning check-in: 15 minutes to 3 hours after waking, if sleep isn't logged
      const sinceWake = ahead(wake, nowMin);
      if (prefs.morning && sinceWake >= 15 && sinceWake <= 180 && m.once.morning !== today && free("morning")) {
        m.once.morning = today;
        write(m);
        const ctx = await alertContext();
        if (ctx && !ctx.sleepLogged) return show("morning");
      }

      // Evening streak saver: after 9 pm, once, if the ring is under 50
      if (prefs.evening && nowMin >= 21 * 60 && !nearBed && m.once.evening !== today && free("evening")) {
        m.once.evening = today;
        write(m);
        const ctx = await alertContext();
        if (ctx && ctx.score < 50) return show("evening");
      }

      if (nearBed) return;

      for (const kind of REPEATING) {
        if (!setup.reminders[kind]) continue;
        const last = m.last[kind];
        if (!last) {
          m.last[kind] = now; // start counting from the first visit
          write(m);
          continue;
        }
        if (now - last < prefs[kind] * 60000 || !free(kind)) continue;
        // Another tab may have just fired it
        const fresh = read();
        if ((fresh.last[kind] ?? 0) > last) continue;
        fresh.last[kind] = now;
        write(fresh);
        if (kind === "water") {
          const ctx = await alertContext();
          if (ctx && ctx.water >= ctx.waterGoal) continue; // goal already hit: stay quiet
        }
        return show(kind);
      }
    }

    void tick();
    const id = setInterval(() => void tick(), 20000);
    return () => clearInterval(id);
  }, [setup, prefs, show]);

  /* ---------- test hook (Settings page "Test" buttons) ---------- */
  useEffect(() => {
    const onTest = (e: Event) => {
      const kind = (e as CustomEvent<AlertKind>).detail;
      if (ALERTS[kind]) {
        showing.current = null;
        show(kind);
      }
    };
    window.addEventListener("lockin:test-alert", onTest);
    return () => window.removeEventListener("lockin:test-alert", onTest);
  }, [show]);

  function close() {
    showing.current = null;
    setCurrent(null);
    setResult(null);
  }

  async function act(kind: AlertKind) {
    if (kind === "water") {
      const res = await waterFromAlert();
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("lockin:water", { detail: res.water }));
        setResult(`Logged. ${res.water} glasses today 💧`);
        setTimeout(close, 1400);
      } else setResult("Couldn't save. Try again.");
      return;
    }
    if (kind === "breaks") {
      setOverlay("breathe");
      close();
      return;
    }
    if (kind === "eyes") {
      setOverlay("eyes");
      close();
      return;
    }
    void logAlert(kind, "done");
    if (kind === "morning") router.push("/today");
    if (kind === "evening") router.push("/focus");
    if (setup.soundOn) sounds.done();
    close();
  }

  function snooze(kind: AlertKind) {
    const m = read();
    m.snooze[kind] = Date.now() + SNOOZE_MIN * 60000;
    if (kind === "sleep" || kind === "morning" || kind === "evening") delete m.once[kind];
    write(m);
    void logAlert(kind, "snoozed");
    close();
  }

  function skip(kind: AlertKind) {
    void logAlert(kind, "skipped");
    close();
  }

  const def = current ? ALERTS[current] : null;

  return (
    <>
      <AnimatePresence>
        {def && current && (
          <motion.div
            key={current}
            role="alertdialog"
            aria-label={def.title}
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed left-3 right-3 top-20 z-[70] mx-auto max-w-sm overflow-hidden rounded-[28px] bg-surface-strong shadow-2xl ring-1 ring-line sm:left-auto sm:right-5 sm:mx-0"
          >
            <div className="h-1 w-full" style={{ background: def.color }} />
            <div className="p-5">
              <div className="flex items-start gap-4">
                <AlertIcon kind={current} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold leading-tight">{def.title}</p>
                  <p className="mt-1 text-sm text-muted">{result ?? def.body}</p>
                </div>
                <button onClick={() => skip(current)} aria-label="Dismiss" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:text-ink">
                  <X size={18} />
                </button>
              </div>
              {!result && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => act(current)}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold text-white transition hover:brightness-110"
                    style={{ background: def.color }}
                  >
                    <Check size={16} /> {def.action}
                  </button>
                  <button onClick={() => snooze(current)} className="flex h-11 items-center gap-1.5 rounded-2xl bg-surface px-4 text-sm font-semibold ring-1 ring-line">
                    <Clock size={15} /> {SNOOZE_MIN}m
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {overlay === "breathe" && (
          <BreathingOverlay
            soundOn={setup.soundOn}
            onClose={(done) => {
              setOverlay(null);
              void logAlert("breaks", done ? "done" : "skipped");
            }}
          />
        )}
        {overlay === "eyes" && (
          <EyeRestOverlay
            soundOn={setup.soundOn}
            onClose={(done) => {
              setOverlay(null);
              void logAlert("eyes", done ? "done" : "skipped");
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* Each alert type has its own little animation. */
function AlertIcon({ kind }: { kind: AlertKind }) {
  const def = ALERTS[kind];
  const bg = { background: `color-mix(in srgb, ${def.color} 18%, transparent)` };
  const anim =
    kind === "water"
      ? { y: [0, -6, 0, -3, 0], transition: { duration: 1.4, repeat: Infinity, repeatDelay: 0.6 } }
      : kind === "eyes"
        ? { scaleY: [1, 1, 0.1, 1, 1], transition: { duration: 2.4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] } }
        : kind === "stretch"
          ? { rotate: [0, -14, 14, -8, 0], transition: { duration: 1.2, repeat: Infinity, repeatDelay: 0.8 } }
          : kind === "sleep"
            ? { rotate: [0, -10, 0], y: [0, -3, 0], transition: { duration: 3, repeat: Infinity } }
            : kind === "evening"
              ? { scale: [1, 1.18, 1], transition: { duration: 0.9, repeat: Infinity } }
              : kind === "morning"
                ? { y: [8, 0], opacity: [0.4, 1], transition: { duration: 1.2 } }
                : { scale: [1, 1.12, 1], transition: { duration: 4, repeat: Infinity } };
  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-3xl" style={bg}>
      <motion.span animate={anim}>{def.emoji}</motion.span>
      {kind === "water" && (
        <motion.span
          className="absolute inset-x-0 bottom-0"
          style={{ background: def.color, opacity: 0.25 }}
          initial={{ height: "0%" }}
          animate={{ height: ["0%", "60%", "45%"] }}
          transition={{ duration: 1.6 }}
        />
      )}
    </span>
  );
}
