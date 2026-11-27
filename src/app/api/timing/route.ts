import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { habitProgress } from "@/lib/day-server";
import { dayIn } from "@/lib/day";

// Temporary: measures how long each server step takes. Admins only.
export async function GET() {
  const t: Record<string, number> = {};
  let last = performance.now();
  const mark = (k: string) => {
    const now = performance.now();
    t[k] = Math.round(now - last);
    last = now;
  };
  const supabase = await createClient();
  mark("client");
  const { data } = await supabase.auth.getClaims();
  mark("getClaims");
  const id = data?.claims?.sub;
  if (!id) return NextResponse.json({ error: "login" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
  mark("profile");
  if (profile?.role !== "admin") return NextResponse.json({ error: "no" }, { status: 404 });
  await supabase.from("profiles").select("id").eq("id", id).single();
  mark("profile2");
  const day = dayIn(profile.timezone);
  await supabase.from("day_logs").select("*").eq("user_id", id).eq("day", day).maybeSingle();
  mark("dayLog");
  await habitProgress(supabase, id, day);
  mark("habits");
  const s = performance.now();
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { cache: "no-store" });
  t.rawHttp = Math.round(performance.now() - s);
  return NextResponse.json({ t, region: process.env.VERCEL_REGION ?? null }, { headers: { "cache-control": "no-store" } });
}
