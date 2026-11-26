"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { CHEER_EMOJI } from "@/lib/progress";
import { loadSocial, type Social } from "@/lib/social-server";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
type SocialResult = ({ ok: true; message?: string } & Social) | Fail;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function me() {
  const { supabase, user } = await getCurrentUser();
  return user ? { supabase, userId: user.id } : null;
}

const MESSAGES: Record<string, { ok: boolean; text: string }> = {
  sent: { ok: true, text: "Request sent. You'll see them here once they accept." },
  accepted: { ok: true, text: "They'd already asked you, so you're friends now 🎉" },
  pending: { ok: false, text: "You've already sent them a request." },
  already: { ok: false, text: "You're already friends." },
  not_found: { ok: false, text: "No one has that username. Check the spelling with your friend." },
  self: { ok: false, text: "That's your own username." },
  limit: { ok: false, text: "You have 20 requests waiting. Wait for some to be accepted first." },
  logged_out: { ok: false, text: "You're logged out. Log in again." },
};

export async function addFriend(username: string): Promise<SocialResult> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const name = username.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(name)) return fail("Usernames are 3 to 20 letters, numbers or underscores.");
  const { data, error } = await m.supabase.rpc("send_friend_request", { name });
  if (error) return fail("Couldn't send the request. Try again.");
  const msg = MESSAGES[data as string] ?? { ok: false, text: "Couldn't send the request. Try again." };
  if (!msg.ok) return fail(msg.text);
  return { ok: true, message: msg.text, ...(await loadSocial(m.supabase)) };
}

export async function acceptFriend(other: string): Promise<SocialResult> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  if (!UUID.test(other)) return fail("That request isn't valid.");
  const { data, error } = await m.supabase
    .from("friendships")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("requester", other)
    .eq("addressee", m.userId)
    .select("requester");
  if (error || !data?.length) return fail("Couldn't accept. The request may have been cancelled.");
  return { ok: true, message: "You're friends now 🎉", ...(await loadSocial(m.supabase)) };
}

/** Declines, cancels or unfriends: removes the connection either way round. */
export async function removeFriend(other: string): Promise<SocialResult> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  if (!UUID.test(other)) return fail("That isn't valid.");
  const { error } = await m.supabase.from("friendships").delete().or(`and(requester.eq.${m.userId},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${m.userId})`);
  if (error) return fail("Couldn't remove that. Try again.");
  return { ok: true, ...(await loadSocial(m.supabase)) };
}

export async function sendCheer(to: string, emoji: string): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  if (!UUID.test(to) || !(CHEER_EMOJI as readonly string[]).includes(emoji)) return fail("That cheer isn't valid.");
  const { error } = await m.supabase.from("cheers").insert({ to_user: to, emoji });
  if (error?.code === "23505") return fail("You've already cheered them today. Try again tomorrow.");
  if (error) return fail("Couldn't send the cheer. You can only cheer friends.");
  return { ok: true };
}

export async function markCheersSeen(): Promise<void> {
  const m = await me();
  if (!m) return;
  await m.supabase.from("cheers").update({ seen_at: new Date().toISOString() }).eq("to_user", m.userId).is("seen_at", null);
}
