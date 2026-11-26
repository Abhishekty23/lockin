"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { TONES, type Announcement } from "@/lib/admin";

const KEY = "lockin-dismissed";
const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};

// The newest live announcement from an admin, until the person closes it.
export default function AnnouncementBar() {
  const [item, setItem] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let live = true;
    createClient()
      .from("announcements")
      .select("id, title, body, tone, active, ends_at, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        // A failed load just means no banner
        if (!live || !data) return;
        const gone = readDismissed();
        const now = Date.now();
        setItem((data as Announcement[]).find((a) => !gone.includes(a.id) && (!a.ends_at || new Date(a.ends_at).getTime() > now)) ?? null);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!item) return null;
  const color = TONES.find((t) => t.id === item.tone)?.color ?? "var(--violet)";
  const close = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...readDismissed(), item.id].slice(-50)));
    } catch {
      // storage unavailable: it just shows again next time
    }
    setItem(null);
  };

  return (
    <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6" role="status">
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
        style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)` }}
      >
        <Megaphone size={18} className="mt-0.5 shrink-0" style={{ color }} />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{item.title}</span>
          {item.body && <span className="text-muted"> {item.body}</span>}
        </p>
        <button onClick={close} aria-label="Close announcement" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
