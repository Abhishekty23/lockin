"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Volume2 } from "lucide-react";
import { sounds, type SoundName } from "@/lib/sounds";
import { LockMark } from "@/components/ui/Logo";

type Alert = {
  id: SoundName;
  emoji: string;
  name: string;
  sound: string;
  title: string;
  body: string;
  color: string;
  overlay?: "breathe" | "eyes" | "moon" | "lock";
};

const ALERTS: Alert[] = [
  { id: "water", emoji: "💧", name: "Drink water", sound: "Water-drop plip", title: "Time for water", body: "Glass 5 of 8. You're doing great.", color: "var(--water)" },
  { id: "break", emoji: "☕", name: "Take a break", sound: "Gentle chime", title: "Break time", body: "50 minutes done. Breathe with the circle.", color: "var(--rose)", overlay: "breathe" },
  { id: "eyes", emoji: "👀", name: "Rest your eyes", sound: "Soft bell", title: "20-20-20", body: "Look 20 feet away for 20 seconds.", color: "var(--amber)", overlay: "eyes" },
  { id: "stretch", emoji: "🧍", name: "Stretch", sound: "Light pop", title: "Stretch it out", body: "Roll your shoulders and stand tall.", color: "var(--mint)" },
  { id: "sleep", emoji: "😴", name: "Sleep time", sound: "Calm night tone", title: "Wind down", body: "Lights low, phone down. Sleep by 11.", color: "var(--cyan)", overlay: "moon" },
  { id: "streak", emoji: "🔥", name: "Streak saver", sound: "Warm alert", title: "Your 23-day streak ends at midnight", body: "20 minutes of focus keeps it alive.", color: "var(--amber)" },
  { id: "badge", emoji: "🏅", name: "Badge unlocked", sound: "Achievement jingle", title: "Hydration hero", body: "You hit your water goal 7 days in a row.", color: "var(--violet)" },
  { id: "lock", emoji: "🔒", name: "Daily goal reached", sound: "The lock snaps shut", title: "Locked in for today", body: "Score 100. See you tomorrow.", color: "var(--violet)", overlay: "lock" },
];

function Overlay({ kind, onClose }: { kind: NonNullable<Alert["overlay"]>; onClose: () => void }) {
  const [count, setCount] = useState(20);
  useEffect(() => {
    if (kind !== "eyes") return;
    const id = setInterval(() => setCount((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [kind]);

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0d26]/92 px-6 text-center text-[#eef0ff] backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {kind === "breathe" && (
        <>
          <div className="relative grid h-40 w-40 place-items-center">
            <div className="absolute inset-0 rounded-full bg-[#ff7ba6]/30 animate-breathe" />
            <div className="absolute inset-6 rounded-full bg-[#ff7ba6]/40 animate-breathe [animation-delay:.4s]" />
            <span className="relative text-sm">Breathe</span>
          </div>
          <p className="mt-6 font-display text-xl font-bold">5-minute break</p>
        </>
      )}
      {kind === "eyes" && (
        <>
          <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
            <circle cx="75" cy="75" r="62" fill="none" stroke="rgb(255 255 255 / .12)" strokeWidth="10" />
            <motion.circle
              cx="75"
              cy="75"
              r="62"
              fill="none"
              stroke="#ffb547"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 62}
              animate={{ strokeDashoffset: (2 * Math.PI * 62 * (20 - count)) / 20 }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </svg>
          <p className="-mt-[96px] mb-[60px] font-display text-4xl font-extrabold tabular-nums">{count}</p>
          <p className="font-display text-xl font-bold">Look far away 👀</p>
        </>
      )}
      {kind === "moon" && (
        <>
          <motion.span className="text-7xl" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1.4, ease: "easeOut" }}>
            🌙
          </motion.span>
          <p className="mt-6 font-display text-xl font-bold">Time to wind down</p>
          <p className="mt-1 text-sm text-[#9aa3d6]">Tomorrow starts tonight.</p>
        </>
      )}
      {kind === "lock" && (
        <>
          <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: [0.4, 1.25, 1], rotate: 0 }} transition={{ duration: 0.7 }}>
            <LockMark size={96} />
          </motion.div>
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-2 w-2 rounded-sm"
              style={{ background: ["#8f80ff", "#46d4ea", "#ffb547", "#ff7ba6"][i % 4], top: "42%", left: "50%" }}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: Math.cos((i / 14) * Math.PI * 2) * 120, y: Math.sin((i / 14) * Math.PI * 2) * 120 + 40, opacity: 0, rotate: 180 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          ))}
          <p className="mt-6 font-display text-xl font-bold">Locked in for today 🔒</p>
        </>
      )}
      <button type="button" onClick={onClose} className="mt-8 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#0a0d26]">
        Done
      </button>
    </motion.div>
  );
}

