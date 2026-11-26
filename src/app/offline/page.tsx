import Logo from "@/components/ui/Logo";
import RetryButton from "./RetryButton";

export const metadata = { title: "You're offline | LockIn" };

// Shown by the service worker when there's no internet connection.
export default function Page() {
  return (
    <main className="sky grid min-h-screen place-items-center px-4 text-center">
      <div className="max-w-sm">
        <Logo />
        <p className="mt-12 text-6xl">📡</p>
        <h1 className="mt-6 font-display text-3xl font-bold">You&apos;re offline</h1>
        <p className="mt-3 text-muted">LockIn needs the internet to load your day. Your streak is safe. Reconnect and try again.</p>
        <RetryButton />
      </div>
    </main>
  );
}
