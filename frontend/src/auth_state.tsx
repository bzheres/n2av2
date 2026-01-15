// src/auth_state.tsx
import React from "react";
import type { User } from "./auth";
import { me, getCachedUser, setCachedUser } from "./auth";

type AuthState = {
  loading: boolean;
  user: User | null;
  refresh: () => Promise<User | null>;
  setUser: (u: User | null) => void;
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // 1) hydrate immediately from localStorage (prevents "guest" flash)
  const [user, setUserState] = React.useState<User | null>(() => getCachedUser());
  const [loading, setLoading] = React.useState(true);

  const setUser = React.useCallback((u: User | null) => {
    setUserState(u);
    setCachedUser(u);
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      const r = await me(); // updates cache inside me()
      setUserState(r.user ?? null);
      return r.user ?? null;
    } catch {
      setUserState(null);
      setCachedUser(null);
      return null;
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await refresh();
      if (!alive) return;
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const value: AuthState = { loading, user, refresh, setUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
