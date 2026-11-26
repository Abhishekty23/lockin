"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Field from "./Field";
import FormAlert from "./FormAlert";
import SubmitButton from "./SubmitButton";
import PasswordMeter from "./PasswordMeter";
import CheckInbox from "./CheckInbox";
import GoogleButton, { OrDivider } from "./GoogleButton";
import { safeNext } from "./LoginForm";

export default function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/onboarding");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const redirectTo = typeof window === "undefined" ? "" : `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isSupabaseConfigured) return setError("Sign up isn't connected yet. Try again soon.");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const name = String(form.get("name")).trim();
    if (password.length < 8) return setError("Use at least 8 characters for your password.");

    setLoading(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: redirectTo },
    });
    setLoading(false);

    if (error) {
      setError(
        /registered|exists/i.test(error.message)
          ? "There's already an account with this email. Log in instead."
          : /rate|too many/i.test(error.message)
            ? "Too many sign ups right now. Wait a minute, then try again."
            : /weak|pwned|password/i.test(error.message)
              ? "That password is too easy to guess. Try a longer one."
              : "Couldn't create your account. Check your details and try again.",
      );
      return;
    }

    // Email confirmation off → logged in straight away
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    // Supabase hides existing accounts: no identities means the email is taken
    if (data.user && data.user.identities?.length === 0) {
      setError("There's already an account with this email. Log in instead.");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) return <CheckInbox email={sentTo} redirectTo={redirectTo} />;

  return (
    <div>
      <FormAlert message={error} />
      <div className={error ? "mt-5" : ""}>
        <GoogleButton next={next} onError={setError} />
      </div>
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Your name" icon={User} name="name" placeholder="What should we call you?" autoComplete="name" required maxLength={60} />
        <Field label="Email" icon={Mail} name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        <Field
          label="Password"
          icon={Lock}
          name="password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={<PasswordMeter value={password} />}
        />
        <SubmitButton loading={loading}>Create my account</SubmitButton>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-violet hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
