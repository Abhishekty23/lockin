import Link from "next/link";
import Logo, { LockMark } from "@/components/ui/Logo";

// Temporary page for parts of LockIn that are being built next.
export default function ComingSoon({ title }: { title: string }) {
  return (
    <main className="sky grid min-h-screen place-items-center px-4 text-center">
      <div>
        <Link href="/" aria-label="Back to home" className="inline-block">
          <Logo />
        </Link>
        <div className="mx-auto mt-12 grid h-24 w-24 place-items-center rounded-3xl bg-surface-strong shadow-xl">
          <LockMark size={56} closed={false} />
        </div>
        <h1 className="mt-8 font-display text-4xl font-bold">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">This part of LockIn opens in the next update. Explore the home page in the meantime.</p>
        <Link href="/" className="mt-8 inline-block rounded-full bg-ink px-7 py-3.5 font-semibold text-bg">
          Back to home
        </Link>
      </div>
    </main>
  );
}
