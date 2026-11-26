"use client";

import { useEffect } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __lockinInstall?: InstallEvent | null;
  }
}

/** Registers the service worker and keeps the browser's "install app" prompt for the Install button. */
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const keep = (e: Event) => {
      e.preventDefault();
      window.__lockinInstall = e as InstallEvent;
      window.dispatchEvent(new Event("lockin:installable"));
    };
    const done = () => {
      window.__lockinInstall = null;
      window.dispatchEvent(new Event("lockin:installable"));
    };
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", keep);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return null;
}

/** True when the browser is ready to install LockIn as an app. */
export function canInstall() {
  return typeof window !== "undefined" && !!window.__lockinInstall;
}

export async function installApp() {
  const e = window.__lockinInstall;
  if (!e) return false;
  await e.prompt();
  const choice = await e.userChoice;
  window.__lockinInstall = null;
  window.dispatchEvent(new Event("lockin:installable"));
  return choice.outcome === "accepted";
}
