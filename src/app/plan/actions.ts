"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { addDays, dayIn } from "@/lib/day";
import { HABIT_COLORS } from "@/lib/habits";
import { BLOCK_KINDS, type Block, type BlockKind, type Goal, type Milestone, type Task, type WeekPlan } from "@/lib/plan";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// New items can carry an id made on the device, so they show on screen before the save finishes
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const withId = (id?: string) => (id && UUID.test(id) ? { id } : {});
const TASK_COLS = "id, title, priority, due, estimate_minutes, goal_id, done_at, created_at";

async function me() {
  const { supabase, user, profile } = await getCurrentUser();
  if (!user || !profile) return null;
  return { supabase, userId: user.id, today: dayIn(profile.timezone) };
}

/* ---------------- Tasks ---------------- */
export type TaskInput = { title: string; priority: number; due: string | null; estimate: number | null; goalId: string | null };

function cleanTask(i: TaskInput) {
  const title = i.title.trim().slice(0, 140);
  if (!title) return null;
  return {
    title,
    priority: [1, 2, 3].includes(Number(i.priority)) ? Number(i.priority) : 2,
    due: i.due && DATE.test(i.due) ? i.due : null,
    estimate_minutes: i.estimate && i.estimate >= 5 && i.estimate <= 600 ? Math.round(i.estimate) : null,
    goal_id: i.goalId || null,
  };
}

export async function addTask(input: TaskInput, id?: string): Promise<{ ok: true; task: Task } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const v = cleanTask(input);
  if (!v) return fail("Write what the task is first.");
  const { data, error } = await m.supabase.from("tasks").insert({ ...withId(id), user_id: m.userId, ...v }).select(TASK_COLS).single<Task>();
  if (error || !data) return fail("Couldn't add the task. Try again.");
  return { ok: true, task: data };
}

export async function updateTask(id: string, input: TaskInput): Promise<{ ok: true; task: Task } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const v = cleanTask(input);
  if (!v) return fail("The task needs a title.");
  const { data, error } = await m.supabase.from("tasks").update(v).eq("id", id).eq("user_id", m.userId).select(TASK_COLS).single<Task>();
  if (error || !data) return fail("Couldn't save the task. Try again.");
  return { ok: true, task: data };
}

export async function toggleTask(id: string, done: boolean): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { error } = await m.supabase.from("tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("user_id", m.userId);
  return error ? fail("Couldn't save that. Try again.") : { ok: true };
}

export async function deleteTask(id: string): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { error } = await m.supabase.from("tasks").delete().eq("id", id).eq("user_id", m.userId);
  return error ? fail("Couldn't delete the task. Try again.") : { ok: true };
}

/** Moves every unfinished task from before today onto today. */
export async function rollOverTasks(): Promise<{ ok: true; count: number } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { data, error } = await m.supabase.from("tasks").update({ due: m.today }).eq("user_id", m.userId).is("done_at", null).lt("due", m.today).select("id");
  return error ? fail("Couldn't move the tasks. Try again.") : { ok: true, count: data?.length ?? 0 };
}

/* ---------------- Timetable ---------------- */
export type BlockInput = { start: number; end: number; title: string; kind: string };
const KINDS = BLOCK_KINDS.map((k) => k.id);

function cleanBlock(i: BlockInput) {
  const start = Math.round(Number(i.start));
  const end = Math.round(Number(i.end));
  const title = i.title.trim().slice(0, 60);
  if (!title) return "Give the block a name.";
  if (!(start >= 0 && start < 1440 && end > start && end <= 1440)) return "The end time has to be after the start time.";
  return { start_min: start, end_min: end, title, kind: (KINDS.includes(i.kind as BlockKind) ? i.kind : "other") as BlockKind };
}

const BLOCK_COLS = "id, day, start_min, end_min, title, kind";

export async function addBlock(input: BlockInput, id?: string): Promise<{ ok: true; block: Block } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const v = cleanBlock(input);
  if (typeof v === "string") return fail(v);
  const { count } = await m.supabase.from("timetable_blocks").select("id", { count: "exact", head: true }).eq("user_id", m.userId).eq("day", m.today);
  if ((count ?? 0) >= 40) return fail("That's a lot of blocks for one day. Merge a few first.");
  const { data, error } = await m.supabase.from("timetable_blocks").insert({ ...withId(id), user_id: m.userId, day: m.today, ...v }).select(BLOCK_COLS).single<Block>();
  if (error || !data) return fail("Couldn't add the block. Try again.");
  return { ok: true, block: data };
}

export async function updateBlock(id: string, input: BlockInput): Promise<{ ok: true; block: Block } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const v = cleanBlock(input);
  if (typeof v === "string") return fail(v);
  const { data, error } = await m.supabase.from("timetable_blocks").update(v).eq("id", id).eq("user_id", m.userId).select(BLOCK_COLS).single<Block>();
  if (error || !data) return fail("Couldn't save the block. Try again.");
  return { ok: true, block: data };
}

export async function deleteBlock(id: string): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { error } = await m.supabase.from("timetable_blocks").delete().eq("id", id).eq("user_id", m.userId);
  return error ? fail("Couldn't delete the block. Try again.") : { ok: true };
}

