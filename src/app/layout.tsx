import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Robust Devs Hiring",
  description: "AI-powered hiring interviews",
  openGraph: {
    title: "Robust Devs Hiring",
    description: "AI-powered hiring interviews",
    siteName: "Robust Devs Hiring",
    locale: "en_US",
    type: "website",
  },
};

/**
 * Root layout — server component. Owns:
 * - <html> / <body> (was duplicated in both group layouts before change #3 wave 3)
 * - Single <ClerkProvider> (was instantiated twice with divergent props)
 * - metadata export (was silently dropped from the "use client" (client) layout
 *   per BROKEN-FEATURES §2.4 — fixed by moving here)
 *
 * The (client) layout now owns recruiter chrome (Navbar, SideMenu, theme-aware
 * Toaster), the (user) layout owns the candidate-specific shell.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/browser-client-icon.ico" />
      </head>
      <body className={cn(inter.className, "antialiased min-h-screen")}>
        <ClerkProvider
          signInFallbackRedirectUrl={"/dashboard"}
          afterSignOutUrl={"/sign-in"}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
