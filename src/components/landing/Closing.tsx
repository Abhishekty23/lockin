"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import Logo, { LockMark } from "@/components/ui/Logo";
import { sounds } from "@/lib/sounds";

const FAQS = [
  { q: "Is LockIn only for students?", a: "No. You choose what you're working on: a skill like coding or a language, an exam, fitness, reading, your career or something of your own. LockIn adapts to it." },
  { q: "Is it free?", a: "Yes. You can track your whole day, use reminders, streaks and insights for free." },
  { q: "Will reminders work on my phone?", a: "Yes. Allow notifications once and LockIn reminds you with a sound and vibration. You can also install it on your home screen like an app." },
  { q: "Can I turn reminders off or change them?", a: "Every reminder has its own switch and timing. You can also set quiet hours, choose a sound pack or mute sounds completely." },
  { q: "Who can see my data?", a: "Only you. Friends see your weekly focus hours only if you add them and choose to share." },
  { q: "Does it work in dark mode?", a: "Dark and light are both built in. LockIn follows your device setting, and you can switch any time." },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-24 px-4 py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Questions</h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQS.map((f, i) => (
            <div key={f.q}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="flex w-full items-center justify-between gap-6 py-5 text-left font-display text-lg font-semibold"
              >
                {f.q}
                <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="shrink-0 text-muted">
                  <Plus size={20} />
                </motion.span>
              </button>
              <motion.div
                initial={false}
                animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <p className="pb-5 pr-10 leading-relaxed text-muted">{f.a}</p>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  const [locked, setLocked] = useState(false);
  return (
    <section className="px-4 pb-24">
      <div className="sky glass relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] px-6 py-20 text-center sm:px-12">
        <button
          type="button"
          onClick={() => {
            setLocked(true);
            sounds.lock();
            setTimeout(() => setLocked(false), 2200);
          }}
          aria-label="Snap the lock"
          className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-surface-strong shadow-xl transition hover:scale-105"
        >
          <motion.span animate={locked ? { scale: [1, 1.3, 1], rotate: [0, -8, 0] } : {}} transition={{ duration: 0.5 }}>
            <LockMark size={56} closed={locked} />
          </motion.span>
        </button>
        <h2 className="mx-auto mt-8 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-6xl">Ready to lock in?</h2>
        <p className="mx-auto mt-5 max-w-md text-lg text-muted">Set up your day in under a minute. Your first streak starts today.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="rounded-full bg-ink px-8 py-4 font-semibold text-bg transition hover:-translate-y-0.5">
            Start free
          </Link>
          <Link href="/demo" className="glass rounded-full px-8 py-4 font-semibold transition hover:-translate-y-0.5">
            Try the demo
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
        <Logo />
        <p>Track your whole day. Built by Abhishek Tyagi.</p>
        <p>© 2026 LockIn</p>
      </div>
    </footer>
  );
}
