"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { canInstall, installApp } from "./PwaRegister";

// "Install app" appears only when the browser can install LockIn.
export default function InstallButton({ className = "", onDone }: { className?: string; onDone?: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setReady(canInstall());
    const t = setTimeout(sync, 0);
    window.addEventListener("lockin:installable", sync);
    return () => {
      clearTimeout(t);
      window.removeEventListener("lockin:installable", sync);
    };
  }, []);
  if (!ready) return null;
  return (
    <button
      onClick={async () => {
        await installApp();
        onDone?.();
      }}
      className={className}
    >
      <Download size={16} /> Install LockIn app
    </button>
  );
}