/** Copies the most recent day's timetable (within the last week) onto today. */
export async function copyLastTimetable(): Promise<{ ok: true; blocks: Block[]; from: string } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { data: prev } = await m.supabase
    .from("timetable_blocks")
    .select("day")
    .eq("user_id", m.userId)
    .lt("day", m.today)
    .gte("day", addDays(m.today, -7))
    .order("day", { ascending: false })
    .limit(1);
  const from = prev?.[0]?.day as string | undefined;
  if (!from) return fail("No timetable in the last 7 days to copy.");
  const { data: src } = await m.supabase.from("timetable_blocks").select("start_min, end_min, title, kind").eq("user_id", m.userId).eq("day", from);
  const rows = (src ?? []).map((b) => ({ ...b, user_id: m.userId, day: m.today }));
  const { data, error } = await m.supabase.from("timetable_blocks").insert(rows).select(BLOCK_COLS).returns<Block[]>();
  if (error || !data) return fail("Couldn't copy the timetable. Try again.");
  return { ok: true, blocks: data, from };
}

/* ---------------- Goals ---------------- */
export type GoalInput = { title: string; why: string; emoji: string; color: string; targetDate: string | null; milestones?: string[] };
const GOAL_COLS = "id, title, why, emoji, color, target_date, achieved_at, created_at";

function cleanGoal(i: GoalInput) {
  const title = i.title.trim().slice(0, 80);
  if (!title) return null;
  return {
    title,
    why: i.why.trim().slice(0, 280) || null,
    emoji: [...(i.emoji || "🎯")].slice(0, 4).join("") || "🎯",
    color: HABIT_COLORS.includes(i.color as never) ? i.color : "violet",
    target_date: i.targetDate && DATE.test(i.targetDate) ? i.targetDate : null,
  };
}

export async function addGoal(input: GoalInput): Promise<{ ok: true; goal: Goal } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const v = cleanGoal(input);
  if (!v) return fail("Give your goal a name.");
  const { count } = await m.supabase.from("goals").select("id", { count: "exact", head: true }).eq("user_id", m.userId).is("archived_at", null);
  if ((count ?? 0) >= 12) return fail("You have 12 goals already. Finish or remove one first.");
  const { data: goal, error } = await m.supabase.from("goals").insert({ user_id: m.userId, ...v }).select(GOAL_COLS).single<Omit<Goal, "milestones">>();
  if (error || !goal) return fail("Couldn't add the goal. Try again.");
  const titles = (input.milestones ?? []).map((t) => t.trim().slice(0, 100)).filter(Boolean).slice(0, 12);
  let milestones: Milestone[] = [];
  if (titles.length) {
    const { data } = await m.supabase
      .from("milestones")
      .insert(titles.map((title, position) => ({ goal_id: goal.id, user_id: m.userId, title, position })))
      .select("id, goal_id, title, done_at, position")
      .returns<Milestone[]>();
    milestones = data ?? [];
  }
  return { ok: true, goal: { ...goal, milestones } };
}

export async function updateGoal(id: string, input: GoalInput): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const v = cleanGoal(input);
  if (!v) return fail("Give your goal a name.");
  const { error } = await m.supabase.from("goals").update(v).eq("id", id).eq("user_id", m.userId);
  return error ? fail("Couldn't save the goal. Try again.") : { ok: true };
}

export async function setGoalAchieved(id: string, achieved: boolean): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { error } = await m.supabase.from("goals").update({ achieved_at: achieved ? new Date().toISOString() : null }).eq("id", id).eq("user_id", m.userId);
  return error ? fail("Couldn't save that. Try again.") : { ok: true };
}

export async function archiveGoal(id: string): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { error } = await m.supabase.from("goals").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", m.userId);
  return error ? fail("Couldn't remove the goal. Try again.") : { ok: true };
}

export async function addMilestone(goalId: string, title: string, id?: string): Promise<{ ok: true; milestone: Milestone } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const t = title.trim().slice(0, 100);
  if (!t) return fail("Write the milestone first.");
  const { count } = await m.supabase.from("milestones").select("id", { count: "exact", head: true }).eq("goal_id", goalId);
  const { data, error } = await m.supabase
    .from("milestones")
    .insert({ ...withId(id), goal_id: goalId, user_id: m.userId, title: t, position: count ?? 0 })
    .select("id, goal_id, title, done_at, position")
    .single<Milestone>();
  if (error || !data) return fail("Couldn't add the milestone. Try again.");
  return { ok: true, milestone: data };
}

export async function toggleMilestone(id: string, done: boolean): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { error } = await m.supabase.from("milestones").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("user_id", m.userId);
  return error ? fail("Couldn't save that. Try again.") : { ok: true };
}

export async function deleteMilestone(id: string): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  const { error } = await m.supabase.from("milestones").delete().eq("id", id).eq("user_id", m.userId);
  return error ? fail("Couldn't delete it. Try again.") : { ok: true };
}

/* ---------------- Week ---------------- */
export async function saveWeek(input: WeekPlan): Promise<{ ok: true } | Fail> {
  const m = await me();
  if (!m) return fail("You're logged out. Log in again.");
  if (!DATE.test(input.week_start)) return fail("That week doesn't look right.");
  const { error } = await m.supabase.from("weekly_plans").upsert(
    {
      user_id: m.userId,
      week_start: input.week_start,
      priorities: input.priorities.map((p) => p.trim().slice(0, 120)).filter(Boolean).slice(0, 3),
      wins: input.wins?.trim().slice(0, 1000) || null,
      lessons: input.lessons?.trim().slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" },
  );
  return error ? fail("Couldn't save your week. Try again.") : { ok: true };
}
