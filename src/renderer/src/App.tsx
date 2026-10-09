import { BrowserRouter, HashRouter } from 'react-router';
import { QueryProvider } from './api/QueryProvider';
import { AuthProvider } from './auth/AuthProvider';
import { AppRoutes } from './routes';

// Electron loads the app from file://, where only hash routing works.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

export function App() {
  return (
    <AuthProvider>
      <QueryProvider>
        <Router>
          <AppRoutes />
        </Router>
      </QueryProvider>
    </AuthProvider>
  );
}
