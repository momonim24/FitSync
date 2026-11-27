import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler, TOKEN_KEY, USER_KEY } from '../api/client';
import { authApi } from '../api/services';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  token: string | null;
  /** True until the stored token has been checked against /auth/me. */
  initializing: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: (reason?: string) => void;
  setUser: (user: User) => void;
  sessionMessage: string | null;
  clearSessionMessage: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/**
 * Holds the logged-in user and JWT. The token is kept in localStorage so a
 * page refresh keeps the session; on start-up it is re-validated with
 * GET /auth/me so an expired token or deactivated account logs out.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUserState] = useState<User | null>(readStoredUser);
  const [initializing, setInitializing] = useState<boolean>(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const logout = useCallback((reason?: string) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUserState(null);
    if (reason) setSessionMessage(reason);
  }, []);

  const setUser = useCallback((next: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUserState(next);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout('Your session has expired. Please log in again.'));
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => logout('Your session has expired. Please log in again.'))
      .finally(() => setInitializing(false));
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      localStorage.setItem(TOKEN_KEY, result.accessToken);
      setToken(result.accessToken);
      setUser(result.user);
      setSessionMessage(null);
      return result.user;
    },
    [setUser],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      initializing,
      login,
      logout,
      setUser,
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(null),
    }),
    [user, token, initializing, login, logout, setUser, sessionMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Home route for each role after login. */
export function homePath(role: User['role']): string {
  return `/${role.toLowerCase()}`;
}
