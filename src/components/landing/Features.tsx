"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CloudRain, Coffee, Headphones, Trees } from "lucide-react";
import { sounds } from "@/lib/sounds";
import Tilt from "@/components/ui/Tilt";

/* ---------- Lock in mode preview: live countdown + breathing orb ---------- */
function LockInMode() {
  const [secs, setSecs] = useState(50 * 60);
  const [ambient, setAmbient] = useState("Rain");
  const [distractions, setDistractions] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setSecs((s) => (s > 0 ? s - 1 : 50 * 60)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const mm = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const ss = (secs % 60).toString().padStart(2, "0");
  const ambients = [
    { name: "Rain", icon: CloudRain },
    { name: "Café", icon: Coffee },
    { name: "Forest", icon: Trees },
    { name: "Lo-fi", icon: Headphones },
  ];

  return (
    <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-[2rem] bg-[#0a0d26] p-7 text-[#eef0ff] sm:p-9">
      <div className="pointer-events-none absolute left-1/2 top-[46%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8f80ff]/30 blur-3xl animate-breathe" />
      <div className="relative">
        <p className="font-display text-2xl font-bold">Lock in mode</p>
        <p className="mt-1 max-w-xs text-sm text-[#9aa3d6]">
          A calm full-screen timer for deep work, with ambient sound and nothing
          else.
        </p>
      </div>
      <div className="relative my-auto py-8 text-center">
        <p className="text-sm text-[#9aa3d6]">Coding, React hooks</p>
        <p className="mt-2 font-display text-7xl font-extrabold tabular-nums tracking-tight sm:text-8xl">
          {mm}:{ss}
        </p>
        <p className="mt-2 text-sm text-[#9aa3d6]">
          Breathe in as the glow grows, out as it fades
        </p>
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ambients.map((a) => (
            <button
              key={a.name}
              type="button"
              onClick={() => setAmbient(a.name)}
              aria-pressed={ambient === a.name}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition ${
                ambient === a.name
                  ? "bg-white text-[#0a0d26]"
                  : "bg-white/8 text-[#cfd4ff] hover:bg-white/15"
              }`}
            >
              <a.icon size={14} /> {a.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDistractions((d) => d + 1)}
          className="rounded-full bg-white/8 px-3.5 py-2 text-sm text-[#cfd4ff] transition hover:bg-white/15"
        >
          Got distracted ({distractions})
        </button>
      </div>
    </div>
  );
}

/* ---------- Water glass: click to drink ---------- */
function WaterGlass() {
  const [glasses, setGlasses] = useState(3);
  const full = glasses >= 8;
  return (
    <div className="glass flex h-full flex-col rounded-3xl p-6">
      <p className="font-display text-lg font-bold">Water</p>
      <p className="text-sm text-muted">Tap to log a glass</p>
      <div className="my-5 flex flex-1 items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => {
            setGlasses((g) => (g >= 8 ? 0 : g + 1));
            sounds.water();
          }}
          aria-label="Log a glass of water"
          className="relative h-36 w-24 overflow-hidden rounded-b-[1.6rem] rounded-t-md border-2 border-line transition active:scale-95"
        >
          <motion.div
            className="absolute inset-x-0 bottom-0"
            style={{ background: "linear-gradient(var(--water), var(--cyan))" }}
            initial={false}
            animate={{ height: `${(glasses / 8) * 100}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 14 }}
          >
            <div className="absolute -top-2 left-0 h-4 w-[200%] animate-[marquee_3s_linear_infinite] rounded-[50%] bg-white/25" />
          </motion.div>
        </button>
        <div>
          <p className="font-display text-4xl font-extrabold tabular-nums">
            {glasses}
            <span className="text-xl text-muted">/8</span>
          </p>
          <p className="text-sm text-muted">
            {full ? "Goal hit 💧" : `${8 - glasses} to go`}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Streak mini ---------- */
function StreakMini() {
  const week = ["🔥", "🔥", "✅", "🔥", "❄️", "🔥", "🔥"];
  return (
    <div className="glass flex h-full flex-col rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl animate-flicker" aria-hidden>
          🔥
        </span>
        <div>
          <p className="font-display text-3xl font-extrabold tabular-nums">
            23 days
          </p>
          <p className="text-sm text-muted">locked in streak</p>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-7 gap-1.5 pt-6 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i}>
            <p className="text-xs text-muted">{d}</p>
            <p className="mt-1 text-lg">{week[i]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Heatmap ---------- */
function Heatmap() {
  // deterministic "random" so server and browser render the same squares
  const level = (i: number) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    const r = x - Math.floor(x);
    return i % 7 === 6 && r < 0.5
      ? 0
      : Math.min(4, Math.floor(r * 5 + (i / 105) * 1.5));
  };
  const shades = [
    "var(--line)",
    "color-mix(in oklab, var(--violet) 30%, transparent)",
    "color-mix(in oklab, var(--violet) 55%, transparent)",
    "color-mix(in oklab, var(--violet) 80%, transparent)",
    "var(--violet)",
  ];
  return (
    <div className="glass h-full rounded-3xl p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-bold">Every day, at a glance</p>
        <p className="text-sm text-muted">15 weeks</p>
      </div>
      <div className="mt-5 grid grid-flow-col grid-rows-7 gap-1.5">
        {Array.from({ length: 105 }, (_, i) => (
          <div
            key={i}
            className="aspect-square rounded-[4px]"
            style={{ background: shades[level(i)] }}
            title={`Day ${i + 1}`}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Darker squares are days you focused longer.
      </p>
    </div>
  );
}

/* ---------- Insights bar chart ---------- */
function Insights() {
  const data = [
    { d: "Mon", h: 5.5 },
    { d: "Tue", h: 6.8 },
    { d: "Wed", h: 4.2 },
    { d: "Thu", h: 7.4 },
    { d: "Fri", h: 6.1 },
    { d: "Sat", h: 8.2 },
    { d: "Sun", h: 3.0 },
  ];
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="glass h-full rounded-3xl p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-bold">Focus this week</p>
        <p className="text-sm tabular-nums text-muted">
          {active === null
            ? "41h 12m total"
            : `${data[active].d}: ${data[active].h}h`}
        </p>
      </div>
      <div
        className="mt-6 flex h-36 items-end gap-3"
        onMouseLeave={() => setActive(null)}
      >
        {data.map((b, i) => (
          <button
            key={b.d}
            type="button"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
            aria-label={`${b.d} ${b.h} hours`}
          >
            <motion.span
              initial={{ height: 0 }}
              whileInView={{ height: `${(b.h / 8.2) * 100}%` }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                delay: i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full rounded-t-lg rounded-b-sm"
              style={{
                background: active === i ? "var(--amber)" : "var(--violet)",
              }}
            />
            <span className="text-xs text-muted">{b.d}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        You focus best between 9 and 11 am.
      </p>
    </div>
  );
}

/* ---------- Habits ---------- */
function Habits() {
  const [done, setDone] = useState<Record<string, boolean>>({
    Meditate: true,
    "Read 20 pages": false,
    "No sugar": true,
    "Walk 5 km": false,
  });
  return (
    <div className="glass h-full rounded-3xl p-6">
      <p className="font-display text-lg font-bold">Habits</p>
      <ul className="mt-4 space-y-2.5">
        {Object.entries(done).map(([name, ok]) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => {
                setDone((d) => ({ ...d, [name]: !ok }));
                if (!ok) sounds.done();
              }}
              className="flex w-full items-center gap-3 text-left"
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-lg border-2 transition ${ok ? "border-mint bg-mint text-bg" : "border-line"}`}
              >
                <AnimatePresence>
                  {ok && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check size={14} strokeWidth={3.5} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={ok ? "text-muted line-through" : ""}>
                {name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Friends ---------- */
function Friends() {
  const people = [
    { name: "Aarav", h: 31, emoji: "👑" },
    { name: "You", h: 28, emoji: "🔥" },
    { name: "Meera", h: 24, emoji: "💪" },
    { name: "Kabir", h: 19, emoji: "📚" },
  ];
  return (
    <div className="glass h-full rounded-3xl p-6">
      <p className="font-display text-lg font-bold">Friends this week</p>
      <ol className="mt-4 space-y-3">
        {people.map((p, i) => (
          <li key={p.name} className="flex items-center gap-3">
            <span className="w-4 text-sm tabular-nums text-muted">{i + 1}</span>
            <span className="text-lg">{p.emoji}</span>
            <span className={`flex-1 ${p.name === "You" ? "font-bold" : ""}`}>
              {p.name}
            </span>
            <span className="tabular-nums text-muted">{p.h}h</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Features() {
  return (
    <section id="features" className="scroll-mt-24 px-4 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Everything about your day, in one place
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Skills, exams, fitness, reading, work: pick what you&apos;re working
            on. These are real pieces of the app, so go ahead and tap them.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <Tilt className="md:col-span-4 md:row-span-2 rounded-3xl" max={3}>
            <LockInMode />
          </Tilt>
          <Tilt className="md:col-span-2 rounded-3xl" max={7}>
            <WaterGlass />
          </Tilt>
          <Tilt className="md:col-span-2 rounded-3xl" max={7}>
            <StreakMini />
          </Tilt>
          <Tilt className="md:col-span-3 rounded-3xl" max={7}>
            <Heatmap />
          </Tilt>
          <Tilt className="md:col-span-3 rounded-3xl" max={7}>
            <Insights />
          </Tilt>
          <Tilt className="md:col-span-3 rounded-3xl" max={7}>
            <Habits />
          </Tilt>
          <Tilt className="md:col-span-3 rounded-3xl" max={7}>
            <Friends />
          </Tilt>
        </div>
      </div>
    </section>
  );
}
