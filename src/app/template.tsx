"use client";

import { motion } from "motion/react";

// A gentle fade-in each time you move to another page. Opacity only: a transform here would
// break fixed elements (tab bar, toasts, overlays) inside the page.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
