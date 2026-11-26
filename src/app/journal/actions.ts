"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { addDays, dayIn } from "@/lib/day";
import { saveToday } from "@/lib/day-server";
import {
  cleanTag,
  entryWords,
  JOURNAL_COLS,
  type JournalEntry,
} from "@/lib/journal";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type EntryInput = Pick<
  JournalEntry,
  | "day"
  | "gratitude"
  | "win"
  | "lesson"
  | "tomorrow"
  | "prompt"
  | "body"
  | "tags"
>;
export type EntryResult =
  { ok: true; entry: JournalEntry | null; score: number | null } | Fail;

async function me() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return null;
  return { supabase, userId: user.id, today: dayIn(profile.timezone) };
}

const text = (v: unknown, max: number) =>
  (typeof v === "string" ? v.trim().slice(0, max) : "") || null;

/** Journals can be written for today and filled in for any day in the past year, never the future. */
function dayOk(day: string, today: string) {
  return DATE.test(day) && day <= today && day >= addDays(today, -366);
}

/** Tells the day ring whether today has a journal entry. Returns the new score. */
async function markToday(written: boolean) {
  const res = await saveToday(() => ({ journaled: written }));
  return res.ok ? res.log.score : null;
}

export async function saveEntry(input: EntryInput): Promise<EntryResult> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again to save.");
  if (!dayOk(input.day, m.today))
    return fail("You can only write for today or a day in the past year.");

  const clean = {
    gratitude: (Array.isArray(input.gratitude) ? input.gratitude : [])
      .slice(0, 3)
      .map((g) => text(g, 200) ?? ""),
    win: text(input.win, 500),
    lesson: text(input.lesson, 500),
    tomorrow: text(input.tomorrow, 300),
    prompt: text(input.prompt, 200),
    body:
      typeof input.body === "string"
        ? input.body.slice(0, 20000).trimEnd() || null
        : null,
    tags: [
      ...new Set(
        (Array.isArray(input.tags) ? input.tags : [])
          .map(cleanTag)
          .filter(Boolean),
      ),
    ].slice(0, 8),
  };
  // Keep the three gratitude slots, but drop them entirely when all are empty
  if (clean.gratitude.every((g) => !g)) clean.gratitude = [];
  const words = Math.min(
    10000,
    entryWords({ ...clean, gratitude: clean.gratitude }),
  );

  if (words === 0) {
    // Nothing written: remove the entry rather than keeping an empty row (a star alone isn't an entry)
    const { error } = await m.supabase
      .from("journal_entries")
      .delete()
      .eq("user_id", m.userId)
      .eq("day", input.day);
    if (error)
      return fail("Couldn't save. Check your connection and try again.");
    return {
      ok: true,
      entry: null,
      score: input.day === m.today ? await markToday(false) : null,
    };
  }

  const { data, error } = await m.supabase
    .from("journal_entries")
    .upsert(
      { user_id: m.userId, day: input.day, ...clean, words },
      { onConflict: "user_id,day" },
    )
    .select(JOURNAL_COLS)
    .single<JournalEntry>();
  if (error || !data)
    return fail("Couldn't save. Check your connection and try again.");
  return {
    ok: true,
    entry: data,
    score: input.day === m.today ? await markToday(true) : null,
  };
}

export async function setStar(
  day: string,
  starred: boolean,
): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  if (!DATE.test(day)) return fail("That day isn't valid.");
  const { data, error } = await m.supabase
    .from("journal_entries")
    .update({ starred })
    .eq("user_id", m.userId)
    .eq("day", day)
    .select("day");
  if (error) return fail("Couldn't save that. Try again.");
  if (!data?.length) return fail("Write something first, then star it.");
  return { ok: true };
}

export async function deleteEntry(
  day: string,
): Promise<{ ok: true; score: number | null } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  if (!DATE.test(day)) return fail("That day isn't valid.");
  const { error } = await m.supabase
    .from("journal_entries")
    .delete()
    .eq("user_id", m.userId)
    .eq("day", day);
  if (error) return fail("Couldn't delete the entry. Try again.");
  return { ok: true, score: day === m.today ? await markToday(false) : null };
}
