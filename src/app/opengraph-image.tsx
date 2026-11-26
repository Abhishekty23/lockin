import { ImageResponse } from "next/og";
import { MANROPE, SORA_BOLD } from "@/lib/pdf/fonts";

export const alt = "LockIn: track your whole day";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PARTS = [
  { label: "Focus", color: "#8f80ff", pct: 100 },
  { label: "Water", color: "#5aa9ff", pct: 88 },
  { label: "Sleep", color: "#46d4ea", pct: 100 },
  { label: "Habits", color: "#ffb547", pct: 80 },
  { label: "Journal", color: "#ff7ba6", pct: 100 },
];

// The picture shown when a LockIn link is shared (WhatsApp, LinkedIn, X…).
export default async function Image() {
  // Same bundled fonts as the PDF report, so nothing is read from disk
  const sora = Buffer.from(SORA_BOLD, "base64");
  const manrope = Buffer.from(MANROPE, "base64");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #182055 0%, #0d1130 55%, #0a0d26 100%)", color: "#eef0ff", fontFamily: "Manrope", padding: 72 }}>
        <div style={{ position: "absolute", right: -120, top: -80, width: 620, height: 620, borderRadius: 620, background: "radial-gradient(circle, rgba(143,128,255,0.45), rgba(143,128,255,0) 70%)", display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 56, border: "8px solid #8f80ff", display: "flex" }} />
            <div style={{ fontFamily: "Sora", fontSize: 40 }}>LockIn</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Sora", fontSize: 92, lineHeight: 1, letterSpacing: -3 }}>Lock in.</div>
            <div style={{ fontFamily: "Sora", fontSize: 92, lineHeight: 1.05, letterSpacing: -3, color: "#9aa3d6" }}>Track your whole day.</div>
            <div style={{ fontSize: 30, marginTop: 28, color: "#9aa3d6", maxWidth: 820 }}>Focus, water, sleep, habits, goals and a journal. Streaks, insights and friends.</div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {PARTS.map((p) => (
              <div key={p.label} style={{ display: "flex", flexDirection: "column", gap: 10, width: 190 }}>
                <div style={{ display: "flex", height: 16, borderRadius: 16, background: "rgba(255,255,255,0.1)" }}>
                  <div style={{ width: `${p.pct}%`, height: 16, borderRadius: 16, background: p.color, boxShadow: `0 0 24px ${p.color}` }} />
                </div>
                <div style={{ fontSize: 24, color: "#cfd4ff" }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Sora", data: sora, weight: 700 }, { name: "Manrope", data: manrope, weight: 500 }] },
  );
}
