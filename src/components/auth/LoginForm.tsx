"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Field from "./Field";
import FormAlert from "./FormAlert";
import SubmitButton from "./SubmitButton";
import GoogleButton, { OrDivider } from "./GoogleButton";

const NOTICES: Record<string, { text: string; type: "error" | "success" }> = {
  link: { text: "That link has expired or was already used. Log in, or ask for a new one.", type: "error" },
  oauth: { text: "Google sign-in was cancelled. Try again or use your email.", type: "error" },
  signedout: { text: "You're logged out. See you tomorrow.", type: "success" },
  reset: { text: "Password updated. Log in with your new password.", type: "success" },
};

export function safeNext(next: string | null, fallback = "/today") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = NOTICES[params.get("error") ?? ""] ?? (params.get("signedout") ? NOTICES.signedout : params.get("reset") ? NOTICES.reset : null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(initial);
  const next = safeNext(params.get("next"));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isSupabaseConfigured) return setMessage({ text: "Login isn't connected yet. Try again soon.", type: "error" });
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setMessage(null);

    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });

    if (error) {
      setLoading(false);
      setMessage({
        type: "error",
        text: /not confirmed/i.test(error.message)
          ? "Confirm your email first. The link is in your inbox (check spam too)."
          : /rate|too many/i.test(error.message)
            ? "Too many tries. Wait a minute, then try again."
            : "That email and password don't match.",
      });
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div>
      <FormAlert message={message?.text ?? null} type={message?.type} />
      <div className={message ? "mt-5" : ""}>
        <GoogleButton next={next} onError={(text) => setMessage({ text, type: "error" })} />
      </div>
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Email" icon={Mail} name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        <div>
          <Field label="Password" icon={Lock} name="password" type="password" placeholder="Your password" autoComplete="current-password" required minLength={6} />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-violet hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        <SubmitButton loading={loading}>Log in</SubmitButton>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        New to LockIn?{" "}
        <Link href={next === "/today" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-violet hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
