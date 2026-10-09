import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiClient } from '../api/client';
import { QueryProvider } from '../api/QueryProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UiVersionProvider } from '../theme/UiVersionProvider';
import { fakeApi } from './fake-api';

// Renders a page inside every app provider, plus a marker route to assert navigation.
export const testQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

interface RenderPageOptions {
  path?: string;
  // Route pattern when it differs from the path, e.g. '/settings/:tab'.
  route?: string;
  api?: ApiClient;
  extraRoutes?: string[];
}

export function renderPage(
  ui: ReactNode,
  {
    path = '/',
    route,
    api = fakeApi(),
    extraRoutes = ['/inbox', '/signin', '/signup'],
  }: RenderPageOptions = {},
) {
  return render(
    <ThemeProvider>
      <UiVersionProvider>
        <AuthProvider api={api}>
          <QueryProvider client={testQueryClient()}>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route path={route ?? path} element={ui} />
                {extraRoutes
                  .filter((route) => route !== path)
                  .map((route) => (
                    <Route key={route} path={route} element={<p>{`at ${route}`}</p>} />
                  ))}
              </Routes>
            </MemoryRouter>
          </QueryProvider>
        </AuthProvider>
      </UiVersionProvider>
    </ThemeProvider>,
  );
}
