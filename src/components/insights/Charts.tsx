"use client";

import { useState } from "react";

export type BarPoint = { key: string; value: number; tick?: string; tip: string; highlight?: boolean; empty?: boolean };

/**
 * Vertical bars with a hover tooltip. One colour per chart; a dashed line marks the goal.
 * A hidden table carries the same numbers for screen readers.
 */
export function BarChart({
  points,
  color,
  label,
  max,
  target,
  height = 160,
  format = (v) => String(v),
}: {
  points: BarPoint[];
  color: string;
  label: string;
  max?: number;
  target?: { value: number; label: string };
  height?: number;
  format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(1, max ?? 0, target?.value ?? 0, ...points.map((p) => p.value));
  const dense = points.length > 40;
  const gap = points.length > 60 ? 1 : 2;

  return (
    <figure className={`relative ${target ? "pt-4" : ""}`} onMouseLeave={() => setHover(null)}>
      <div className="relative" style={{ height }}>
        {/* grid: baseline, half, top */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${f * 100}%` }} aria-hidden>
            {f > 0 && <span className="absolute -top-2.5 right-0 bg-transparent text-[10px] tabular-nums text-muted">{format(Math.round(top * f))}</span>}
          </div>
        ))}
        {target && target.value <= top && (
          <div className="absolute inset-x-0 border-t-2 border-dashed" style={{ bottom: `${(target.value / top) * 100}%`, borderColor: color, opacity: 0.55 }} aria-hidden>
            <span className="absolute -top-5 left-0 text-[10px] font-semibold" style={{ color }}>
              {target.label}
            </span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end pr-8" style={{ gap }} aria-hidden>
          {points.map((p, i) => (
            <div
              key={p.key}
              className="relative flex h-full min-w-0 flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
            >
              <div
                className={`w-full transition-[height,opacity] duration-300 ${dense ? "rounded-t-[2px]" : "rounded-t-[4px]"}`}
                style={{
                  height: p.value > 0 ? `max(3px, ${(p.value / top) * 100}%)` : 0,
                  background: color,
                  opacity: hover === null || hover === i ? (p.highlight ? 1 : 0.8) : 0.35,
                  boxShadow: p.highlight ? `0 0 12px ${color}` : undefined,
                }}
              />
              {p.empty && <div className="absolute bottom-0 h-[3px] w-full rounded-full bg-line" />}
            </div>
          ))}
        </div>
        {hover !== null && points[hover] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-xl bg-surface-strong px-3 py-2 text-xs font-semibold shadow-xl ring-1 ring-line"
            style={{ left: `min(max(48px, calc(${((hover + 0.5) / points.length) * 100}% - ${(((hover + 0.5) / points.length) * 32).toFixed(1)}px)), calc(100% - 48px))`, bottom: height + 6 }}
            role="status"
          >
            {points[hover].tip}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex pr-8 text-[10px] text-muted" style={{ gap }} aria-hidden>
        {points.map((p) => (
          <span key={p.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {p.tick ?? ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <td>{p.tip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars for ranked lists (what you focused on, habits). */
export function HBars({
  rows,
  color,
  max,
}: {
  rows: { key: string; label: React.ReactNode; value: number; text: string; color?: string }[];
  color: string;
  max?: number;
}) {
  const top = Math.max(1, max ?? 0, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted">{r.text}</span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-line">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%`, background: r.color ?? color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A year of day scores, one square per day, weeks as columns. Fills the card; scrolls sideways on phones. */
export function YearHeatmap({ weeks, today }: { weeks: { day: string; score: number | null; future: boolean }[][]; today: string }) {
  const [hover, setHover] = useState<{ day: string; score: number | null; col: number; row: number } | null>(null);
  const fmt = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const shade = (s: number | null) => {
    if (s == null) return "var(--line)";
    if (s >= 100) return "var(--violet)";
    if (s >= 70) return "color-mix(in srgb, var(--violet) 72%, transparent)";
    if (s >= 40) return "color-mix(in srgb, var(--violet) 48%, transparent)";
    if (s > 0) return "color-mix(in srgb, var(--violet) 24%, transparent)";
    return "var(--line)";
  };
  // A month label where a month starts, skipping one that would crowd the previous label
  const months: { col: number; label: string }[] = [];
  weeks.forEach((w, i) => {
    const d = w[w.length - 1].day;
    const prev = i ? weeks[i - 1][weeks[i - 1].length - 1].day : null;
    if (prev && d.slice(5, 7) === prev.slice(5, 7)) return;
    if (months.length && i - months[months.length - 1].col < 3) months.pop();
    months.push({ col: i, label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)) });
  });
  const n = weeks.length;

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="relative min-w-[640px]" onMouseLeave={() => setHover(null)}>
          <div className="relative mb-1.5 h-4 text-[10px] text-muted" aria-hidden>
            {months.map((m) => (
              <span key={m.col} className="absolute" style={{ left: `${(m.col / n) * 100}%` }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {weeks.map((w, i) => (
              <div key={i} className="grid gap-[3px]">
                {w.map((c, j) => (
                  <span
                    key={c.day}
                    className={`block aspect-square w-full rounded-[3px] ${c.day === today ? "ring-2 ring-cyan" : ""}`}
                    style={{ background: c.future ? "transparent" : shade(c.score) }}
                    onMouseEnter={() => !c.future && setHover({ day: c.day, score: c.score, col: i, row: j })}
                    aria-hidden
                  />
                ))}
              </div>
            ))}
          </div>
          {hover && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-surface-strong px-3 py-2 text-xs font-semibold shadow-xl ring-1 ring-line"
              style={{ left: `clamp(80px, ${((hover.col + 0.5) / n) * 100}%, calc(100% - 80px))`, top: `calc(22px + ${(hover.row / 7) * 100}% * 0.86)` }}
            >
              {fmt(hover.day)}: {hover.score == null ? "nothing logged" : `score ${hover.score}`}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted" aria-hidden>
        Less
        {[null, 20, 50, 80, 100].map((s, i) => (
          <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: shade(s) }} />
        ))}
        More
      </div>
    </div>
  );
}
