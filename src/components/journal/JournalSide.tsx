"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Search,
  Star,
} from "lucide-react";
import { addDays } from "@/lib/day";
import { MOODS, type DayMood, type JournalEntry } from "@/lib/journal";

type Props = {
  today: string;
  day: string;
  entries: Record<string, JournalEntry>;
  moods: Record<string, DayMood>;
  tags: string[];
  onOpen: (day: string) => void;
  onExport: () => void;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const utc = (d: string) => new Date(`${d}T12:00:00Z`);
const fmtShort = (d: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(utc(d));
const moodOf = (m?: DayMood) => MOODS.find((x) => x.v === m?.mood);

function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Same date in an earlier month or year, or null when it doesn't exist (e.g. 31 Feb). */
function sameDate(today: string, months: number) {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 - months, d, 12));
  return t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null;
}

function entryText(e: JournalEntry) {
  return [e.body, e.win, ...e.gratitude, e.lesson, e.tomorrow]
    .filter((x) => x?.trim())
    .join(" · ");
}

export default function JournalSide({
  today,
  day,
  entries,
  moods,
  tags,
  onOpen,
  onExport,
}: Props) {
  const list = useMemo(
    () => Object.values(entries).sort((a, b) => (a.day < b.day ? 1 : -1)),
    [entries],
  );

  return (
    <div className="space-y-5">
      <Calendar
        today={today}
        day={day}
        entries={entries}
        moods={moods}
        onOpen={onOpen}
      />
      <Finder list={list} moods={moods} tags={tags} onOpen={onOpen} />
      <OnThisDay today={today} entries={entries} onOpen={onOpen} />
      <button
        onClick={onExport}
        disabled={!list.length}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-muted ring-1 ring-line transition hover:text-ink disabled:opacity-40"
      >
        <Download size={16} /> Download my journal (.md)
      </button>
    </div>
  );
}

