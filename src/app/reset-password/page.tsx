import AuthShell from "@/components/auth/AuthShell";
import ResetForm from "@/components/auth/ResetForm";

export const metadata = { title: "Set a new password | LockIn" };

export default function Page() {
  return (
    <AuthShell title="Set a new password" subtitle="Choose something you'll remember. You'll stay logged in after this.">
      <ResetForm />
    </AuthShell>
  );
}
