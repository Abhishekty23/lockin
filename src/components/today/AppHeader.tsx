"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LogOut } from "lucide-react";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { signOut } from "@/app/auth/actions";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/focus", label: "Focus", soon: true },
  { href: "/plan", label: "Plan", soon: true },
  { href: "/insights", label: "Insights", soon: true },
];

// Top bar for every signed-in page.
export default function AppHeader({ name, avatar, email }: { name: string; avatar: string; email: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/today" aria-label="LockIn, today">
          <Logo />
        </Link>
        <nav className="hidden gap-1 md:flex" aria-label="Main">
          {NAV.map((n) =>
            n.soon ? (
              <span key={n.href} title="Coming in a later update" className="cursor-default rounded-full px-3.5 py-2 text-sm font-semibold text-muted/60">
                {n.label}
              </span>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                aria-current={path === n.href ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${path === n.href ? "bg-surface-strong text-ink ring-1 ring-line" : "text-muted hover:text-ink"}`}
              >
                {n.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex-1" />
        <ThemeToggle />
        <div className="relative" ref={menu}>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Account menu"
            aria-expanded={open}
            className="grid h-11 w-11 place-items-center rounded-full bg-surface-strong text-2xl ring-1 ring-line transition hover:ring-violet/50"
          >
            {avatar}
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface-strong p-2 shadow-2xl"
              >
                <div className="px-3 py-2.5">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="truncate text-sm text-muted">{email}</p>
                </div>
                <div className="my-1 h-px bg-line" />
                <form action={signOut}>
                  <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose transition hover:bg-rose/10">
                    <LogOut size={16} /> Log out
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
