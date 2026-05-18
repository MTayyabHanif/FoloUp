import { Toaster } from "sonner";

import Providers from "@/components/providers";

/**
 * (user) layout — candidate route group.
 * Owns: Providers, candidate-styled Toaster. Does NOT own <html>, <body>,
 * ClerkProvider, or metadata — those live in the root layout.
 */
export default function UserGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {children}
      <Toaster
        toastOptions={{
          classNames: {
            toast: "bg-white border-2 border-brand-subtle",
            title: "text-black",
            description: "text-red-400",
            actionButton: "bg-brand-subtle",
            cancelButton: "bg-orange-400",
            closeButton: "bg-lime-400",
          },
        }}
      />
    </Providers>
  );
}
