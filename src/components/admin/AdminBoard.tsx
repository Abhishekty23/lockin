"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Loader2, Megaphone, Pause, Play, Search, Shield, ShieldOff, Trash2, X } from "lucide-react";
import { safe } from "@/lib/net";
import { formatMinutes } from "@/lib/day";
import { levelOf } from "@/lib/progress";
import { dateLabel } from "@/lib/insights";
import {
  describe,
  displayName,
  FEEDBACK_KINDS,
  TONES,
  USER_FILTERS,
  type AdminUser,
  type Announcement,
  type AuditItem,
  type Daily,
  type FeedbackItem,
  type Overview,
  type UserDetail,
  type UserFilter,
} from "@/lib/admin";
import { deleteAnnouncement, listUsers, postAnnouncement, resolveFeedback, setAnnouncementActive, setRole, setSuspended, userDetail } from "@/app/admin/actions";
import { BarChart, HBars } from "@/components/insights/Charts";

type Props = {
  me: string;
  overview: Overview;
  daily: Daily[];
  users: AdminUser[];
  totalUsers: number;
  feedback: FeedbackItem[];
  announcements: Announcement[];
  audit: AuditItem[];
};
type Tab = "overview" | "people" | "feedback" | "announcements" | "log";
type Flash = (text: string, tone?: "good" | "error") => void;

