// Builds the Insights PDF: A4, vector charts, LockIn fonts. Runs on the server.
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatMinutes } from "@/lib/day";
import { dateLabel, hourLabel, MOOD_NAMES, type Summary } from "@/lib/insights";
import { MANROPE, MANROPE_BOLD, SORA_BOLD } from "./fonts";

const W = 595.28;
const H = 841.89;
const M = 42; // page margin
const CW = W - M * 2; // content width

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  night: hex("#0d1130"),
  ink: hex("#1b1f45"),
  muted: hex("#5b6290"),
  soft: hex("#9aa3d6"),
  line: hex("#e3e5f5"),
  panel: hex("#f3f4ff"),
  white: rgb(1, 1, 1),
  violet: hex("#6b5bf0"),
  cyan: hex("#0b9fbb"),
  water: hex("#2f7fe0"),
  amber: hex("#df8a00"),
  rose: hex("#e2497d"),
  mint: hex("#12a56b"),
};
const HABIT_RGB: Record<string, RGB> = { violet: C.violet, cyan: C.cyan, amber: C.amber, water: C.water, rose: C.rose, mint: C.mint };

/** The fonts cover Latin text only, so emoji and other scripts are left out of the PDF. */
const clean = (s: string) =>
  s
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .replace(/[^\u0000-ɏ -⁯₹]/g, "")
    .replace(/\s+/g, " ")
    .trim();

type Fonts = { head: PDFFont; body: PDFFont; bold: PDFFont };

class Writer {
  doc: PDFDocument;
  f: Fonts;
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  constructor(doc: PDFDocument, f: Fonts) {
    this.doc = doc;
    this.f = f;
  }
  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.pages.push(this.page);
    this.y = H - M;
  }
  /** Start a new page if fewer than `h` points are left. */
  need(h: number) {
    if (this.y - h < M + 24) this.newPage();
  }
  text(s: string, x: number, y: number, o: { size?: number; font?: PDFFont; color?: RGB; max?: number; align?: "left" | "right" | "center" } = {}) {
    const font = o.font ?? this.f.body;
    const size = o.size ?? 10;
    let t = clean(s);
    if (o.max) while (t.length > 1 && font.widthOfTextAtSize(t, size) > o.max) t = t.slice(0, -2) + "…";
    const w = font.widthOfTextAtSize(t, size);
    const dx = o.align === "right" ? -w : o.align === "center" ? -w / 2 : 0;
    this.page.drawText(t, { x: x + dx, y, size, font, color: o.color ?? C.ink });
    return w;
  }
  wrap(s: string, width: number, font: PDFFont, size: number) {
    const words = clean(s).split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  /** Rounded rectangle; (x, y) is the bottom-left corner like the rest of pdf-lib. */
  box(x: number, y: number, w: number, h: number, r: number, color: RGB, opacity = 1) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (r === 0 || h < 1) return this.page.drawRectangle({ x, y, width: w, height: h, color, opacity });
    const p = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    this.page.drawSvgPath(p, { x, y: y + h, color, opacity, borderWidth: 0 });
  }
  /** Bar with rounded top only. */
  bar(x: number, y: number, w: number, h: number, color: RGB, opacity = 1) {
    if (h <= 0) return;
    const r = Math.min(2.5, w / 2, h);
    const p = `M 0 0 V ${-(h - r)} Q 0 ${-h} ${r} ${-h} H ${w - r} Q ${w} ${-h} ${w} ${-(h - r)} V 0 Z`;
    this.page.drawSvgPath(p, { x, y, color, opacity, borderWidth: 0 });
  }
  line(x1: number, y1: number, x2: number, y2: number, color = C.line, thickness = 0.75, dash?: number[]) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness, dashArray: dash });
  }
  /** Section title. `keep` is how much of the section must fit under it, so a title is never left alone at the bottom of a page. */
  heading(title: string, note?: string, keep = 60) {
    this.need(48 + keep);
    this.y -= 8;
    this.text(title, M, this.y - 16, { font: this.f.head, size: 15 });
    this.y -= 22;
    if (note) {
      this.text(note, M, this.y - 12, { size: 9, color: C.muted, max: CW });
      this.y -= 16;
    }
    this.y -= 10;
  }
}

