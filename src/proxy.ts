import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that bypass Clerk authentication entirely.
// - "/" handled by src/app/page.tsx server redirect
// - "/sign-in" and "/sign-up" are Clerk's hosted flows
// - "/call(.*)" is the candidate-facing interview route (unauthenticated by design)
// - The candidate session API routes plus the webhook are public; the webhook
//   gates itself via Retell signature verification.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/call(.*)",
  "/api/register-call(.*)",
  "/api/get-call(.*)",
  "/api/generate-interview-questions(.*)",
  "/api/create-interviewer(.*)",
  "/api/analyze-communication(.*)",
  "/api/response-webhook(.*)",
  "/api/check-session(.*)",
  "/api/response-heartbeat(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
