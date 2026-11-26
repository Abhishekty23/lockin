import AuthShell from "@/components/auth/AuthShell";
import ForgotForm from "@/components/auth/ForgotForm";

export const metadata = { title: "Reset your password | LockIn" };

export default function Page() {
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to set a new one.">
      <ForgotForm />
    </AuthShell>
  );
}
