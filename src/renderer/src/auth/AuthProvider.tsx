import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createApiClient, type ApiClient, type User } from '../api/client';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous'; user: null };

interface AuthContextValue {
  state: AuthState;
  api: ApiClient;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const anonymous: AuthState = { status: 'anonymous', user: null };

export function AuthProvider({
  children,
  api: injected,
}: {
  children: ReactNode;
  api?: ApiClient;
}) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const [api] = useState(
    () => injected ?? createApiClient({ onSessionExpired: () => setState(anonymous) }),
  );

  useEffect(() => {
    let active = true;
    void api.restoreSession().then((user) => {
      if (active) setState(user ? { status: 'authenticated', user } : anonymous);
    });
    return () => {
      active = false;
    };
  }, [api]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setState({ status: 'authenticated', user: await api.login(email, password) });
    },
    [api],
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      setState({ status: 'authenticated', user: await api.register(input) });
    },
    [api],
  );

  const signOut = useCallback(async () => {
    // Sign out locally even when the server is unreachable.
    await api.logout().catch(() => {});
    setState(anonymous);
  }, [api]);

  const value = useMemo(
    () => ({ state, api, signIn, signUp, signOut }),
    [state, api, signIn, signUp, signOut],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== 'authenticated') throw new Error('No authenticated user');
  return state.user;
}
