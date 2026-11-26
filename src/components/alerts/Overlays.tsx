"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { sounds } from "@/lib/sounds";

function useCountdown(seconds: number, onDone: () => void) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const l = Math.max(0, seconds - Math.floor((Date.now() - start) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(id);
        onDone();
      }
    }, 250);
    return () => clearInterval(id);
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return left;
}

function Shell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label={label}
      className="sky fixed inset-0 z-[80] grid place-items-center p-6"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-surface-strong ring-1 ring-line">
        <X size={18} />
      </button>
      {children}
    </motion.div>
  );
}

const PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"];

/** One minute of box breathing: 4 seconds in, hold, out, hold. */
export function BreathingOverlay({ soundOn, onClose }: { soundOn: boolean; onClose: (done: boolean) => void }) {
  const left = useCountdown(60, () => {
    if (soundOn) sounds.done();
    setTimeout(() => onClose(true), 1200);
  });
  const elapsed = 60 - left;
  const phase = Math.floor(elapsed / 4) % 4;
  const big = phase === 0 || phase === 1;

  return (
    <Shell onClose={() => onClose(false)} label="Breathing break">
      <div className="text-center">
        <div className="relative mx-auto grid h-72 w-72 place-items-center">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(circle, rgb(79 227 164 / 0.45), rgb(70 212 234 / 0.15) 65%, transparent 70%)" }}
            animate={{ scale: big ? 1 : 0.55 }}
            transition={{ duration: phase === 1 || phase === 3 ? 0.2 : 4, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute h-40 w-40 rounded-full ring-2 ring-mint/60"
            animate={{ scale: big ? 1.6 : 1 }}
            transition={{ duration: phase === 1 || phase === 3 ? 0.2 : 4, ease: "easeInOut" }}
          />
          <p className="relative font-display text-3xl font-bold">{left > 0 ? PHASES[phase] : "Nice."}</p>
        </div>
        <p className="mt-6 text-muted">{left > 0 ? `${left}s left. Follow the circle.` : "You're reset. Back to it."}</p>
      </div>
    </Shell>
  );
}

/** 20 seconds looking far away (the 20-20-20 rule). */
export function EyeRestOverlay({ soundOn, onClose }: { soundOn: boolean; onClose: (done: boolean) => void }) {
  const left = useCountdown(20, () => {
    if (soundOn) sounds.eyes();
    setTimeout(() => onClose(true), 1200);
  });
  return (
    <Shell onClose={() => onClose(false)} label="Eye rest">
      <div className="max-w-sm text-center">
        <motion.p
          className="text-8xl"
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.46, 0.5, 0.54, 1] }}
        >
          👀
        </motion.p>
        <p className="mt-8 font-display text-7xl font-extrabold tabular-nums">{left}</p>
        <p className="mt-4 text-lg">{left > 0 ? "Look at something about 6 metres away." : "Eyes rested. 👌"}</p>
        <p className="mt-1 text-muted">Blink slowly. Let your shoulders drop.</p>
      </div>
    </Shell>
  );
}
