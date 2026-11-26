import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Log in | LockIn" };

export default function Page() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in and pick up your streak where you left it.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
