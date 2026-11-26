import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "./config";
import type { AlertPrefs } from "@/lib/alerts";

// Supabase client for Server Components, Server Actions and Route Handlers.
export async function createClient() {
  const cookieStore = await cookies();

  // Placeholder values keep the client from throwing when keys are missing; getCurrentUser checks first.
  return createServerClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder", {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: safe to ignore, the proxy refreshes sessions.
        }
      },
    },
  });
}

export type Reminders = { water: boolean; breaks: boolean; eyes: boolean; stretch: boolean; sleep: boolean };

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar: string;
  role: "user" | "admin";
  tracks: string[];
  exam_name: string | null;
  custom_track: string | null;
  wake_time: string;
  sleep_time: string;
  focus_goal_minutes: number;
  water_goal: number;
  move_goal_minutes: number;
  steps_goal: number;
  reminders: Reminders;
  sound_on: boolean;
  alert_prefs: AlertPrefs;
  timezone: string;
  onboarded: boolean;
  created_at: string;
};

export type SessionUser = { id: string; email?: string };

// Returns the logged-in user and their profile, or nulls if logged out.
export async function getCurrentUser() {
  const supabase = await createClient();
  if (!isSupabaseConfigured) return { supabase, user: null, profile: null };
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null, profile: null };
  const user: SessionUser = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile };
}
