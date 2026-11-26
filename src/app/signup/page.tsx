import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export const metadata = { title: "Create your account | LockIn" };

export default function Page() {
  return (
    <AuthShell title="Start locking in" subtitle="Free forever. Set up your day in under two minutes.">
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
