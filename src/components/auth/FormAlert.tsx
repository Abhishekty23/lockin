"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function FormAlert({ message, type = "error" }: { message: string | null; type?: "error" | "success" }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div
            role="alert"
            className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ring-1 ${
              type === "error" ? "bg-rose/10 text-rose ring-rose/25" : "bg-mint/10 text-mint ring-mint/25"
            }`}
          >
            {type === "error" ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
            <span className="text-ink">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