export default function AlertsShowcase() {
  const [active, setActive] = useState<Alert | null>(null);
  const [overlay, setOverlay] = useState<Alert["overlay"] | null>(null);
  const [key, setKey] = useState(0);

  function fire(a: Alert) {
    sounds[a.id]();
    setActive(a);
    setOverlay(a.overlay ?? null);
    setKey((k) => k + 1);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(40);
  }

  useEffect(() => {
    if (!active || overlay) return;
    const id = setTimeout(() => setActive(null), 4500);
    return () => clearTimeout(id);
  }, [active, overlay, key]);

  return (
    <section id="alerts" className="scroll-mt-24 px-4 py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Reminders you&apos;ll actually like</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            Every alert has its own sound and animation, so you know what it is before you look. Tap one to try it. Turn the sound
            on first.
          </p>
          <div className="mt-9 grid gap-2.5 sm:grid-cols-2">
            {ALERTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => fire(a)}
                className="glass flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition hover:-translate-y-0.5"
                style={active?.id === a.id ? { boxShadow: `0 0 0 2px ${a.color}` } : undefined}
              >
                <span className="text-2xl">{a.emoji}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{a.name}</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <Volume2 size={13} /> {a.sound}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            In the app you choose which reminders you want, how often, quiet hours and the sound pack.
          </p>
        </div>

        {/* phone preview */}
        <div className="mx-auto w-full max-w-[320px]">
          <div className="relative aspect-[9/19] overflow-hidden rounded-[2.8rem] border-[10px] border-[#181c3f] bg-[#0d1130] shadow-2xl shadow-black/40">
            <div className="sky absolute inset-0" />
            <div className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-[#181c3f]" />
            <div className="relative px-5 pt-14 text-[#eef0ff]">
              <p className="text-center font-display text-6xl font-bold tabular-nums">9:50</p>
              <p className="text-center text-sm text-[#9aa3d6]">Thursday, focus day</p>
            </div>

            <AnimatePresence mode="wait">
              {active && !overlay && (
                <motion.div
                  key={key}
                  initial={{ y: -90, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -60, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="absolute inset-x-3 top-40 rounded-2xl bg-white/12 p-4 text-[#eef0ff] backdrop-blur-xl"
                >
                  <div className="flex gap-3">
                    <motion.span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl"
                      style={{ background: active.color }}
                      animate={{ rotate: [0, -12, 12, -8, 0] }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    >
                      {active.emoji}
                    </motion.span>
                    <div className="min-w-0">
                      <p className="text-xs text-[#9aa3d6]">LockIn · now</p>
                      <p className="font-semibold leading-snug">{active.title}</p>
                      <p className="text-sm text-[#cfd4ff]">{active.body}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    {["Done", "Snooze 10m", "Skip"].map((b) => (
                      <button key={b} type="button" onClick={() => setActive(null)} className="rounded-lg bg-white/10 py-1.5 hover:bg-white/20">
                        {b}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {overlay && (
                <Overlay
                  key={key}
                  kind={overlay}
                  onClose={() => {
                    setOverlay(null);
                    setActive(null);
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
