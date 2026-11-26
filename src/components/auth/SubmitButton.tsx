import { Loader2 } from "lucide-react";

export default function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="relative inline-flex h-13 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-violet to-cyan py-3.5 font-semibold text-white shadow-lg shadow-violet/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? <Loader2 size={20} className="animate-spin" aria-label="Working" /> : children}
    </button>
  );
}
