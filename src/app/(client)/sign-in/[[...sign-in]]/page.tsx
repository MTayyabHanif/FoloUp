import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth-shell";

function SignInPage() {
  return (
    <AuthShell>
      <SignIn forceRedirectUrl="/dashboard" />
    </AuthShell>
  );
}

export default SignInPage;