function ago(iso: string | null) {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
const n = (x: number) => x.toLocaleString("en-IN");

export default function AdminBoard(props: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<{ text: string; tone: "good" | "error" } | null>(null);
  const flash: Flash = (text, tone = "good") => setToast({ text, tone });
  const openFeedback = props.feedback.filter((f) => f.status === "open").length;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1) as Tab;
      setTab(["people", "feedback", "announcements", "log"].includes(h) ? h : "overview");
    };
    const t = setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "overview" ? location.pathname : `#${t}`);
  };

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "people", label: "People" },
    { id: "feedback", label: "Feedback", badge: openFeedback },
    { id: "announcements", label: "Announcements" },
    { id: "log", label: "Activity log" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-violet">
            <Shield size={15} /> Admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">LockIn at a glance</h1>
          <p className="mt-1.5 text-sm text-muted">Counts and summaries only. Journal entries stay private, even here.</p>
        </div>
      </div>

      <nav aria-label="Admin sections" className="-mx-4 mt-6 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t.id ? "bg-ink text-bg" : "text-muted ring-1 ring-line hover:text-ink"}`}
          >
            {t.label}
            {!!t.badge && <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[11px] text-white">{t.badge}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab o={props.overview} daily={props.daily} />}
        {tab === "people" && <PeopleTab me={props.me} initial={props.users} initialTotal={props.totalUsers} flash={flash} />}
        {tab === "feedback" && <FeedbackTab items={props.feedback} flash={flash} />}
        {tab === "announcements" && <AnnouncementsTab items={props.announcements} flash={flash} />}
        {tab === "log" && <LogTab items={props.audit} />}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className={`fixed bottom-24 left-1/2 z-[70] max-w-[90vw] -translate-x-1/2 rounded-2xl bg-surface-strong px-5 py-3 text-sm font-semibold shadow-2xl ring-1 lg:bottom-6 ${toast.tone === "error" ? "text-rose ring-rose/30" : "ring-mint/40"}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* =============================== Overview =============================== */
function OverviewTab({ o, daily }: { o: Overview; daily: Daily[] }) {
  const tick = (i: number, d: string) => ((daily.length - 1 - i) % 7 === 0 ? dateLabel(d) : undefined);
  const tiles = [
    { label: "People", value: n(o.users), sub: `+${o.new_7d} this week · ${o.onboarded} finished setup` },
    { label: "Active today", value: n(o.active_today), sub: `${o.active_7d} in the last 7 days` },
    { label: "Average day score", value: String(o.avg_score_7d), sub: "active days, last 7 days" },
    { label: "Focus logged", value: formatMinutes(o.focus_minutes), sub: `${n(o.sessions)} timer sessions` },
    { label: "Habit check-ins", value: n(o.habit_checks), sub: `${n(o.habits)} active habits` },
    { label: "Tasks finished", value: n(o.tasks_done), sub: "all time" },
    { label: "Journal entries", value: n(o.journal_entries), sub: "count only, text is private" },
    { label: "Friendships", value: n(o.friendships), sub: `${n(o.cheers)} cheers sent` },
  ];
  const alerts = Object.entries(o.alerts ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="glass rounded-[24px] p-4 sm:p-5">
            <p className="text-sm text-muted">{t.label}</p>
            <p className="mt-2 whitespace-nowrap font-display text-2xl font-bold tabular-nums sm:text-3xl">{t.value}</p>
            <p className="mt-1 text-xs text-muted">{t.sub}</p>
          </div>
        ))}
      </div>
      {(o.feedback_open > 0 || o.suspended > 0) && (
        <p className="rounded-2xl bg-amber/10 px-4 py-3 text-sm ring-1 ring-amber/30">
          {o.feedback_open > 0 && <span>📬 {o.feedback_open} open feedback {o.feedback_open === 1 ? "message" : "messages"}. </span>}
          {o.suspended > 0 && <span>⏸️ {o.suspended} paused {o.suspended === 1 ? "account" : "accounts"}.</span>}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Card title="Sign-ups" note={`${o.new_30d} in the last 30 days`}>
          <BarChart label="Sign-ups each day" color="var(--cyan)" height={150} points={daily.map((d, i) => ({ key: d.day, value: d.signups, tick: tick(i, d.day), tip: `${dateLabel(d.day)}: ${d.signups} sign-ups` }))} />
        </Card>
        <Card title="Active people" note="People with a day score above 0">
          <BarChart label="Active people each day" color="var(--violet)" height={150} points={daily.map((d, i) => ({ key: d.day, value: d.active, tick: tick(i, d.day), tip: `${dateLabel(d.day)}: ${d.active} active` }))} />
        </Card>
        <Card title="Focus across LockIn" note="Minutes logged by everyone, each day">
          <BarChart
            label="Focus minutes each day"
            color="var(--amber)"
            height={150}
            format={(v) => (v >= 60 ? `${Math.round(v / 6) / 10}h` : `${v}m`)}
            points={daily.map((d, i) => ({ key: d.day, value: d.focus_minutes, tick: tick(i, d.day), tip: `${dateLabel(d.day)}: ${formatMinutes(d.focus_minutes)}` }))}
          />
        </Card>
        <Card title="Reminders" note="How often each reminder has shown, all time">
          {alerts.length ? (
            <HBars color="var(--rose)" rows={alerts.map(([k, v]) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), value: v, text: n(v) }))} />
          ) : (
            <p className="text-sm text-muted">No reminders have fired yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass min-w-0 rounded-[28px] p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* =============================== People =============================== */
function PeopleTab({ me, initial, initialTotal, flash }: { me: string; initial: AdminUser[]; initialTotal: number; flash: Flash }) {
  const [users, setUsers] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<AdminUser | null>(null);
  const first = useRef(true);

  async function load(nq = q, nf = filter, np = page) {
    setLoading(true);
    const res = await safe(listUsers(nq, nf, np));
    setLoading(false);
    if (!res.ok) return flash(res.error, "error");
    setUsers(res.users);
    setTotal(res.total);
  }

  // Search as you type, after a short pause
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      setPage(0);
      void load(q, filter, 0);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter]);

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <section className="glass rounded-[28px] p-5 sm:p-6" aria-label="People">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="Search by name, username or email"
            aria-label="Search people"
            className="h-11 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-violet"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {USER_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f.id ? "bg-violet text-white" : "text-muted ring-1 ring-line hover:text-ink"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-muted" />}
      </div>

      <p className="mt-4 text-xs text-muted">
        {n(total)} {total === 1 ? "person" : "people"}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {users.map((u) => (
          <li key={u.id}>
            <button onClick={() => setOpen(u)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition hover:bg-surface">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-strong text-2xl ring-1 ring-line">{u.avatar}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-semibold">{u.full_name || "No name yet"}</span>
                  {u.role === "admin" && <Badge color="var(--violet)">Admin</Badge>}
                  {u.suspended_at && <Badge color="var(--amber)">Paused</Badge>}
                  {!u.onboarded && <Badge color="var(--muted)">Setting up</Badge>}
                  {u.id === me && <Badge color="var(--cyan)">You</Badge>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {u.username ? `@${u.username} · ` : ""}
                  {u.email}
                </span>
              </span>
              <span className="hidden shrink-0 text-right text-xs text-muted sm:block">
                <span className="block">Joined {ago(u.created_at)}</span>
                <span className="block">Active {u.last_active ? dateLabel(u.last_active) : "not yet"}</span>
              </span>
              <span className="hidden w-24 shrink-0 text-right text-xs md:block">
                <span className="block font-semibold">🔥 {u.current_streak}</span>
                <span className="block text-muted">{u.days_logged} days logged</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
        {users.length === 0 && <li className="py-8 text-center text-sm text-muted">No one matches.</li>}
      </ul>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button
            onClick={() => {
              setPage(page - 1);
              void load(q, filter, page - 1);
            }}
            disabled={page === 0}
            aria-label="Previous page"
            className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-line disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="tabular-nums text-muted">
            {page + 1} / {pages}
          </span>
          <button
            onClick={() => {
              setPage(page + 1);
              void load(q, filter, page + 1);
            }}
            disabled={page + 1 >= pages}
            aria-label="Next page"
            className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-line disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <PersonDrawer
            key={open.id}
            user={open}
            isMe={open.id === me}
            onClose={() => setOpen(null)}
            flash={flash}
            onChanged={(u) => {
              setUsers((xs) => xs.map((x) => (x.id === u.id ? u : x)));
              setOpen(u);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
      {children}
    </span>
  );
}

function PersonDrawer({ user, isMe, onClose, onChanged, flash }: { user: AdminUser; isMe: boolean; onClose: () => void; onChanged: (u: AdminUser) => void; flash: Flash }) {
  const router = useRouter();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "admin" | "unadmin" | "pause">(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let live = true;
    void safe(userDetail(user.id)).then((r) => {
      if (!live) return;
      if (r.ok) setDetail(r.detail);
      else {
        setFailed(true);
        flash(r.error, "error");
      }
    });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      live = false;
      window.removeEventListener("keydown", esc);
    };
  }, [user.id, onClose, flash]);

  async function act(kind: "admin" | "unadmin" | "pause" | "restore") {
    setBusy(true);
    const res = await safe(
      kind === "admin" ? setRole(user.id, "admin") : kind === "unadmin" ? setRole(user.id, "user") : setSuspended(user.id, kind === "pause", reason),
    );
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return flash(res.error, "error");
    const name = user.full_name || "them";
    const next: AdminUser =
      kind === "admin" || kind === "unadmin"
        ? { ...user, role: kind === "admin" ? "admin" : "user" }
        : { ...user, suspended_at: kind === "pause" ? new Date().toISOString() : null, suspended_reason: kind === "pause" ? reason || null : null };
    onChanged(next);
    setReason("");
    flash(
      kind === "admin" ? `${name} is now an admin.` : kind === "unadmin" ? `${name} is no longer an admin.` : kind === "pause" ? `${name}'s account is paused.` : `${name}'s account is restored.`,
    );
    router.refresh();
  }

  const lvl = levelOf(detail?.total_xp ?? 0);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`${user.full_name ?? "Person"} details`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col overflow-y-auto bg-bg-2 p-6 shadow-2xl ring-1 ring-line"
      >
        <div className="flex items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-surface-strong text-4xl ring-1 ring-line">{user.avatar}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl font-bold">{user.full_name || "No name yet"}</h2>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <p className="truncate text-sm text-muted">{user.username ? `@${user.username}` : "No username"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user.role === "admin" && <Badge color="var(--violet)">Admin</Badge>}
              {user.suspended_at && <Badge color="var(--amber)">Paused {ago(user.suspended_at)}</Badge>}
              {isMe && <Badge color="var(--cyan)">You</Badge>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl ring-1 ring-line">
            <X size={18} />
          </button>
        </div>

        {user.suspended_reason && <p className="mt-4 rounded-2xl bg-amber/10 px-4 py-3 text-sm ring-1 ring-amber/30">Reason: {user.suspended_reason}</p>}

        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
          <Stat label="Joined" value={ago(user.created_at)} />
          <Stat label="Last sign-in" value={ago(user.last_sign_in_at)} />
          <Stat label="Streak" value={detail ? `🔥 ${detail.streak.current_streak} (best ${detail.streak.best_streak})` : failed ? "–" : "…"} />
          <Stat label="Level" value={detail ? `${lvl.rankEmoji} ${lvl.level} · ${n(detail.total_xp)} XP` : failed ? "–" : "…"} />
          <Stat label="Focus" value={detail ? `${formatMinutes(detail.focus_minutes)} · ${detail.sessions} sessions` : failed ? "–" : "…"} />
          <Stat label="Habits / tasks done" value={detail ? `${detail.habits} / ${n(detail.tasks_done)}` : failed ? "–" : "…"} />
          <Stat label="Journal entries" value={detail ? `${detail.journal_entries} (text private)` : failed ? "–" : "…"} />
          <Stat label="Friends · feedback" value={detail ? `${detail.friends} · ${detail.feedback}` : failed ? "–" : "…"} />
        </dl>

        <div className="mt-5">
          <p className="text-sm font-semibold">Day score, last 30 days</p>
          <div className="mt-3">
            {detail ? (
              <BarChart
                label="Day score, last 30 days"
                color="var(--violet)"
                max={100}
                height={100}
                points={detail.scores.map((s, i) => ({ key: s.day, value: s.score, tick: i % 10 === 0 ? dateLabel(s.day) : undefined, tip: `${dateLabel(s.day)}: ${s.score}`, highlight: s.score >= 100 }))}
              />
            ) : (
              <div className="grid h-24 place-items-center text-sm text-muted">{failed ? "Couldn't load their details. Close and try again." : <Loader2 size={18} className="animate-spin" />}</div>
            )}
          </div>
          {detail && <p className="mt-2 text-xs text-muted">Time zone: {detail.timezone}</p>}
        </div>

        <div className="mt-auto pt-6">
          {isMe ? (
            <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted ring-1 ring-line">This is you. You can&apos;t remove your own admin rights or pause your own account.</p>
          ) : confirm ? (
            <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
              <p className="font-semibold">
                {confirm === "admin" ? "Make them an admin?" : confirm === "unadmin" ? "Remove their admin rights?" : "Pause this account?"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {confirm === "admin"
                  ? "Admins can see everyone's summaries, pause accounts and post announcements."
                  : confirm === "unadmin"
                    ? "They'll lose access to this panel straight away."
                    : "They'll see a paused screen and won't be able to read or change their data until you restore the account. Nothing is deleted."}
              </p>
              {confirm === "pause" && (
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="Reason they'll see (optional)"
                  className="mt-3 w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-violet"
                />
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setConfirm(null)} className="rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-line">
                  Cancel
                </button>
                <button
                  onClick={() => act(confirm)}
                  disabled={busy}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${confirm === "pause" || confirm === "unadmin" ? "bg-rose" : "bg-violet"}`}
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {confirm === "admin" ? "Make admin" : confirm === "unadmin" ? "Remove admin" : "Pause account"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {user.role === "admin" ? (
                <button onClick={() => setConfirm("unadmin")} className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-line hover:bg-surface">
                  <ShieldOff size={16} /> Remove admin
                </button>
              ) : (
                <button onClick={() => setConfirm("admin")} className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-line hover:bg-surface">
                  <Shield size={16} /> Make admin
                </button>
              )}
              {user.suspended_at ? (
                <button onClick={() => act("restore")} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Restore account
                </button>
              ) : (
                <button
                  onClick={() => setConfirm("pause")}
                  disabled={user.role === "admin"}
                  title={user.role === "admin" ? "Remove admin rights first" : undefined}
                  className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-rose ring-1 ring-rose/30 hover:bg-rose/10 disabled:opacity-40"
                >
                  <Pause size={16} /> Pause account
                </button>
              )}
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold">{value}</dd>
    </div>
  );
}

/* =============================== Feedback =============================== */
function FeedbackTab({ items: initial, flash }: { items: FeedbackItem[]; flash: Flash }) {
  const [items, setItems] = useState(initial);
  const [show, setShow] = useState<"open" | "done" | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const list = items.filter((f) => show === "all" || f.status === show);

  async function toggle(f: FeedbackItem) {
    setBusy(f.id);
    const done = f.status === "open";
    const res = await safe(resolveFeedback(f.id, done));
    setBusy(null);
    if (!res.ok) return flash(res.error, "error");
    setItems((xs) => xs.map((x) => (x.id === f.id ? { ...x, status: done ? "done" : "open", resolved_at: done ? new Date().toISOString() : null } : x)));
    flash(done ? "Marked as done." : "Reopened.");
  }

  return (
    <section className="glass rounded-[28px] p-5 sm:p-6" aria-label="Feedback">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Feedback inbox</h2>
          <p className="text-sm text-muted">Sent from &ldquo;Send feedback&rdquo; in everyone&apos;s account menu.</p>
        </div>
        <div className="flex rounded-full bg-surface p-1 text-xs ring-1 ring-line">
          {(["open", "done", "all"] as const).map((k) => (
            <button key={k} onClick={() => setShow(k)} aria-pressed={show === k} className={`rounded-full px-3 py-1.5 font-semibold capitalize ${show === k ? "bg-ink text-bg" : "text-muted"}`}>
              {k} ({k === "all" ? items.length : items.filter((x) => x.status === k).length})
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {list.map((f) => {
          const kind = FEEDBACK_KINDS.find((k) => k.id === f.kind) ?? FEEDBACK_KINDS[3];
          return (
            <li key={f.id} className={`rounded-2xl p-4 ring-1 ${f.status === "open" ? "bg-surface ring-line" : "ring-line opacity-70"}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{kind.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-[15px]">{f.message}</p>
                  <p className="mt-2 text-xs text-muted">
                    {f.profiles?.avatar} {displayName(f.profiles)} · {kind.label} · {ago(f.created_at)}
                    {f.page ? ` · from ${f.page}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => toggle(f)}
                  disabled={busy === f.id}
                  className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60 ${f.status === "open" ? "bg-mint text-white" : "ring-1 ring-line"}`}
                >
                  {f.status === "open" ? "Mark done" : "Reopen"}
                </button>
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className="py-8 text-center text-sm text-muted">{show === "open" ? "Inbox zero. Nothing waiting. 🎉" : "Nothing here."}</li>}
      </ul>
    </section>
  );
}

/* =============================== Announcements =============================== */
function AnnouncementsTab({ items: initial, flash }: { items: Announcement[]; flash: Flash }) {
  const [items, setItems] = useState(initial);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<Announcement["tone"]>("info");
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const color = TONES.find((t) => t.id === tone)?.color ?? "var(--violet)";

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy("post");
    const res = await safe(postAnnouncement({ title, body, tone, endsAt: ends || null }));
    setBusy(null);
    if (!res.ok) return flash(res.error, "error");
    setItems((xs) => [res.item, ...xs]);
    setTitle("");
    setBody("");
    setEnds("");
    flash("Posted. Everyone sees it at the top of their pages.");
  }
  async function toggle(a: Announcement) {
    setBusy(a.id);
    const res = await safe(setAnnouncementActive(a.id, !a.active));
    setBusy(null);
    if (!res.ok) return flash(res.error, "error");
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)));
  }
  async function remove(id: string) {
    setBusy(id);
    const res = await safe(deleteAnnouncement(id));
    setBusy(null);
    setConfirmDel(null);
    if (!res.ok) return flash(res.error, "error");
    setItems((xs) => xs.filter((x) => x.id !== id));
    flash("Deleted.");
  }
  const live = (a: Announcement) => a.active && (!a.ends_at || new Date(a.ends_at) > new Date());

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] [&>*]:min-w-0">
      <section className="glass rounded-[28px] p-5 sm:p-6" aria-label="New announcement">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Megaphone size={18} className="text-violet" /> New announcement
        </h2>
        <form onSubmit={post} className="mt-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Title, e.g. New: Journal is here" aria-label="Title" className="h-12 w-full rounded-2xl border border-line bg-surface px-4 outline-none focus:border-violet" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} rows={3} placeholder="A short message (optional)" aria-label="Message" className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-violet" />
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTone(t.id)}
                aria-pressed={tone === t.id}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${tone === t.id ? "ring-2" : "ring-line text-muted"}`}
                style={tone === t.id ? { color: t.color, boxShadow: `inset 0 0 0 2px ${t.color}` } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="font-semibold">Hide after (optional)</span>
            <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-line bg-surface px-4 outline-none focus:border-violet" />
          </label>
          {title.trim() && (
            <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)` }}>
              <p className="text-xs font-semibold text-muted">Preview</p>
              <p className="mt-1 font-semibold">{title}</p>
              {body.trim() && <p className="text-muted">{body}</p>}
            </div>
          )}
          <button disabled={busy === "post" || !title.trim()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet font-semibold text-white disabled:opacity-50">
            {busy === "post" && <Loader2 size={16} className="animate-spin" />} Post to everyone
          </button>
        </form>
      </section>

      <section className="glass rounded-[28px] p-5 sm:p-6" aria-label="Announcements">
        <h2 className="font-display text-lg font-bold">All announcements</h2>
        <ul className="mt-4 space-y-3">
          {items.map((a) => {
            const t = TONES.find((x) => x.id === a.tone) ?? TONES[0];
            return (
              <li key={a.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.title}</p>
                    {a.body && <p className="text-sm text-muted">{a.body}</p>}
                    <p className="mt-1.5 text-xs text-muted">
                      {live(a) ? "🟢 Showing now" : a.active ? "Ended" : "Hidden"} · posted {ago(a.created_at)}
                      {a.ends_at ? ` · until ${dateLabel(a.ends_at.slice(0, 10))}` : ""}
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={a.active}
                    aria-label={a.active ? "Hide announcement" : "Show announcement"}
                    onClick={() => toggle(a)}
                    disabled={busy === a.id}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${a.active ? "bg-mint" : "bg-line"}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${a.active ? "left-6" : "left-1"}`} />
                  </button>
                  {confirmDel === a.id ? (
                    <button onClick={() => remove(a.id)} className="shrink-0 rounded-xl bg-rose px-3 py-1.5 text-xs font-semibold text-white">
                      Delete?
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDel(a.id)} aria-label="Delete announcement" className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-muted ring-1 ring-line hover:text-rose">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {items.length === 0 && <li className="py-8 text-center text-sm text-muted">Nothing posted yet.</li>}
        </ul>
      </section>
    </div>
  );
}

/* =============================== Activity log =============================== */
function LogTab({ items }: { items: AuditItem[] }) {
  return (
    <section className="glass rounded-[28px] p-5 sm:p-6" aria-label="Activity log">
      <h2 className="font-display text-lg font-bold">Activity log</h2>
      <p className="text-sm text-muted">Every admin action is recorded here and can&apos;t be edited.</p>
      <ul className="mt-5 space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-3 rounded-2xl p-3 text-sm ring-1 ring-line">
            <span className="text-xl">{a.admin?.avatar ?? "🛡️"}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{displayName(a.admin)}</span> {describe(a)}
            </span>
            <span className="shrink-0 text-xs text-muted">{ago(a.created_at)}</span>
          </li>
        ))}
        {items.length === 0 && <li className="py-8 text-center text-sm text-muted">No admin actions yet.</li>}
      </ul>
    </section>
  );
}
