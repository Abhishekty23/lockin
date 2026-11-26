import { LockMark } from "./Logo";

// Shown for a moment while a private page loads.
export default function PageLoader() {
  return (
    <div className="sky grid min-h-screen place-items-center" role="status" aria-label="Loading">
      <div className="animate-breathe">
        <LockMark size={64} closed={false} />
      </div>
    </div>
  );
}
