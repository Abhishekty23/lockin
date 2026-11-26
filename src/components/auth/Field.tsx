"use client";

import { useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

// Text input with an icon; password fields get a show/hide button.
export default function Field({
  label,
  icon: Icon,
  hint,
  type = "text",
  ...props
}: { label: string; icon: LucideIcon; hint?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <span className="relative mt-1.5 block">
        <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          {...props}
          type={isPassword && shown ? "text" : type}
          className="w-full rounded-2xl border border-line bg-surface py-3.5 pl-11 pr-12 text-base text-ink outline-none transition placeholder:text-muted/70 focus:border-violet focus:ring-4 focus:ring-violet/20"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-muted transition hover:text-ink"
          >
            {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
      {hint}
    </label>
  );
}
