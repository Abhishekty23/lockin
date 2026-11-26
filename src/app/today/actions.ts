"use server";

import { saveToday, type DayPatch, type SaveResult } from "@/lib/day-server";

// Saves changes to today's log and returns the saved row (scored on the server).
export async function updateToday(patch: DayPatch): Promise<SaveResult> {
  return saveToday(() => patch);
}
