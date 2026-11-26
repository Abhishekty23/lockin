"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { minutesNow } from "@/lib/alerts";
import { formatMinutes } from "@/lib/day";
import { BLOCK_KINDS, hhmm, kindOf, toMin, type Block, type BlockKind } from "@/lib/plan";
import type { BlockInput } from "@/app/plan/actions";

const HOUR = 56; // px per hour
const PAD = 12; // room above the first hour label

/** Today's timetable: blocks on a timeline from wake-up to bedtime, with a live "now" line. */
export default function Timetable({
  blocks,
  wake,
  sleep,
  timezone,
  onAdd,
  onUpdate,
  onDelete,
  onCopy,
}: {
  blocks: Block[];
  wake: string;
  sleep: string;
  timezone: string;
  onAdd: (b: BlockInput) => Promise<string | null>;
  onUpdate: (id: string, b: BlockInput) => Promise<string | null>;
  onDelete: (id: string) => Promise<void>;
  onCopy: () => Promise<void>;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Block | "new" | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const tick = () => setNow(minutesNow(timezone));
    const t = setTimeout(tick, 0);
    const id = setInterval(tick, 30000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [timezone]);

  const wakeMin = toMin(wake.slice(0, 5));
  let sleepMin = toMin(sleep.slice(0, 5));
  if (sleepMin <= wakeMin) sleepMin = 24 * 60; // bedtime after midnight: show until midnight
  const startH = Math.floor(Math.min(wakeMin, ...blocks.map((b) => b.start_min)) / 60);
  const endH = Math.ceil(Math.max(sleepMin, ...blocks.map((b) => b.end_min)) / 60);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const top = (min: number) => ((min - startH * 60) / 60) * HOUR + PAD;

  // Put overlapping blocks side by side
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min);
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const b of sorted) {
    let lane = laneEnds.findIndex((end) => end <= b.start_min);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = b.end_min;
    lanes.set(b.id, lane);
  }
  const laneCount = Math.max(1, laneEnds.length);

  const current = now != null ? sorted.find((b) => b.start_min <= now && now < b.end_min) : undefined;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">Timetable</h2>
          <p className="text-sm text-muted">{current ? `Now: ${current.title}, until ${hhmm(current.end_min)}` : "Plan your day in blocks."}</p>
        </div>
        <button onClick={() => setDialog("new")} className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-sm font-semibold text-bg">
          <Plus size={16} /> Block
        </button>
      </div>

      {blocks.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-4 text-center">
          <p className="text-sm text-muted">No blocks yet. Add your study and break times, or reuse a recent day.</p>
          <button
            onClick={async () => {
              setCopying(true);
              await onCopy();
              setCopying(false);
            }}
            disabled={copying}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-line hover:ring-violet/50"
          >
            {copying ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />} Copy my last timetable
          </button>
        </div>
      )}

      <div className="relative mt-4 overflow-hidden rounded-2xl" style={{ height: hours.length * HOUR + PAD * 2 }}>
        {hours.map((h) => (
          <div key={h} className="absolute inset-x-0 flex border-t border-line" style={{ top: (h - startH) * HOUR + PAD }}>
            <span className="w-12 -translate-y-2.5 bg-transparent pr-2 text-right text-[11px] tabular-nums text-muted">{hhmm((h % 24) * 60)}</span>
          </div>
        ))}

        <div className="absolute inset-y-0 left-14 right-0">
          {sorted.map((b) => {
            const k = kindOf(b.kind);
            const lane = lanes.get(b.id) ?? 0;
            const h = Math.max(22, top(b.end_min) - top(b.start_min) - 3);
            const isNow = current?.id === b.id;
            return (
              <motion.button
                key={b.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setDialog(b)}
                className="absolute overflow-hidden rounded-xl px-3 py-1.5 text-left transition hover:brightness-110"
                style={{
                  top: top(b.start_min) + 1,
                  height: h,
                  left: `${(lane / laneCount) * 100}%`,
                  width: `calc(${100 / laneCount}% - 4px)`,
                  background: `color-mix(in srgb, ${k.color} ${isNow ? 30 : 18}%, var(--surface-strong))`,
                  boxShadow: `inset 3px 0 0 ${k.color}${isNow ? `, 0 0 0 2px ${k.color}` : ""}`,
                }}
              >
                <span className="block truncate text-sm font-semibold">
                  {k.emoji} {b.title}
                </span>
                {h > 40 && (
                  <span className="block text-xs text-muted">
                    {hhmm(b.start_min)} to {hhmm(b.end_min)}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {now != null && now >= startH * 60 && now <= endH * 60 && (
          <div className="pointer-events-none absolute left-12 right-0 flex items-center" style={{ top: top(now) }}>
            <span className="h-2.5 w-2.5 -translate-x-1 rounded-full bg-rose" />
            <span className="h-0.5 flex-1 bg-rose" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {dialog && (
          <BlockDialog
            block={dialog === "new" ? null : dialog}
            defaultStart={now != null ? Math.min(1380, Math.ceil(now / 30) * 30) : wakeMin}
            onClose={() => setDialog(null)}
            onSave={async (input) => {
              const err = dialog === "new" ? await onAdd(input) : await onUpdate(dialog.id, input);
              if (!err) setDialog(null);
              return err;
            }}
            onDelete={
              dialog === "new"
                ? undefined
                : async () => {
                    await onDelete(dialog.id);
                    setDialog(null);
                  }
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BlockDialog({
  block,
  defaultStart,
  onClose,
  onSave,
  onDelete,
}: {
  block: Block | null;
  defaultStart: number;
  onClose: () => void;
  onSave: (b: BlockInput) => Promise<string | null>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(block?.title ?? "");
  const [kind, setKind] = useState<BlockKind>(block?.kind ?? "study");
  const [start, setStart] = useState(hhmm(block?.start_min ?? defaultStart));
  const [end, setEnd] = useState(hhmm(block?.end_min ?? Math.min(1439, defaultStart + 60)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const len = toMin(end) - toMin(start);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        role="dialog"
        aria-label={block ? "Edit block" : "New block"}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const err = await onSave({ title, kind, start: toMin(start), end: toMin(end) });
          setBusy(false);
          setError(err);
        }}
        className="w-full rounded-t-[32px] bg-surface-strong p-6 ring-1 ring-line sm:max-w-md sm:rounded-[32px]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{block ? "Edit block" : "New block"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          required
          autoFocus
          placeholder="e.g. Maths revision"
          aria-label="Block name"
          className="mt-5 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base font-semibold outline-none focus:border-violet"
        />
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {BLOCK_KINDS.map((k) => (
            <button
              type="button"
              key={k.id}
              onClick={() => setKind(k.id)}
              aria-pressed={kind === k.id}
              className="h-10 rounded-xl text-sm font-semibold transition"
              style={kind === k.id ? { background: `color-mix(in srgb, ${k.color} 22%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${k.color}` } : { boxShadow: "inset 0 0 0 1px var(--line)" }}
            >
              {k.emoji} {k.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ["Start", start, setStart],
              ["End", end, setEnd],
            ] as const
          ).map(([l, v, set]) => (
            <label key={l} className="rounded-2xl bg-surface p-3 ring-1 ring-line">
              <span className="block text-xs text-muted">{l}</span>
              <input type="time" value={v} onChange={(e) => set(e.target.value)} required className="mt-1 w-full bg-transparent text-lg font-semibold outline-none" />
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{len > 0 ? `${formatMinutes(len)} long` : "End must be after start."}</p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-rose/10 px-4 py-3 text-sm ring-1 ring-rose/25">
            {error}
          </p>
        )}
        <button disabled={busy || !title.trim() || len <= 0} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet font-semibold text-white disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />} {block ? "Save block" : "Add block"}
        </button>
        {block && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              href={`/focus?label=${encodeURIComponent(block.title)}&minutes=${Math.min(180, Math.max(5, block.end_min - block.start_min))}`}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold ring-1 ring-line hover:ring-violet/50"
            >
              <Play size={14} fill="currentColor" /> Lock in for this
            </Link>
            <button type="button" onClick={onDelete} className="flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-rose ring-1 ring-line">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </motion.form>
    </motion.div>
  );
}
