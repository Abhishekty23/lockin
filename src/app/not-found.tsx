import Link from "next/link";
import Logo, { LockMark } from "@/components/ui/Logo";

export const metadata = { title: "Page not found | LockIn" };

export default function NotFound() {
  return (
    <main className="sky grid min-h-screen place-items-center px-4 text-center">
      <div className="max-w-md">
        <Link href="/" aria-label="LockIn home" className="inline-block">
          <Logo />
        </Link>
        <div className="mx-auto mt-12 grid h-28 w-28 place-items-center rounded-[2rem] bg-surface-strong shadow-2xl ring-1 ring-line">
          <LockMark size={64} closed={false} />
        </div>
        <p className="mt-8 font-display text-7xl font-extrabold tracking-tight text-muted/40">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold">This page is locked away</h1>
        <p className="mt-3 text-muted">The link may be old or mistyped. Your day is still waiting for you.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/today" className="rounded-full bg-ink px-7 py-3.5 font-semibold text-bg">
            Go to Today
          </Link>
          <Link href="/" className="glass rounded-full px-7 py-3.5 font-semibold">
            Home page
          </Link>
        </div>
      </div>
    </main>
  );
}
