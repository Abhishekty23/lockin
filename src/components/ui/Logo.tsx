import { useId } from "react";

// LockIn mark: a padlock whose body is a progress ring.
export function LockMark({ size = 32, closed = true }: { size?: number; closed?: boolean }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--cyan)" />
        </linearGradient>
      </defs>
      <path
        d={closed ? "M10.5 14V10.5a5.5 5.5 0 0 1 11 0V14" : "M10.5 14V8.5a5.5 5.5 0 0 1 11 0"}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="20.5" r="8.5" fill="none" stroke={`url(#${id})`} strokeWidth="3.4" />
      <circle cx="16" cy="20.5" r="2.2" fill="var(--ink)" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LockMark />
      <span className="font-display text-xl font-bold tracking-tight">LockIn</span>
    </span>
  );
}
