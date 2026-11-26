"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

function read(): Theme {
  return (document.documentElement.dataset.theme as Theme) || "dark";
}
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

// Dark / light switch with a circular reveal that grows from the button.
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("lockin-theme", next);
      } catch {}
    };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || reduce) return apply();

    const x = e.clientX || innerWidth - 40;
    const y = e.clientY || 40;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = doc.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.22,.7,.2,1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="glass grid h-10 w-10 place-items-center rounded-full text-ink transition hover:scale-105"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
