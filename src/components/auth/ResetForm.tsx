"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Field from "./Field";
import FormAlert from "./FormAlert";
import SubmitButton from "./SubmitButton";
import PasswordMeter from "./PasswordMeter";

// Reached from the reset email, which has already logged the person in.
export default function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const confirm = String(new FormData(e.currentTarget).get("confirm"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        /session|jwt|not authenticated/i.test(error.message)
          ? "This reset link has expired. Ask for a new one from the log in page."
          : /same|different/i.test(error.message)
            ? "Pick a password you haven't used here before."
            : "Couldn't update your password. Try a different one.",
      );
      return;
    }
    router.replace("/today");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormAlert message={error} />
      <Field
        label="New password"
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
      <Field label="Type it again" icon={Lock} name="confirm" type="password" placeholder="Same password" autoComplete="new-password" required />
      <SubmitButton loading={loading}>Save new password</SubmitButton>
    </form>
  );
}
