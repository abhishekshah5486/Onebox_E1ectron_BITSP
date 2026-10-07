import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { createQueryClient } from './queries';

// Drops every cached response on sign-out so the next user never sees the previous one's data.
function ClearOnSignOut({ client }: { client: QueryClient }) {
  const { state } = useAuth();
  useEffect(() => {
    if (state.status === 'anonymous') client.clear();
  }, [state.status, client]);
  return null;
}

export function QueryProvider({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ClearOnSignOut client={queryClient} />
      {children}
    </QueryClientProvider>
  );
}
