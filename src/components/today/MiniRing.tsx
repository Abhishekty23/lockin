// Small score ring for the week strip.
export default function MiniRing({ score, color = "var(--violet)", size = 44 }: { score: number; color?: string; size?: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" className="-rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
      {score > 0 && (
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={score >= 100 ? "var(--mint)" : color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(c * Math.min(100, score)) / 100} ${c}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      )}
    </svg>
  );
}
