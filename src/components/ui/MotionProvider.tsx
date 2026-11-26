"use client";

import { MotionConfig } from "motion/react";

// Turns animations off for people who chose "reduce motion" in their device settings.
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
