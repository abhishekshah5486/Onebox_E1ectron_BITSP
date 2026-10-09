import { Navigate, Outlet, useLocation } from 'react-router';
import { Logo } from '../ui/Logo';
import { useAuth } from './AuthProvider';

function Splash() {
  return (
    <div
      style={{ display: 'grid', placeItems: 'center', height: '100vh' }}
      role="status"
      aria-label="Loading"
    >
      <Logo size={56} withWordmark={false} />
    </div>
  );
}

export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'anonymous') {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function GuestOnly() {
  const { state } = useAuth();
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'authenticated') return <Navigate to="/inbox" replace />;
  return <Outlet />;
}
