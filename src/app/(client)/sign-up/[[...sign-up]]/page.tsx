import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-shell";

function SignUpPage() {
  return (
    <AuthShell>
      <SignUp forceRedirectUrl="/dashboard" />
    </AuthShell>
  );
}

export default SignUpPage;
