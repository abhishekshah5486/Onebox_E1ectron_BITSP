import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ApiClient } from '../api/client';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { fakeApi } from './fake-api';

// Renders a page inside every app provider, plus a marker route to assert navigation.
interface RenderPageOptions {
  path?: string;
  api?: ApiClient;
  extraRoutes?: string[];
}

export function renderPage(
  ui: ReactNode,
  {
    path = '/',
    api = fakeApi(),
    extraRoutes = ['/inbox', '/signin', '/signup'],
  }: RenderPageOptions = {},
) {
  return render(
    <ThemeProvider>
      <AuthProvider api={api}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={ui} />
            {extraRoutes
              .filter((route) => route !== path)
              .map((route) => (
                <Route key={route} path={route} element={<p>{`at ${route}`}</p>} />
              ))}
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}
