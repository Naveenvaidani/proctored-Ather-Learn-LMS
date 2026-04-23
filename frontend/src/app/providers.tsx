/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { PropsWithChildren, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { applyThemePreference } from "../themes/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30
    }
  }
});

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    applyThemePreference();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ErrorBoundary>
  );
}