/* ---------- Month calendar ---------- */
function Calendar({
  today,
  day,
  entries,
  moods,
  onOpen,
}: Pick<Props, "today" | "day" | "entries" | "moods" | "onOpen">) {
  const [month, setMonth] = useState(day.slice(0, 7));
  const oldest = addDays(today, -366);
  const first = `${month}-01`;
  const lead = (utc(first).getUTCDay() + 6) % 7; // Monday first
  const length = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const cells = [
    ...Array(lead).fill(null),
    ...Array.from(
      { length },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
  const label = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc(first));
  const count = Object.keys(entries).filter((d) => d.startsWith(month)).length;

  return (
    <section className="glass rounded-[28px] p-5" aria-label="Calendar">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold">{label}</h2>
          <p className="text-xs text-muted">
            {count} {count === 1 ? "entry" : "entries"} this month
          </p>
        </div>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          disabled={first <= oldest.slice(0, 7) + "-01"}
          aria-label="Previous month"
          className="grid h-9 w-9 place-items-center rounded-xl text-muted ring-1 ring-line hover:text-ink disabled:opacity-30"
        >
          <ChevronLeft size={17} />
        </button>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={month >= today.slice(0, 7)}
          aria-label="Next month"
          className="grid h-9 w-9 place-items-center rounded-xl text-muted ring-1 ring-line hover:text-ink disabled:opacity-30"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span
            key={i}
            className="pb-1 text-[11px] font-semibold text-muted"
            aria-hidden
          >
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const e = entries[d];
          const m = moodOf(moods[d]);
          const noteOnly = !e && moods[d]?.note?.trim();
          const out = d > today || d < oldest;
          const sel = d === day;
          return (
            <button
              key={d}
              onClick={() => onOpen(d)}
              disabled={out}
              aria-label={`${fmtShort(d)}${e ? ", entry written" : noteOnly ? ", one line written" : ""}${m ? `, mood ${m.label}` : ""}`}
              aria-current={sel ? "date" : undefined}
              className={`relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl text-xs transition disabled:opacity-25 ${
                e ? "bg-rose/15" : "hover:bg-surface"
              } ${sel ? "ring-2 ring-violet" : ""} ${d === today ? "font-bold text-violet" : ""}`}
            >
              <span className={m ? "text-[10px] leading-none text-muted" : ""}>
                {Number(d.slice(8))}
              </span>
              {m && <span className="text-base leading-tight">{m.emoji}</span>}
              {noteOnly && !m && (
                <span className="mt-0.5 h-1 w-1 rounded-full bg-rose" />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-rose/30" /> Entry
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose" /> One line only
        </span>
        <span>🙂 Mood</span>
      </p>
    </section>
  );
}

/* ---------- Search, tags, starred and recent ---------- */
function Finder({
  list,
  moods,
  tags,
  onOpen,
}: {
  list: JournalEntry[];
  moods: Record<string, DayMood>;
  tags: string[];
  onOpen: (d: string) => void;
}) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const query = q.trim().toLowerCase();
  const searching = Boolean(query || tag);

  const results = searching
    ? list.filter(
        (e) =>
          (!tag || e.tags.includes(tag)) &&
          (!query ||
            `${entryText(e)} ${e.tags.join(" ")}`
              .toLowerCase()
              .includes(query)),
      )
    : [];
  const starred = list.filter((e) => e.starred);
  const recent = list.slice(0, 4);

  return (
    <section
      className="glass rounded-[28px] p-5"
      aria-label="Search your journal"
    >
      <label className="relative block">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Search your journal"
          aria-label="Search your journal"
          className="h-11 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-rose"
        />
      </label>
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 10).map((t) => (
            <button
              key={t}
              onClick={() => setTag((x) => (x === t ? null : t))}
              aria-pressed={tag === t}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${tag === t ? "bg-rose text-white" : "bg-surface text-muted ring-1 ring-line hover:text-ink"}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {searching ? (
        <Results
          title={`${results.length} ${results.length === 1 ? "entry" : "entries"} found`}
          items={results.slice(0, 20)}
          moods={moods}
          query={query}
          onOpen={onOpen}
          empty="Nothing matches. Try another word."
        />
      ) : list.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Your entries will show up here. Start with three good things from
          today.
        </p>
      ) : (
        <>
          {starred.length > 0 && (
            <Results
              title="Starred"
              icon={<Star size={13} className="fill-amber text-amber" />}
              items={starred.slice(0, 5)}
              moods={moods}
              query=""
              onOpen={onOpen}
            />
          )}
          <Results
            title="Recent"
            items={recent}
            moods={moods}
            query=""
            onOpen={onOpen}
          />
        </>
      )}
    </section>
  );
}

function Results({
  title,
  icon,
  items,
  moods,
  query,
  onOpen,
  empty,
}: {
  title: string;
  icon?: React.ReactNode;
  items: JournalEntry[];
  moods: Record<string, DayMood>;
  query: string;
  onOpen: (d: string) => void;
  empty?: string;
}) {
  return (
    <div className="mt-5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        {icon}
        {title}
      </h3>
      {items.length === 0 && empty && (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      )}
      <ul className="mt-2 space-y-1">
        {items.map((e) => (
          <li key={e.day}>
            <button
              onClick={() => onOpen(e.day)}
              className="w-full rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-base leading-none">
                  {moodOf(moods[e.day])?.emoji ?? "📝"}
                </span>
                {fmtShort(e.day)}
                {e.starred && (
                  <Star size={12} className="fill-amber text-amber" />
                )}
                <span className="ml-auto text-xs font-normal text-muted">
                  {e.words} words
                </span>
              </span>
              <Snippet text={entryText(e)} query={query} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A short piece of the entry, centred on the search match and with the match highlighted. */
function Snippet({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0)
    return (
      <span className="mt-0.5 line-clamp-2 text-sm text-muted">{text}</span>
    );
  const start = Math.max(0, at - 50);
  const end = Math.min(text.length, at + query.length + 70);
  return (
    <span className="mt-0.5 line-clamp-2 text-sm text-muted">
      {start > 0 && "…"}
      {text.slice(start, at)}
      <mark className="rounded bg-amber/30 px-0.5 text-ink">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length, end)}
      {end < text.length && "…"}
    </span>
  );
}

/* ---------- On this day ---------- */
function OnThisDay({
  today,
  entries,
  onOpen,
}: Pick<Props, "today" | "entries" | "onOpen">) {
  const looks = [
    { label: "A week ago", day: addDays(today, -7) },
    { label: "A month ago", day: sameDate(today, 1) },
    { label: "A year ago", day: sameDate(today, 12) },
  ].filter((x): x is { label: string; day: string } =>
    Boolean(x.day && entries[x.day]),
  );

  return (
    <section
      className="rounded-[28px] border border-line p-5"
      aria-label="On this day"
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <History size={18} className="text-cyan" /> Look back
      </h2>
      {looks.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted">
          Keep writing. A week from now, today&apos;s entry will show up here so
          you can see how far you&apos;ve come.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {looks.map((l) => (
            <li key={l.label}>
              <button
                onClick={() => onOpen(l.day)}
                className="w-full rounded-2xl bg-surface p-3.5 text-left ring-1 ring-line transition hover:ring-cyan/50"
              >
                <span className="text-xs font-semibold text-cyan">
                  {l.label}, {fmtShort(l.day)}
                </span>
                <span className="mt-1 line-clamp-3 block text-sm">
                  {entryText(entries[l.day])}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
