import type { MetadataRoute } from "next";

// Makes LockIn installable on phones and laptops, with shortcuts on the app icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LockIn: track your whole day",
    short_name: "LockIn",
    description: "Focus sessions, water, sleep, habits, goals and a journal in one place, with reminders, streaks and insights.",
    id: "/",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d1130",
    theme_color: "#0d1130",
    categories: ["productivity", "health", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/today", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Start a focus session", short_name: "Focus", url: "/focus", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Write in my journal", short_name: "Journal", url: "/journal", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
