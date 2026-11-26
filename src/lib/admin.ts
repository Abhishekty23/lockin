// Types and labels for the admin panel. All data comes from checked admin_* database functions.

export type Overview = {
  users: number;
  new_7d: number;
  new_30d: number;
  onboarded: number;
  admins: number;
  suspended: number;
  active_today: number;
  active_7d: number;
  focus_minutes: number;
  sessions: number;
  habits: number;
  habit_checks: number;
  tasks_done: number;
  journal_entries: number;
  friendships: number;
  cheers: number;
  avg_score_7d: number;
  feedback_open: number;
  alerts: Record<string, number>;
};

export type Daily = { day: string; signups: number; active: number; focus_minutes: number };

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar: string;
  role: "user" | "admin";
  onboarded: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  last_active: string | null;
  days_logged: number;
  focus_minutes: number;
  current_streak: number;
  suspended_at: string | null;
  suspended_reason: string | null;
  total: number;
};

export type UserDetail = {
  timezone: string;
  tracks: string[];
  scores: { day: string; score: number }[];
  streak: { current_streak: number; best_streak: number };
  total_xp: number;
  sessions: number;
  focus_minutes: number;
  habits: number;
  tasks_done: number;
  journal_entries: number;
  friends: number;
  feedback: number;
};

export type Person = { full_name: string | null; username: string | null; avatar: string } | null;

export type FeedbackItem = {
  id: string;
  user_id: string;
  kind: "idea" | "bug" | "love" | "other";
  message: string;
  page: string | null;
  status: "open" | "done";
  created_at: string;
  resolved_at: string | null;
  profiles: Person;
};

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  tone: "info" | "success" | "warning";
  active: boolean;
  ends_at: string | null;
  created_at: string;
};

export type AuditItem = {
  id: number;
  action: string;
  detail: Record<string, string | null>;
  created_at: string;
  admin: Person;
  target: Person;
};

export const USER_FILTERS = [
  { id: "all", label: "Everyone" },
  { id: "new", label: "New this week" },
  { id: "admins", label: "Admins" },
  { id: "suspended", label: "Paused" },
] as const;
export type UserFilter = (typeof USER_FILTERS)[number]["id"];

export const FEEDBACK_KINDS = [
  { id: "idea", emoji: "💡", label: "Idea" },
  { id: "bug", emoji: "🐞", label: "Something's broken" },
  { id: "love", emoji: "❤️", label: "Something I love" },
  { id: "other", emoji: "💬", label: "Other" },
] as const;

export const TONES = [
  { id: "info", label: "News", color: "var(--violet)" },
  { id: "success", label: "Good news", color: "var(--mint)" },
  { id: "warning", label: "Heads up", color: "var(--amber)" },
] as const;

export const displayName = (p: Person) => (p ? p.full_name || (p.username ? `@${p.username}` : "Someone") : "Someone");

/** "made Rohan an admin", "paused Priya's account"… for the activity log. */
export function describe(a: AuditItem) {
  const who = displayName(a.target);
  switch (a.action) {
    case "set_role":
      return a.detail.role === "admin" ? `made ${who} an admin` : `removed admin rights from ${who}`;
    case "suspend":
      return `paused ${who}'s account${a.detail.reason ? `: “${a.detail.reason}”` : ""}`;
    case "unsuspend":
      return `restored ${who}'s account`;
    case "announcements_insert":
      return `posted the announcement “${a.detail.title}”`;
    case "announcements_update":
      return `changed the announcement “${a.detail.title}”`;
    case "announcements_delete":
      return `deleted the announcement “${a.detail.title}”`;
    case "feedback_update":
      return a.detail.status === "done" ? "marked a piece of feedback as done" : "reopened a piece of feedback";
    default:
      return a.action.replace(/_/g, " ");
  }
}