/** Vertical bar chart drawn at the writer's cursor. */
function bars(
  w: Writer,
  o: { x: number; width: number; height: number; values: number[]; ticks: (string | undefined)[]; color: RGB; max?: number; target?: { value: number; label: string }; highlight?: boolean[]; fmt?: (v: number) => string },
) {
  const top = Math.max(1, o.max ?? 0, o.target?.value ?? 0, ...o.values);
  const base = w.y - o.height;
  const plotW = o.width - 26;
  for (const f of [0, 0.5, 1]) {
    const y = base + o.height * f;
    w.line(o.x, y, o.x + plotW, y);
    if (f > 0) w.text((o.fmt ?? String)(Math.round(top * f)), o.x + plotW + 4, y - 3, { size: 6.5, color: C.muted });
  }
  const n = o.values.length;
  const gap = n > 60 ? 0.8 : n > 25 ? 1.4 : 3;
  const bw = (plotW - gap * (n - 1)) / n;
  o.values.forEach((v, i) => {
    const x = o.x + i * (bw + gap);
    w.bar(x, base, bw, (v / top) * o.height, o.color, o.highlight?.[i] ? 1 : 0.78);
    const t = o.ticks[i];
    if (t) w.text(t, x + bw / 2, base - 10, { size: 6.5, color: C.muted, align: "center" });
  });
  if (o.target && o.target.value <= top) {
    const ty = base + (o.target.value / top) * o.height;
    w.line(o.x, ty, o.x + plotW, ty, o.color, 1, [3, 2]);
    w.text(o.target.label, o.x, ty + 3, { size: 6.5, color: o.color, font: w.f.bold });
  }
  w.y = base - 18;
}

/** Ranked horizontal bars at the cursor. */
function hbars(w: Writer, o: { x: number; width: number; rows: { label: string; value: number; text: string; color?: RGB }[]; color: RGB; max?: number }) {
  const top = Math.max(1, o.max ?? 0, ...o.rows.map((r) => r.value));
  for (const r of o.rows) {
    w.text(r.label, o.x, w.y - 9, { size: 8.5, font: w.f.bold, max: o.width - 70 });
    w.text(r.text, o.x + o.width, w.y - 9, { size: 8, color: C.muted, align: "right" });
    w.box(o.x, w.y - 19, o.width, 4.5, 2.25, C.line);
    if (r.value > 0) w.box(o.x, w.y - 19, Math.max(4.5, (r.value / top) * o.width), 4.5, 2.25, r.color ?? o.color);
    w.y -= 26;
  }
}

