"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

import Navbar from "@/components/navbar";
import Providers from "@/components/providers";
import SideMenu from "@/components/sideMenu";

/**
 * (client) layout — recruiter route group.
 * Owns: Providers (theme + queryclient + contexts), Navbar, SideMenu,
 * recruiter-styled Toaster. Does NOT own <html>, <body>, ClerkProvider,
 * or metadata — those live in the root layout (src/app/layout.tsx).
 */
export default function ClientGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute =
    pathname.includes("/sign-in") || pathname.includes("/sign-up");

  return (
    <Providers>
      {!isAuthRoute && <Navbar />}
      <div className="flex flex-row h-screen overflow-hidden">
        {!isAuthRoute && <SideMenu />}
        <div
          className={
            isAuthRoute
              ? "h-full overflow-y-auto flex-grow"
              : "ml-[200px] pt-[64px] h-full overflow-y-auto flex-grow"
          }
        >
          {children}
        </div>
      </div>
      <Toaster
        toastOptions={{
          classNames: {
            toast: "bg-white",
            title: "text-black",
            description: "text-red-400",
            actionButton: "bg-brand-subtle",
            cancelButton: "bg-orange-400",
            closeButton: "bg-white",
          },
        }}
      />
    </Providers>
  );
}
