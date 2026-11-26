"use client";

import { useEffect } from "react";

// Moves a soft light under the mouse across any .glass card. Mouse only; off for reduced motion.
export default function Spotlight() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current: HTMLElement | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = (e.target as Element | null)?.closest?.(".glass") as HTMLElement | null;
        if (current && current !== el) {
          current.style.removeProperty("--mx");
          current.style.removeProperty("--my");
        }
        current = el;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
