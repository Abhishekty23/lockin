// Four-step strength bar under the password field.
export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  else if (/\d|[^A-Za-z0-9]/.test(pw)) s += 0.5;
  return Math.min(4, Math.floor(s));
}

const LABELS = ["Too short", "Weak", "Okay", "Strong", "Very strong"];
const COLORS = ["var(--rose)", "var(--rose)", "var(--amber)", "var(--mint)", "var(--mint)"];

export default function PasswordMeter({ value }: { value: string }) {
  if (!value) return null;
  const score = value.length < 8 ? 0 : Math.max(1, passwordScore(value));
  return (
    <span className="mt-2 flex items-center gap-3">
      <span className="flex flex-1 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= score ? COLORS[score] : "var(--line)" }}
          />
        ))}
      </span>
      <span className="w-24 text-right text-xs font-semibold" style={{ color: COLORS[score] }}>
        {LABELS[score]}
      </span>
    </span>
  );
}
