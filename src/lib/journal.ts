// Shared journal rules: the entry shape, prompts, word counts and the writing streak.
import { addDays } from "@/lib/day";

export type JournalEntry = {
  day: string;
  gratitude: string[];
  win: string | null;
  lesson: string | null;
  tomorrow: string | null;
  prompt: string | null;
  body: string | null;
  tags: string[];
  words: number;
  starred: boolean;
  updated_at?: string;
};

/** What the page knows about each past day: mood and the one-liner live on the day log. */
export type DayMood = { day: string; mood: number | null; note: string | null };

export const JOURNAL_COLS =
  "day, gratitude, win, lesson, tomorrow, prompt, body, tags, words, starred, updated_at";

export const blankEntry = (day: string): JournalEntry => ({
  day,
  gratitude: ["", "", ""],
  win: null,
  lesson: null,
  tomorrow: null,
  prompt: null,
  body: null,
  tags: [],
  words: 0,
  starred: false,
});

export const MOODS = [
  { v: 1, emoji: "😫", label: "Rough", color: "var(--rose)" },
  { v: 2, emoji: "😕", label: "Low", color: "var(--amber)" },
  { v: 3, emoji: "😐", label: "Okay", color: "var(--muted)" },
  { v: 4, emoji: "🙂", label: "Good", color: "var(--cyan)" },
  { v: 5, emoji: "🤩", label: "Great", color: "var(--mint)" },
];

export const PROMPTS = [
  "What took most of your energy today, and was it worth it?",
  "What's one thing you learned today that you didn't know yesterday?",
  "When did you feel most focused today? What helped?",
  "What did you avoid today, and why?",
  "Who made your day a little better?",
  "What would you tell yourself from this morning?",
  "What's worrying you right now? Write it down and leave it here.",
  "What small thing are you proud of?",
  "If today repeated for a month, where would you end up?",
  "What distracted you the most today?",
  "What's one habit you want to start, and what's stopping you?",
  "Describe a moment today you want to remember.",
  "What's one thing you'd do differently if you restarted today?",
  "What does a perfect productive day look like for you?",
  "What are you looking forward to this week?",
  "Where did your time go today? Be honest.",
  "What is one fear about your goal, and one answer to it?",
  "What would make tomorrow 1% better than today?",
  "What did your body need today? Did you give it that?",
  "Which task have you been putting off? Write the very first step.",
  "What's something you changed your mind about recently?",
  "Write about a skill you're building. How far have you come?",
  "What made you laugh today?",
  "If your future self read this, what would you want them to know?",
  "What are three things that went right today, however small?",
  "What drained you today? What refilled you?",
  "What would you do this week if you weren't afraid of failing?",
  "Who do you want to become this year? What did today add to that?",
  "Write a short thank-you note to someone (you don't have to send it).",
  "What's one thing you need to let go of?",
];

/** The prompt for a day stays the same all day, so it doesn't change on reload. */
export function promptFor(day: string, shift = 0) {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PROMPTS[(h + shift) % PROMPTS.length];
}

export function countWords(...parts: (string | null | undefined)[]) {
  return parts.reduce(
    (n, p) => n + (p?.trim() ? p.trim().split(/\s+/).length : 0),
    0,
  );
}

export function entryWords(
  e: Pick<JournalEntry, "gratitude" | "win" | "lesson" | "tomorrow" | "body">,
) {
  return countWords(...e.gratitude, e.win, e.lesson, e.tomorrow, e.body);
}

export function hasContent(
  e: Pick<JournalEntry, "gratitude" | "win" | "lesson" | "tomorrow" | "body">,
) {
  return entryWords(e) > 0;
}

/** Days in a row with something written (an entry or the one-liner), counting back from today.
 *  An empty today doesn't break the streak until the day is over. */
export function writingStreak(written: Set<string>, today: string) {
  let day = written.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (written.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function cleanTag(t: string) {
  return t
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

/** A readable copy of all entries, for the Export button. */
export function toMarkdown(
  entries: JournalEntry[],
  moods: Map<string, DayMood>,
) {
  const fmt = (d: string) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${d}T12:00:00Z`));
  const out = ["# My LockIn journal", ""];
  for (const e of [...entries].sort((a, b) => (a.day < b.day ? 1 : -1))) {
    const m = moods.get(e.day);
    const mood = MOODS.find((x) => x.v === m?.mood);
    out.push(
      `## ${fmt(e.day)}${mood ? ` ${mood.emoji}` : ""}${e.starred ? " ⭐" : ""}`,
      "",
    );
    if (m?.note) out.push(`> ${m.note}`, "");
    const g = e.gratitude.filter((x) => x.trim());
    if (g.length) out.push("**Good things**", ...g.map((x) => `- ${x}`), "");
    if (e.win) out.push(`**Win:** ${e.win}`, "");
    if (e.lesson) out.push(`**Would do differently:** ${e.lesson}`, "");
    if (e.tomorrow) out.push(`**Tomorrow:** ${e.tomorrow}`, "");
    if (e.body) out.push(e.prompt ? `*${e.prompt}*` : "", "", e.body, "");
    if (e.tags.length) out.push(e.tags.map((t) => `#${t}`).join(" "), "");
  }
  return out.join("\n");
}