export async function buildReport(s: Summary, who: { name: string; site: string }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f: Fonts = {
    head: await doc.embedFont(Buffer.from(SORA_BOLD, "base64"), { subset: true }),
    body: await doc.embedFont(Buffer.from(MANROPE, "base64"), { subset: true }),
    bold: await doc.embedFont(Buffer.from(MANROPE_BOLD, "base64"), { subset: true }),
  };
  doc.setTitle(`LockIn report: ${s.range} days`);
  doc.setAuthor("LockIn");
  doc.setCreator("LockIn");

  const w = new Writer(doc, f);
  w.newPage();

  /* ---------- Header band ---------- */
  w.page.drawRectangle({ x: 0, y: H - 132, width: W, height: 132, color: C.night });
  w.box(M, H - 50, 18, 18, 5, C.violet);
  w.text("LockIn", M + 25, H - 45, { font: f.head, size: 13, color: C.white });
  w.text(`Your ${s.range}-day report`, M, H - 88, { font: f.head, size: 25, color: C.white });
  w.text(`${who.name}   |   ${dateLabel(s.start, { day: "numeric", month: "short", year: "numeric" })} to ${dateLabel(s.today, { day: "numeric", month: "short", year: "numeric" })}`, M, H - 110, {
    size: 10,
    color: C.soft,
  });
  w.y = H - 132 - 24;

  if (!s.hasData) {
    w.text("Nothing logged in this period yet.", M, w.y - 20, { font: f.head, size: 15 });
    w.text("Log water, focus or sleep for a few days, then download your report again.", M, w.y - 40, { size: 10, color: C.muted });
  } else {
    /* ---------- Headline numbers ---------- */
    const tiles = [
      { label: "Average day score", value: String(s.score.avg), unit: "out of 100", delta: s.score.prev ? s.score.delta : null, dtext: (d: number) => `${Math.abs(d)} ${Math.abs(d) === 1 ? "pt" : "pts"}` },
      { label: "Total focus", value: formatMinutes(s.focus.total), unit: `${formatMinutes(s.focus.perDay)} a day`, delta: s.focus.prev ? s.focus.total - s.focus.prev : null, dtext: (d: number) => formatMinutes(Math.abs(d)) },
      { label: "Days fully locked in", value: String(s.score.locked), unit: `of ${s.range} days`, delta: null, dtext: () => "" },
      { label: "Days with anything logged", value: String(s.score.activeDays), unit: `of ${s.range} days`, delta: null, dtext: () => "" },
    ];
    const tw = (CW - 3 * 10) / 4;
    tiles.forEach((t, i) => {
      const x = M + i * (tw + 10);
      w.box(x, w.y - 78, tw, 78, 10, C.panel);
      w.text(t.label, x + 11, w.y - 18, { size: 7.5, color: C.muted, max: tw - 20 });
      w.text(t.value, x + 11, w.y - 44, { font: f.head, size: 20 });
      w.text(t.unit, x + 11, w.y - 57, { size: 7.5, color: C.muted, max: tw - 20 });
      if (t.delta) w.text(`${t.delta > 0 ? "Up" : "Down"} ${t.dtext(t.delta)} vs previous`, x + 11, w.y - 70, { size: 6.8, font: f.bold, color: t.delta > 0 ? C.mint : C.amber, max: tw - 16 });
    });
    w.y -= 78 + 18;

    /* ---------- Findings ---------- */
    if (s.findings.length) {
      w.heading("What stands out", "Patterns found in your own data");
      for (const fd of s.findings) {
        const lines = w.wrap(fd.text, CW - 22, f.body, 10);
        w.need(lines.length * 14 + 8);
        const color = fd.tone === "good" ? C.mint : fd.tone === "watch" ? C.amber : C.violet;
        w.box(M, w.y - 10, 6, 6, 3, color);
        lines.forEach((l, i) => w.text(l, M + 16, w.y - 10 - i * 14, { size: 10 }));
        w.y -= lines.length * 14 + 6;
      }
    }

    /* ---------- Score trend ---------- */
    const every = s.range === 7 ? 1 : s.range === 30 ? 7 : 14;
    const ticks = s.days.map((d, i) => ((s.days.length - 1 - i) % every === 0 ? dateLabel(d.day, s.range === 7 ? { weekday: "short" } : undefined) : undefined));
    w.heading(
      "Day score",
      s.score.best ? `Best day: ${s.score.best.score} on ${dateLabel(s.score.best.day, { weekday: "long", day: "numeric", month: "long" })}. Full bars are days at 100.` : undefined,
      150,
    );
    w.need(150);
    bars(w, { x: M, width: CW, height: 120, values: s.days.map((d) => d.score), ticks, color: C.violet, max: 100, highlight: s.days.map((d) => d.score >= 100) });

    /* ---------- Focus ---------- */
    w.heading("Focus", `${s.focus.sessions} sessions, ${s.focus.completedRate}% finished, longest ${formatMinutes(s.focus.longest)}. Goal of ${formatMinutes(s.focus.goal)} met on ${s.focus.daysOnGoal} days.`, 190);
    const col = (CW - 30) / 2;
    w.need(190);
    const startY = w.y;
    w.text("What you focused on", M, w.y - 8, { size: 8.5, color: C.muted, font: f.bold });
    w.y -= 18;
    if (s.focus.byLabel.length) hbars(w, { x: M, width: col, color: C.violet, rows: s.focus.byLabel.map((l) => ({ label: l.label, value: l.minutes, text: formatMinutes(l.minutes) })) });
    else {
      w.text("No timer sessions in this period.", M, w.y - 10, { size: 9, color: C.muted });
      w.y -= 20;
    }
    const leftEnd = w.y;
    w.y = startY;
    w.text("Average by weekday", M + col + 30, w.y - 8, { size: 8.5, color: C.muted, font: f.bold });
    w.y -= 26;
    bars(w, {
      x: M + col + 30,
      width: col,
      height: 90,
      values: s.focus.byWeekday.map((d) => d.minutes),
      ticks: s.focus.byWeekday.map((d) => d.name.slice(0, 3)),
      color: C.violet,
      target: { value: s.focus.goal, label: "Goal" },
      fmt: (v) => (v >= 60 ? `${Math.round(v / 6) / 10}h` : `${v}m`),
    });
    w.y = Math.min(w.y, leftEnd) - 6;
    w.need(120);
    w.text("Time of day you focus", M, w.y - 8, { size: 8.5, color: C.muted, font: f.bold });
    w.y -= 20;
    bars(w, {
      x: M,
      width: CW,
      height: 70,
      values: s.focus.byHour,
      ticks: s.focus.byHour.map((_, h) => (h % 3 === 0 ? hourLabel(h) : undefined)),
      color: C.violet,
      fmt: (v) => (v >= 60 ? `${Math.round(v / 6) / 10}h` : `${v}m`),
    });

    /* ---------- Body ---------- */
    w.heading("Sleep, water and movement", undefined, 150);
    w.need(150);
    const third = (CW - 2 * 18) / 3;
    const body = [
      {
        title: "Sleep",
        big: s.sleep.nights ? formatMinutes(s.sleep.avg) : "Not logged",
        sub: s.sleep.nights ? `a night, on target ${s.sleep.onTarget} of ${s.sleep.nights} nights` : "",
        values: s.days.map((d) => d.sleep_minutes ?? 0),
        color: C.cyan,
        target: { value: s.sleep.target, label: formatMinutes(s.sleep.target) },
        fmt: (v: number) => `${Math.round(v / 6) / 10}h`,
      },
      { title: "Water", big: `${s.water.avg} glasses`, sub: `a day, goal met on ${s.water.daysOnGoal} days`, values: s.days.map((d) => d.water), color: C.water, target: { value: s.water.goal, label: String(s.water.goal) }, fmt: String },
      {
        title: "Move",
        big: formatMinutes(s.move.avg),
        sub: `a day, ${s.move.steps.toLocaleString("en-IN")} steps, goal met on ${s.move.daysOnGoal} days`,
        values: s.days.map((d) => d.move_minutes),
        color: C.amber,
        target: { value: s.move.goal, label: formatMinutes(s.move.goal) },
        fmt: (v: number) => `${v}m`,
      },
    ];
    const by = w.y;
    let lowest = w.y;
    body.forEach((b, i) => {
      const x = M + i * (third + 18);
      w.y = by;
      w.text(b.title, x, w.y - 9, { size: 8.5, font: f.bold, color: b.color });
      w.text(b.big, x, w.y - 28, { font: f.head, size: 15 });
      const lines = w.wrap(b.sub, third, f.body, 7.5);
      lines.forEach((l, j) => w.text(l, x, w.y - 41 - j * 10, { size: 7.5, color: C.muted }));
      w.y -= 50 + lines.length * 10;
      bars(w, { x, width: third, height: 55, values: b.values, ticks: [], color: b.color, target: b.target, fmt: b.fmt });
      lowest = Math.min(lowest, w.y);
    });
    w.y = lowest;

    /* ---------- Mood ---------- */
    if (s.mood.logged) {
      w.heading("Mood", `${s.mood.logged} of ${s.range} days logged`, 170);
      w.need(170);
      const my = w.y;
      hbars(w, { x: M, width: col, color: C.rose, rows: [4, 3, 2, 1, 0].map((i) => ({ label: MOOD_NAMES[i], value: s.mood.counts[i], text: `${s.mood.counts[i]} days` })) });
      const after = w.y;
      // table: on days you felt...
      const tx = M + col + 30;
      let ty = my - 9;
      w.text("On days you felt", tx, ty, { size: 8.5, font: f.bold, color: C.muted });
      ty -= 16;
      const cols = [tx, tx + col * 0.42, tx + col * 0.7, tx + col];
      ["Mood", "Focus", "Sleep", "Score"].forEach((h, i) => w.text(h, cols[i], ty, { size: 7.5, color: C.muted, align: i ? "right" : "left" }));
      for (const m of [...s.mood.byMood].reverse().filter((x) => x.days)) {
        ty -= 6;
        w.line(tx, ty, tx + col, ty);
        ty -= 12;
        w.text(MOOD_NAMES[m.mood - 1], cols[0], ty, { size: 8.5 });
        w.text(formatMinutes(m.focus), cols[1], ty, { size: 8.5, align: "right" });
        w.text(m.sleep == null ? "-" : formatMinutes(m.sleep), cols[2], ty, { size: 8.5, align: "right" });
        w.text(String(m.score), cols[3], ty, { size: 8.5, align: "right" });
      }
      w.y = Math.min(after, ty - 10);
    }

    /* ---------- Habits ---------- */
    if (s.habits.length) {
      w.heading("Habits", "How often you did each habit on the days it was planned");
      for (const h of s.habits) {
        w.need(30);
        hbars(w, { x: M, width: CW, color: C.mint, max: 100, rows: [{ label: h.name, value: h.pct, text: `${h.pct}%  (${h.done} of ${h.due})`, color: HABIT_RGB[h.color] }] });
      }
    }

    /* ---------- Totals ---------- */
    w.heading("Tasks and journal");
    w.need(60);
    const totals = [
      { v: String(s.tasks.done), l: `tasks finished, ${s.tasks.onTime} on time` },
      { v: String(s.tasks.overdue), l: "tasks overdue now" },
      { v: String(s.journal.entries), l: "journal entries" },
      { v: s.journal.words.toLocaleString("en-IN"), l: "words written" },
    ];
    totals.forEach((t, i) => {
      const x = M + i * (tw + 10);
      w.box(x, w.y - 50, tw, 50, 10, C.panel);
      w.text(t.v, x + 11, w.y - 24, { font: f.head, size: 16 });
      w.text(t.l, x + 11, w.y - 38, { size: 7.5, color: C.muted, max: tw - 18 });
    });
    w.y -= 60;
  }

  /* ---------- Footer on every page ---------- */
  const made = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s.today}T12:00:00Z`));
  w.pages.forEach((p, i) => {
    w.page = p;
    w.line(M, 34, W - M, 34);
    w.text(`Made with LockIn on ${made}   ${who.site}`, M, 22, { size: 7.5, color: C.muted });
    w.text(`Page ${i + 1} of ${w.pages.length}`, W - M, 22, { size: 7.5, color: C.muted, align: "right" });
  });

  return doc.save();
}
