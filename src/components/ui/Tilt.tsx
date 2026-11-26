"use client";

import { useRef } from "react";

// Tilts its card in 3D toward the cursor, with a light sheen. Mouse only; flat for reduced motion.
export default function Tilt({ children, className = "", max = 9, style }: { children: React.ReactNode; className?: string; max?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.dataset.active = "true";
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) scale(1.02)`;
    el.style.setProperty("--tx", `${x * 100}%`);
    el.style.setProperty("--ty", `${y * 100}%`);
  }
  function leave() {
    const el = ref.current;
    if (!el) return;
    el.dataset.active = "false";
    el.style.transform = "";
  }

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt relative ${className}`} style={style}>
      {children}
      <span className="tilt-shine" aria-hidden />
    </div>
  );
}
