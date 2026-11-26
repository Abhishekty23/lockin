"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// "Continue with Google". Needs the Google provider switched on in Supabase.
export default function GoogleButton({ next = "/today", onError }: { next?: string; onError: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);

  async function go() {
    if (!isSupabaseConfigured) return onError("Login isn't connected yet. Try again soon.");
    setLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setLoading(false);
      onError(
        /not enabled|unsupported provider/i.test(error.message)
          ? "Google sign-in isn't switched on yet. Use your email for now."
          : "Couldn't reach Google. Try again.",
      );
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={loading}
      className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-surface-strong py-3.5 font-semibold transition hover:border-violet/50 disabled:opacity-70"
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleLogo />}
      Continue with Google
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4 text-sm text-muted">
      <span className="h-px flex-1 bg-line" />
      or with email
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
