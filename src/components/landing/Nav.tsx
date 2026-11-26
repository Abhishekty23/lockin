"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

const links = [
  { href: "#day", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#alerts", label: "Alerts" },
  { href: "#streaks", label: "Streaks" },
  { href: "#faq", label: "FAQ" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 ${
          scrolled ? "glass shadow-lg shadow-black/10" : ""
        }`}
      >
        <Link href="/" aria-label="LockIn home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-ink">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink/90 hover:text-ink sm:block">
            Log in
          </Link>
          <Link
            href="/signup"
            className="hidden rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg transition hover:-translate-y-0.5 sm:block"
          >
            Start free
          </Link>
          <button
            type="button"
            className="glass grid h-10 w-10 place-items-center rounded-full md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="glass mx-auto mt-2 max-w-6xl rounded-2xl p-4 md:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-medium">
              {l.label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href="/login" className="glass rounded-xl py-2.5 text-center font-semibold">
              Log in
            </Link>
            <Link href="/signup" className="rounded-xl bg-ink py-2.5 text-center font-semibold text-bg">
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
