"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { USER_FILTERS, type AdminUser, type Announcement, type UserDetail, type UserFilter } from "@/lib/admin";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 25;

/** Every action checks here first; the database functions check again. */
async function admin() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || profile?.role !== "admin") return null;
  return { supabase, userId: user.id };
}
const DENIED = fail("Only admins can do that.");

export async function listUsers(q: string, filter: UserFilter, page: number): Promise<{ ok: true; users: AdminUser[]; total: number } | Fail> {
  const a = await admin();
  if (!a) return DENIED;
  const f = USER_FILTERS.some((x) => x.id === filter) ? filter : "all";
  const { data, error } = await a.supabase.rpc("admin_users", { q: q.trim().slice(0, 80), filter: f, lim: PAGE, off: Math.max(0, page) * PAGE });
  if (error) return fail("Couldn't load people. Try again.");
  const users = (data ?? []) as AdminUser[];
  return { ok: true, users, total: users[0]?.total ?? 0 };
}

export async function userDetail(id: string): Promise<{ ok: true; detail: UserDetail } | Fail> {
  const a = await admin();
  if (!a) return DENIED;
  if (!UUID.test(id)) return fail("That person isn't valid.");
  const { data, error } = await a.supabase.rpc("admin_user_detail", { uid: id });
  if (error || !data) return fail("Couldn't load their details.");
  return { ok: true, detail: data as UserDetail };
}

const ROLE_MSG: Record<string, string> = {
  self: "You can't remove your own admin rights. Ask another admin.",
  unchanged: "Nothing changed.",
  bad_role: "That role isn't valid.",
};

export async function setRole(id: string, role: "user" | "admin"): Promise<{ ok: true } | Fail> {
  const a = await admin();
  if (!a) return DENIED;
  if (!UUID.test(id)) return fail("That person isn't valid.");
  const { data, error } = await a.supabase.rpc("admin_set_role", { uid: id, new_role: role });
  if (error) return fail("Couldn't change their role.");
  if (data !== "ok") return fail(ROLE_MSG[data as string] ?? "Couldn't change their role.");
  revalidatePath("/admin");
  return { ok: true };
}

const PAUSE_MSG: Record<string, string> = {
  self: "You can't pause your own account.",
  admin: "Remove their admin rights before pausing an admin.",
  not_found: "That person no longer exists.",
};

export async function setSuspended(id: string, suspend: boolean, reason: string): Promise<{ ok: true } | Fail> {
  const a = await admin();
  if (!a) return DENIED;
  if (!UUID.test(id)) return fail("That person isn't valid.");
  const { data, error } = await a.supabase.rpc("admin_set_suspended", { uid: id, suspend, reason: reason.trim().slice(0, 300) || null });
  if (error) return fail("Couldn't change their account.");
  if (data !== "ok") return fail(PAUSE_MSG[data as string] ?? "Couldn't change their account.");
  revalidatePath("/admin");
  return { ok: true };
}

export async function resolveFeedback(id: string, done: boolean): Promise<{ ok: true } | Fail> {
  const a = await admin();
  if (!a) return DENIED;
  if (!UUID.test(id)) return fail("That feedback isn't valid.");
  const { error } = await a.supabase
    .from("feedback")
    .update({ status: done ? "done" : "open", resolved_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return fail("Couldn't update the feedback.");
  revalidatePath("/admin");
  return { ok: true };
}

export type AnnouncementInput = { title: string; body: string; tone: Announcement["tone"]; endsAt: string | null };

export async function postAnnouncement(input: AnnouncementInput): Promise<{ ok: true; item: Announcement } | Fail> {
  const a = await admin();
  if (!a) return DENIED;
  const title = input.title.trim().slice(0, 80);
  if (!title) return fail("Give the announcement a title.");
  const tone = ["info", "success", "warning"].includes(input.tone) ? input.tone : "info";
  const ends = input.endsAt && /^\d{4}-\d{2}-\d{2}$/.test(input.endsAt) ? `${input.endsAt}T23:59:59+05:30` : null;
  const { data, error } = await a.supabase
    .from("announcements")
    .insert({ title, body: input.body.trim().slice(0, 300) || null, tone, ends_at: ends })
    .select("id, title, body, tone, active, ends_at, created_at")
    .single<Announcement>();
  if (error || !data) return fail("Couldn't post the announcement.");
  revalidatePath("/admin");
  return { ok: true, item: data };
}

export async function setAnnouncementActive(id: string, active: boolean): Promise<{ ok: true } | Fail> {
  const a = await admin();
  if (!a) return DENIED;
  if (!UUID.test(id)) return fail("That announcement isn't valid.");
  const { error } = await a.supabase.from("announcements").update({ active }).eq("id", id);
  if (error) return fail("Couldn't change the announcement.");
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<{ ok: true } | Fail> {
  const a = await admin();
  if (!a) return DENIED;
  if (!UUID.test(id)) return fail("That announcement isn't valid.");
  const { error } = await a.supabase.from("announcements").delete().eq("id", id);
  if (error) return fail("Couldn't delete the announcement.");
  revalidatePath("/admin");
  return { ok: true };
}
