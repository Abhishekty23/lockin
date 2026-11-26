"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bell, BellOff, Check, Loader2, Moon, Play, Sun, Volume2, VolumeX } from "lucide-react";
import Logo, { LockMark } from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import FormAlert from "@/components/auth/FormAlert";
import { sounds, type SoundName } from "@/lib/sounds";
import { saveOnboarding, type OnboardingInput } from "@/app/onboarding/actions";

const AVATARS = ["🦉", "🦊", "🐼", "🐯", "🐺", "🦁", "🐨", "🐸", "🐧", "🦄", "🐙", "🌱"];

const TRACKS = [
  { id: "skills", emoji: "🧠", title: "Learning skills", text: "Coding, design, languages, music" },
  { id: "exam", emoji: "📚", title: "Exam prep", text: "Any exam, at your own pace" },
  { id: "career", emoji: "💼", title: "Career & work", text: "Job hunt, projects, side hustle" },
  { id: "fitness", emoji: "💪", title: "Health & fitness", text: "Workouts, steps, sleep, food" },
  { id: "reading", emoji: "📖", title: "Reading", text: "Books, pages, notes" },
  { id: "custom", emoji: "✨", title: "Something else", text: "Name it yourself" },
];

const REMINDERS: { key: keyof OnboardingInput["reminders"]; emoji: string; title: string; text: string; sound: SoundName }[] = [
  { key: "water", emoji: "💧", title: "Drink water", text: "Every 60 to 90 minutes while you're awake", sound: "water" },
  { key: "breaks", emoji: "☕", title: "Take a break", text: "After each long focus session", sound: "break" },
  { key: "eyes", emoji: "👀", title: "Rest your eyes", text: "Look 20 feet away for 20 seconds", sound: "eyes" },
  { key: "stretch", emoji: "🧍", title: "Stand and stretch", text: "If you've been sitting for an hour", sound: "stretch" },
  { key: "sleep", emoji: "😴", title: "Wind down for sleep", text: "30 minutes before your bedtime", sound: "sleep" },
];

const STEPS = ["You", "Goals", "Your day", "Alerts", "Ready"];

function hoursLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function Onboarding({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [locked, setLocked] = useState(false);

  const [data, setData] = useState<OnboardingInput>({
    fullName: initialName,
    avatar: "🦉",
    tracks: [],
    examName: "",
    customTrack: "",
    wakeTime: "06:30",
    sleepTime: "22:30",
    focusGoalMinutes: 240,
    waterGoal: 8,
    reminders: { water: true, breaks: true, eyes: true, stretch: true, sleep: true },
    soundOn: true,
    timezone: "Asia/Kolkata",
  });
  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) => setData((d) => ({ ...d, [k]: v }));

  const canContinue =
    (step === 0 && data.fullName.trim().length > 0) ||
    (step === 1 && data.tracks.length > 0) ||
    step === 2 ||
    step === 3;

  function go(to: number) {
    setError(null);
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  function finish() {
    setError(null);
    startSaving(async () => {
      const res = await saveOnboarding({ ...data, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLocked(true);
      if (data.soundOn) sounds.lock();
      setTimeout(() => {
        router.replace("/today");
        router.refresh();
      }, 1400);
    });
  }

  return (
    <div className="sky flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Logo />
        <ThemeToggle />
      </header>

      {/* progress */}
      <div className="mx-auto w-full max-w-3xl px-5">
        <ol className="flex gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet to-cyan"
                  initial={false}
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={{ duration: 0.45 }}
                />
              </div>
              <span className={`mt-2 hidden text-xs font-semibold sm:block ${i <= step ? "text-ink" : "text-muted"}`}>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-10 pt-8">
        <div className="relative flex-1">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.section
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              {step === 0 && (
                <>
                  <h1 className="font-display text-3xl font-bold sm:text-4xl">Hi! What should we call you?</h1>
                  <p className="mt-2 text-muted">This is how LockIn greets you each morning. Signed in as {email}.</p>
                  <input
                    value={data.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    maxLength={60}
                    autoFocus
                    placeholder="Your name"
                    aria-label="Your name"
                    className="mt-8 w-full rounded-2xl border border-line bg-surface px-5 py-4 font-display text-2xl font-semibold outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/20"
                  />
                  <h2 className="mt-10 font-semibold">Pick your buddy</h2>
                  <div className="mt-3 grid grid-cols-6 gap-2.5 sm:grid-cols-12">
                    {AVATARS.map((a) => (
                      <motion.button
                        key={a}
                        type="button"
                        whileTap={{ scale: 0.85 }}
                        onClick={() => set("avatar", a)}
                        aria-label={`Avatar ${a}`}
                        aria-pressed={data.avatar === a}
                        className={`grid aspect-square place-items-center rounded-2xl text-2xl transition ${
                          data.avatar === a ? "bg-violet/20 ring-2 ring-violet" : "bg-surface ring-1 ring-line hover:ring-violet/40"
                        }`}
                      >
                        {a}
                      </motion.button>
                    ))}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h1 className="font-display text-3xl font-bold sm:text-4xl">What are you working on?</h1>
                  <p className="mt-2 text-muted">Pick everything that fits. You can change this any time.</p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {TRACKS.map((t) => {
                      const on = data.tracks.includes(t.id);
                      return (
                        <div key={t.id} className={`rounded-3xl p-1 transition ${on ? "bg-gradient-to-br from-violet to-cyan" : "bg-line"}`}>
                          <div className="rounded-[20px] bg-bg">
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => set("tracks", on ? data.tracks.filter((x) => x !== t.id) : [...data.tracks, t.id])}
                              className="flex w-full items-center gap-4 p-4 text-left"
                            >
                              <motion.span animate={{ scale: on ? 1.15 : 1, rotate: on ? -8 : 0 }} className="text-3xl">
                                {t.emoji}
                              </motion.span>
                              <span className="flex-1">
                                <span className="block font-semibold">{t.title}</span>
                                <span className="block text-sm text-muted">{t.text}</span>
                              </span>
                              <span className={`grid h-6 w-6 place-items-center rounded-full transition ${on ? "bg-violet text-white" : "ring-1 ring-line"}`}>
                                {on && <Check size={14} strokeWidth={3} />}
                              </span>
                            </button>
                            {on && (t.id === "exam" || t.id === "custom") && (
                              <div className="px-4 pb-4">
                                <input
                                  value={t.id === "exam" ? data.examName : data.customTrack}
                                  onChange={(e) => set(t.id === "exam" ? "examName" : "customTrack", e.target.value)}
                                  maxLength={60}
                                  placeholder={t.id === "exam" ? "Which exam? e.g. GATE, CAT, UPSC" : "e.g. Learning guitar"}
                                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-violet"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h1 className="font-display text-3xl font-bold sm:text-4xl">Shape your day</h1>
                  <p className="mt-2 text-muted">Your ring and your reminders follow these times.</p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        { k: "wakeTime", label: "I wake up at", Icon: Sun, color: "var(--amber)" },
                        { k: "sleepTime", label: "I go to bed at", Icon: Moon, color: "var(--cyan)" },
                      ] as const
                    ).map(({ k, label, Icon, color }) => (
                      <label key={k} className="glass flex items-center gap-4 rounded-3xl p-5">
                        <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
                          <Icon size={22} />
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm text-muted">{label}</span>
                          <input
                            type="time"
                            value={data[k]}
                            onChange={(e) => set(k, e.target.value)}
                            className="mt-1 w-full bg-transparent font-display text-2xl font-semibold outline-none"
                          />
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="glass mt-3 rounded-3xl p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">Daily focus goal</span>
                      <span className="font-display text-2xl font-bold text-violet">{hoursLabel(data.focusGoalMinutes)}</span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={720}
                      step={30}
                      value={data.focusGoalMinutes}
                      onChange={(e) => set("focusGoalMinutes", Number(e.target.value))}
                      aria-label="Daily focus goal"
                      className="mt-4 w-full accent-[var(--violet)]"
                    />
                    <p className="mt-2 text-sm text-muted">Start small. You can raise it once the streak is going.</p>
                  </div>

                  <div className="glass mt-3 rounded-3xl p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">Water goal</span>
                      <span className="font-display text-2xl font-bold text-water">{data.waterGoal} glasses</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
                      {Array.from({ length: 15 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          tabIndex={-1}
                          onClick={() => {
                            set("waterGoal", Math.max(4, i + 1));
                            if (data.soundOn) sounds.water();
                          }}
                          className="relative h-10 w-7 overflow-hidden rounded-b-lg rounded-t-sm border-2 border-water/50"
                        >
                          <motion.span
                            className="absolute inset-x-0 bottom-0 bg-water"
                            initial={false}
                            animate={{ height: i < data.waterGoal ? "80%" : "0%" }}
                            transition={{ delay: i * 0.02 }}
                          />
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={15}
                      value={data.waterGoal}
                      onChange={(e) => set("waterGoal", Number(e.target.value))}
                      aria-label="Water goal in glasses"
                      className="mt-4 w-full accent-[var(--water)]"
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h1 className="font-display text-3xl font-bold sm:text-4xl">Which nudges do you want?</h1>
                  <p className="mt-2 text-muted">Each alert has its own sound. Press play to hear it.</p>
                  <button
                    type="button"
                    onClick={() => set("soundOn", !data.soundOn)}
                    className="glass mt-8 flex w-full items-center gap-4 rounded-3xl p-5 text-left"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet/15 text-violet">
                      {data.soundOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">Alert sounds</span>
                      <span className="block text-sm text-muted">{data.soundOn ? "On. Alerts chime softly." : "Off. Alerts stay silent."}</span>
                    </span>
                    <Switch on={data.soundOn} />
                  </button>
                  <ul className="mt-3 space-y-3">
                    {REMINDERS.map((r) => {
                      const on = data.reminders[r.key];
                      return (
                        <li key={r.key} className="glass flex items-center gap-4 rounded-3xl p-4">
                          <span className="text-3xl">{r.emoji}</span>
                          <span className="flex-1">
                            <span className="block font-semibold">{r.title}</span>
                            <span className="block text-sm text-muted">{r.text}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => sounds[r.sound]()}
                            aria-label={`Play the ${r.title} sound`}
                            className="grid h-11 w-11 place-items-center rounded-full bg-surface-strong text-muted ring-1 ring-line transition hover:text-ink"
                          >
                            <Play size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => set("reminders", { ...data.reminders, [r.key]: !on })}
                            aria-label={`${r.title} ${on ? "on" : "off"}`}
                            aria-pressed={on}
                          >
                            <Switch on={on} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {step === 4 && (
                <div className="text-center">
                  <motion.div
                    className="mx-auto grid h-36 w-36 place-items-center rounded-[40px] bg-surface-strong shadow-2xl ring-1 ring-line"
                    animate={locked ? { scale: [1, 1.15, 1], rotate: [0, -6, 0] } : { y: [0, -6, 0] }}
                    transition={locked ? { duration: 0.5 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <LockMark size={88} closed={locked} />
                  </motion.div>
                  <h1 className="mt-8 font-display text-3xl font-bold sm:text-4xl">
                    {locked ? "Locked in. Let's go!" : `You're all set, ${data.fullName.trim().split(" ")[0]} ${data.avatar}`}
                  </h1>
                  <p className="mx-auto mt-2 max-w-md text-muted">Here&apos;s your plan for every day. Fill it and your lock snaps shut.</p>
                  <ul className="mx-auto mt-8 grid max-w-xl gap-3 text-left sm:grid-cols-2">
                    <Summary emoji="🎯" label="Working on" value={data.tracks.map((t) => (t === "exam" && data.examName ? data.examName : t === "custom" && data.customTrack ? data.customTrack : TRACKS.find((x) => x.id === t)?.title)).join(", ")} />
                    <Summary emoji="⏱️" label="Focus goal" value={`${hoursLabel(data.focusGoalMinutes)} a day`} />
                    <Summary emoji="💧" label="Water" value={`${data.waterGoal} glasses`} />
                    <Summary emoji="🌙" label="Day" value={`${data.wakeTime} to ${data.sleepTime}`} />
                  </ul>
                  <div className="mx-auto mt-6 max-w-xl text-left">
                    <FormAlert message={error} />
                  </div>
                </div>
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        {/* footer controls */}
        <div className="mt-10 flex items-center gap-3">
          {step > 0 && !locked && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="inline-flex h-13 items-center gap-2 rounded-2xl px-5 py-3.5 font-semibold text-muted transition hover:text-ink"
            >
              <ArrowLeft size={18} /> Back
            </button>
          )}
          <div className="flex-1" />
          {step < 4 ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => go(step + 1)}
              className="rounded-2xl bg-ink px-8 py-3.5 font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === 3 ? (Object.values(data.reminders).some(Boolean) ? <span className="inline-flex items-center gap-2"><Bell size={18} /> Continue</span> : <span className="inline-flex items-center gap-2"><BellOff size={18} /> Continue without alerts</span>) : "Continue"}
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={saving || locked}
              className="inline-flex min-w-44 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-cyan px-8 py-3.5 font-semibold text-white shadow-lg shadow-violet/30 transition hover:brightness-110 disabled:opacity-80"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : locked ? <Check size={18} /> : null}
              {locked ? "Opening your day" : "Lock in my first day"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-block h-7 w-12 rounded-full transition ${on ? "bg-mint" : "bg-line"}`}>
      <motion.span
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
        initial={false}
        animate={{ left: on ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </span>
  );
}

function Summary({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <li className="glass flex items-center gap-3 rounded-2xl p-4">
      <span className="text-2xl">{emoji}</span>
      <span className="min-w-0">
        <span className="block text-sm text-muted">{label}</span>
        <span className="block truncate font-semibold">{value}</span>
      </span>
    </li>
  );
}
