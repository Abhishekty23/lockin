import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { alertSetupFrom } from "@/lib/alerts";
import type { AdminUser, Announcement, AuditItem, Daily, FeedbackItem, Overview } from "@/lib/admin";
import AppHeader from "@/components/today/AppHeader";
import AdminBoard from "@/components/admin/AdminBoard";

export const metadata = { title: "Admin | LockIn" };

export default async function Page() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  // Not an admin: behave as if the page doesn't exist
  if (profile?.role !== "admin") notFound();

  const [overview, daily, users, feedback, announcements, audit] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_daily", { days: 30 }),
    supabase.rpc("admin_users", { q: "", filter: "all", lim: 25, off: 0 }),
    supabase.from("feedback").select("id, user_id, kind, message, page, status, created_at, resolved_at, profiles(full_name, username, avatar)").order("created_at", { ascending: false }).limit(100),
    supabase.from("announcements").select("id, title, body, tone, active, ends_at, created_at").order("created_at", { ascending: false }).limit(50),
    supabase
      .from("admin_audit")
      .select("id, action, detail, created_at, admin:profiles!admin_audit_admin_id_fkey(full_name, username, avatar), target:profiles!admin_audit_target_id_fkey(full_name, username, avatar)")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const userRows = (users.data ?? []) as AdminUser[];

  return (
    <div className="sky min-h-screen">
      <AppHeader name={profile.full_name ?? "You"} avatar={profile.avatar} email={user.email ?? ""} alerts={alertSetupFrom(profile)} isAdmin />
      <AdminBoard
        me={user.id}
        overview={overview.data as Overview}
        daily={(daily.data ?? []) as Daily[]}
        users={userRows}
        totalUsers={userRows[0]?.total ?? 0}
        feedback={(feedback.data ?? []) as unknown as FeedbackItem[]}
        announcements={(announcements.data ?? []) as Announcement[]}
        audit={(audit.data ?? []) as unknown as AuditItem[]}
      />
    </div>
  );
}
