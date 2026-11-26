"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellRing, Loader2, Moon, Play, Sun, Volume2, VolumeX } from "lucide-react";
import { ALERTS, INTERVAL_CHOICES, type AlertKind, type RepeatingKind } from "@/lib/alerts";
import { formatMinutes } from "@/lib/day";
import { saveSettings, type SettingsInput } from "@/app/settings/actions";

const AVATARS = ["🦉", "🦊", "🐼", "🐯", "🐺", "🦁", "🐨", "🐸", "🐧", "🦄", "🐙", "🌱"];
const REPEATING: { kind: RepeatingKind; text: string }[] = [
  { kind: "water", text: "Skips itself once you hit your water goal." },
  { kind: "breaks", text: "Opens a one-minute breathing break." },
  { kind: "eyes", text: "A 20-second look-away timer (the 20-20-20 rule)." },
  { kind: "stretch", text: "A nudge to get up when you've been sitting." },
];

type Perm = "default" | "granted" | "denied" | "unsupported";

export default function SettingsForm({ initial, email }: { initial: SettingsInput; email: string }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "good" | "error" } | null>(null);
  const [perm, setPerm] = useState<Perm>("default");
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  const set = <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) => setS((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const t = setTimeout(() => setPerm(typeof Notification === "undefined" ? "unsupported" : (Notification.permission as Perm)), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const test = (kind: AlertKind) => window.dispatchEvent(new CustomEvent("lockin:test-alert", { detail: kind }));

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    try {
      const p = await Notification.requestPermission();
      setPerm(p as Perm);
      if (p === "granted") {
        setS((x) => ({ ...x, prefs: { ...x.prefs, desktop: true } }));
        new Notification("🔒 LockIn", { body: "Desktop alerts are on. You'll see them even when LockIn is in a background tab." });
      }
    } catch {
      setPerm("denied");
    }
  }

  async function save() {
    setSaving(true);
    const res = await saveSettings(s);
    setSaving(false);
    if (!res.ok) return setToast({ text: res.error, tone: "error" });
    setToast({ text: "Settings saved", tone: "good" });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
      <p className="mt-2 text-muted">Signed in as {email}</p>

      {/* ---------- Alerts ---------- */}
      <Section title="Alerts" text="Reminders pop up on any LockIn page while it's open, between your wake-up time and bedtime. They wait while a Lock In session is running.">
        <Row
          icon={s.soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          title="Alert sounds"
          text={s.soundOn ? "Each alert plays its own soft sound." : "Alerts show silently."}
          control={<Switch on={s.soundOn} onChange={(v) => set("soundOn", v)} label="Alert sounds" />}
        />
        <Row
          icon={<BellRing size={20} />}
          title="Desktop notifications"
          text={
            perm === "granted"
              ? s.prefs.desktop
                ? "On. Alerts also show as system notifications when LockIn is in a background tab."
                : "Allowed, but switched off."
              : perm === "denied"
                ? "Blocked in your browser. Allow notifications for this site in the browser's site settings."
                : perm === "unsupported"
                  ? "This browser doesn't support notifications."
                  : "Get alerts even when you're in another tab."
          }
          control={
            perm === "granted" ? (
              <Switch on={s.prefs.desktop} onChange={(v) => set("prefs", { ...s.prefs, desktop: v })} label="Desktop notifications" />
            ) : perm === "default" ? (
              <button onClick={askPermission} className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-bg">
                Allow
              </button>
            ) : null
          }
        />

        {REPEATING.map(({ kind, text }) => {
          const def = ALERTS[kind];
          const on = s.reminders[kind];
          return (
            <Row
              key={kind}
              icon={<span className="text-2xl">{def.emoji}</span>}
              title={def.title}
              text={text}
              control={<Switch on={on} onChange={(v) => set("reminders", { ...s.reminders, [kind]: v })} label={def.title} />}
            >
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-14">
                      <span className="mr-1 text-sm text-muted">Every</span>
                      {INTERVAL_CHOICES[kind].map((m) => (
                        <button
                          key={m}
                          onClick={() => set("prefs", { ...s.prefs, [kind]: m })}
                          aria-pressed={s.prefs[kind] === m}
                          className={`h-9 rounded-xl px-3 text-sm font-semibold transition ${s.prefs[kind] === m ? "bg-violet text-white" : "bg-surface ring-1 ring-line hover:ring-violet/40"}`}
                        >
                          {formatMinutes(m)}
                        </button>
                      ))}
                      <TestButton onClick={() => test(kind)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Row>
          );
        })}

        <Row
          icon={<span className="text-2xl">🌙</span>}
          title="Bedtime wind-down"
          text="30 minutes before your bedtime."
          control={<Switch on={s.reminders.sleep} onChange={(v) => set("reminders", { ...s.reminders, sleep: v })} label="Bedtime wind-down" />}
        >
          <div className="mt-3 pl-14">
            <TestButton onClick={() => test("sleep")} />
          </div>
        </Row>
        <Row
          icon={<span className="text-2xl">🌅</span>}
          title="Morning check-in"
          text="After you wake up, if last night's sleep isn't logged yet."
          control={<Switch on={s.prefs.morning} onChange={(v) => set("prefs", { ...s.prefs, morning: v })} label="Morning check-in" />}
        >
          <div className="mt-3 pl-14">
            <TestButton onClick={() => test("morning")} />
          </div>
        </Row>
        <Row
          icon={<span className="text-2xl">🔥</span>}
          title="Evening streak saver"
          text="At 9 pm, only if today's ring is under 50."
          control={<Switch on={s.prefs.evening} onChange={(v) => set("prefs", { ...s.prefs, evening: v })} label="Evening streak saver" />}
        >
          <div className="mt-3 pl-14">
            <TestButton onClick={() => test("evening")} />
          </div>
        </Row>
      </Section>

      {/* ---------- Day ---------- */}
      <Section title="Your day" text="Your ring and your alerts follow these.">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["wakeTime", "Wake up", Sun, "var(--amber)"],
              ["sleepTime", "Bedtime", Moon, "var(--cyan)"],
            ] as const
          ).map(([k, label, Icon, color]) => (
            <label key={k} className="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line">
              <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
                <Icon size={20} />
              </span>
              <span className="flex-1">
                <span className="block text-sm text-muted">{label}</span>
                <input type="time" value={s[k]} onChange={(e) => set(k, e.target.value)} className="w-full bg-transparent font-display text-xl font-semibold outline-none" />
              </span>
            </label>
          ))}
        </div>
        <Slider label="Focus goal" value={s.focusGoalMinutes} min={30} max={720} step={30} show={formatMinutes(s.focusGoalMinutes)} onChange={(v) => set("focusGoalMinutes", v)} />
        <Slider label="Water goal" value={s.waterGoal} min={4} max={15} step={1} show={`${s.waterGoal} glasses`} onChange={(v) => set("waterGoal", v)} />
        <Slider label="Move goal" value={s.moveGoalMinutes} min={10} max={180} step={5} show={formatMinutes(s.moveGoalMinutes)} onChange={(v) => set("moveGoalMinutes", v)} />
        <Slider label="Steps goal" value={s.stepsGoal} min={2000} max={30000} step={500} show={s.stepsGoal.toLocaleString("en-IN")} onChange={(v) => set("stepsGoal", v)} />
      </Section>

      {/* ---------- Profile ---------- */}
      <Section title="Profile">
        <label className="block">
          <span className="text-sm font-semibold">Name</span>
          <input
            value={s.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            maxLength={60}
            className="mt-1.5 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base outline-none focus:border-violet focus:ring-4 focus:ring-violet/20"
          />
        </label>
        <p className="mt-5 text-sm font-semibold">Buddy</p>
        <div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-12">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => set("avatar", a)}
              aria-label={`Avatar ${a}`}
              aria-pressed={s.avatar === a}
              className={`grid aspect-square place-items-center rounded-2xl text-2xl transition ${s.avatar === a ? "bg-violet/20 ring-2 ring-violet" : "bg-surface ring-1 ring-line"}`}
            >
              {a}
            </button>
          ))}
        </div>
      </Section>

      {/* ---------- Save bar ---------- */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-surface-strong p-3 pl-5 shadow-2xl ring-1 ring-line"
          >
            <Bell size={18} className="text-violet" />
            <span className="flex-1 text-sm font-semibold">You have unsaved changes</span>
            <button onClick={() => setS(initial)} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted hover:text-ink">
              Undo
            </button>
            <button onClick={save} disabled={saving} className="flex h-10 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-semibold text-white disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />} Save
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={`fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-surface-strong px-5 py-3 text-sm font-semibold shadow-2xl ring-1 ${toast.tone === "error" ? "text-rose ring-rose/30" : "ring-mint/40"}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className="glass mt-6 rounded-[32px] p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      <div className="mt-5 space-y-3">{children}</div>
    </section>
  );
}

function Row({ icon, title, text, control, children }: { icon: React.ReactNode; title: string; text: string; control?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="flex items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-strong text-muted">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted">{text}</span>
        </span>
        {control}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-mint" : "bg-line"}`}>
      <motion.span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow" initial={false} animate={{ left: on ? 24 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
    </button>
  );
}

function TestButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-violet ring-1 ring-violet/40 transition hover:bg-violet/10">
      <Play size={13} fill="currentColor" /> Test
    </button>
  );
}

function Slider({ label, value, min, max, step, show, onChange }: { label: string; value: number; min: number; max: number; step: number; show: string; onChange: (v: number) => void }) {
  return (
    <label className="block rounded-2xl bg-surface p-4 ring-1 ring-line">
      <span className="flex justify-between">
        <span className="font-semibold">{label}</span>
        <span className="font-display font-bold tabular-nums text-violet">{show}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-[var(--violet)]" />
    </label>
  );
}
