"use client";

export default function RetryButton() {
  return (
    <button onClick={() => location.reload()} className="mt-8 rounded-full bg-ink px-7 py-3.5 font-semibold text-bg">
      Try again
    </button>
  );
}
