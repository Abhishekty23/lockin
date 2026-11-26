"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Field from "./Field";
import FormAlert from "./FormAlert";
import SubmitButton from "./SubmitButton";

export default function ForgotForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isSupabaseConfigured) return setMessage({ text: "Not connected yet. Try again soon.", type: "error" });
    const email = String(new FormData(e.currentTarget).get("email")).trim().toLowerCase();
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/confirm?next=/reset-password`,
    });
    setLoading(false);
    setMessage(
      error && /rate|too many/i.test(error.message)
        ? { text: "Too many requests. Wait a minute, then try again.", type: "error" }
        : { text: `If ${email} has a LockIn account, a reset link is on its way. It works for one hour.`, type: "success" },
    );
  }

  return (
    <div className="space-y-5">
      <FormAlert message={message?.text ?? null} type={message?.type} />
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Email" icon={Mail} name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        <SubmitButton loading={loading}>Send reset link</SubmitButton>
      </form>
      <Link href="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet hover:underline">
        <ArrowLeft size={16} /> Back to log in
      </Link>
    </div>
  );
}
