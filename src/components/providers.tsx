"use client";

import React from "react";
import compose from "@/lib/compose";
import { InterviewerProvider } from "@/contexts/interviewers.context";
import { InterviewProvider } from "@/contexts/interviews.context";
import { ResponseProvider } from "@/contexts/responses.context";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ClientProvider } from "@/contexts/clients.context";

function Providers({ children }: React.PropsWithChildren) {
  // Lazy-init the QueryClient inside the component (per Next.js App Router
  // SSR guidance) so each browser session gets its own instance instead of
  // sharing module-level state across requests.
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const Provider = compose([
    InterviewProvider,
    InterviewerProvider,
    ResponseProvider,
    ClientProvider,
  ]);

  return (
    <QueryClientProvider client={queryClient}>
      <Provider>{children}</Provider>
    </QueryClientProvider>
  );
}

export default Providers;
