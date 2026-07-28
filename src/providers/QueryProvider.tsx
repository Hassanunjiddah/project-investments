import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

type QueryProviderProps = {
  children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // How long data is considered "fresh" — no refetch on remount
            // or window focus if data is younger than this. Bumped from 60s
            // → 5 min so tab-switching / route navigation feels instant.
            staleTime: 1000 * 60 * 5,
            // How long unused cache is kept in memory. Longer garbage
            // collection means going back to a previously-visited page
            // paints immediately from cache while a background refresh
            // runs silently.
            gcTime: 1000 * 60 * 30,
            retry: 1,
            // Serve cached data instantly on remount; the hook will
            // refetch in the background if data is stale.
            refetchOnMount: 'always',
            // Don't hammer the server every time the user changes tabs
            // on their phone — mobile safari fires focus events aggressively.
            refetchOnWindowFocus: false,
            // Do refetch when the network reconnects — useful for spotty
            // mobile connections.
            refetchOnReconnect: true,
            // Return the previous data while the new fetch is in-flight
            // so screens never flash to a skeleton on re-visit.
            placeholderData: (prev: unknown) => prev,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
