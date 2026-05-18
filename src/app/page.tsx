import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

/**
 * Root landing page (added in change #3 wave 5 — closes JOURNEY-MAP §5
 * "no root route" finding).
 *
 * Strategy: smart server-side redirect.
 * - Signed-in users land on /dashboard.
 * - Signed-out users land on /sign-in.
 *
 * Replaces the previous next.config.js permanent redirect (`/` → `/dashboard`),
 * which had a side effect of redirecting signed-out users to a Clerk-protected
 * route, only to immediately bounce them to /sign-in. The two-hop is now a
 * single decision made server-side.
 */
export default async function RootRedirect() {
  const { userId } = await auth();
  redirect(userId ? "/dashboard" : "/sign-in");
}
