"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FormAlert from "./FormAlert";

// Shown after sign up while the person confirms their email.
export default function CheckInbox({ email, redirectTo }: { email: string; redirectTo: string }) {
  const [wait, setWait] = useState(60);
  const [note, setNote] = useState<{ text: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function resend() {
    setWait(60);
    const { error } = await createClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo } });
    setNote(error ? { text: "Couldn't send it yet. Wait a minute and try again.", type: "error" } : { text: "Sent again. It can take a minute to arrive.", type: "success" });
  }

  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br from-violet to-cyan text-white shadow-xl shadow-violet/30"
      >
        <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
          <Mail size={40} />
        </motion.span>
      </motion.div>
      <h2 className="mt-8 font-display text-2xl font-bold">Check your inbox</h2>
      <p className="mt-3 text-muted">
        We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>. Open it on this device to start your first day.
      </p>
      <p className="mt-2 text-sm text-muted">Not there? Look in spam or promotions.</p>
      <div className="mt-6 text-left">
        <FormAlert message={note?.text ?? null} type={note?.type} />
      </div>
      <button
        onClick={resend}
        disabled={wait > 0}
        className="mt-6 w-full rounded-2xl border border-line bg-surface-strong py-3.5 font-semibold transition hover:border-violet/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {wait > 0 ? `Resend email in ${wait}s` : "Resend email"}
      </button>
    </div>
  );
}
