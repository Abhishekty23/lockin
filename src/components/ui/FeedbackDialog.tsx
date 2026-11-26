"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, X } from "lucide-react";
import { safe } from "@/lib/net";
import { FEEDBACK_KINDS } from "@/lib/admin";
import { sendFeedback } from "@/app/feedback/actions";

// "Send feedback" from the account menu. Goes to the admin feedback inbox.
export default function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const [kind, setKind] = useState<string>("idea");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await safe(sendFeedback(kind, text, path));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSent(true);
    setText("");
  }

  function close() {
    onClose();
    setTimeout(() => {
      setSent(false);
      setError(null);
    }, 300);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={close}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fb-title"
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[28px] bg-surface-strong p-6 shadow-2xl ring-1 ring-line"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="fb-title" className="font-display text-xl font-bold">
                {sent ? "Thank you!" : "Send feedback"}
              </h2>
              <button onClick={close} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-line">
                <X size={16} />
              </button>
            </div>
            {sent ? (
              <div className="mt-4 text-center">
                <p className="text-5xl">💌</p>
                <p className="mt-3 text-muted">Your message reached the LockIn team. Every one is read.</p>
                <button onClick={close} className="mt-6 h-12 w-full rounded-2xl bg-violet font-semibold text-white">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-4">
                <div className="grid grid-cols-2 gap-2">
                  {FEEDBACK_KINDS.map((k) => (
                    <button
                      type="button"
                      key={k.id}
                      onClick={() => setKind(k.id)}
                      aria-pressed={kind === k.id}
                      className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition ${kind === k.id ? "bg-violet/15 ring-violet" : "ring-line hover:bg-surface"}`}
                    >
                      <span className="text-lg">{k.emoji}</span>
                      {k.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  autoFocus
                  placeholder={kind === "bug" ? "What happened, and what did you expect?" : "Tell us what's on your mind"}
                  aria-label="Your message"
                  className="mt-3 w-full resize-none rounded-2xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-violet"
                />
                {error && <p className="mt-2 text-sm text-rose">{error}</p>}
                <button disabled={busy || text.trim().length < 3} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet font-semibold text-white disabled:opacity-50">
                  {busy && <Loader2 size={16} className="animate-spin" />} Send
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
