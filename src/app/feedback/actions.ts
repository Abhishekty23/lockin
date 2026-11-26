"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { FEEDBACK_KINDS } from "@/lib/admin";

// Anyone signed in can send feedback (up to 10 a day, enforced by the database).
export async function sendFeedback(kind: string, message: string, page: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return { ok: false, error: "You're logged out. Log in again." };
  const text = message.trim().slice(0, 2000);
  if (text.length < 3) return { ok: false, error: "Write a little more so we know what you mean." };
  const k = FEEDBACK_KINDS.some((x) => x.id === kind) ? kind : "other";
  const { error } = await supabase.from("feedback").insert({ kind: k, message: text, page: page.slice(0, 120) || null });
  if (error) return { ok: false, error: "Couldn't send it. You can send up to 10 messages a day." };
  return { ok: true };
}
