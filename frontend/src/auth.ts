// src/auth.ts
import { apiFetch } from "./api";

export type User = {
  id: string;
  username: string;
  email: string;
  plan: string;
  usage_month?: string | null;
  usage_count?: number | null;
  created_at?: string | null;
};

const USER_CACHE_KEY = "n2a_user_cache_v1";

export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.email) return null;
    return parsed as User;
  } catch {
    return null;
  }
}

export function setCachedUser(user: User | null) {
  try {
    if (!user) localStorage.removeItem(USER_CACHE_KEY);
    else localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export const signup = (username: string, email: string, password: string) =>
  apiFetch<{ ok: true }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });

export const login = async (email: string, password: string) => {
  await apiFetch<{ ok: true }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // fetch fresh user + cache
  return await me();
};

export const logout = async () => {
  await apiFetch<{ ok: true }>("/auth/logout", { method: "POST" });
  setCachedUser(null);
  return { ok: true as const };
};

export const me = async () => {
  const r = await apiFetch<{ user: User | null }>("/auth/me");
  setCachedUser(r.user ?? null);
  return r;
};

/**
 * meCached(useCache):
 * - If useCache=true and we have a cached user, return it immediately (prevents flicker).
 * - Always revalidate in background and update cache via me().
 */
export const meCached = async (useCache: boolean) => {
  if (useCache) {
    const cached = getCachedUser();
    if (cached) {
      // fire-and-forget revalidate
      void me().catch(() => {
        setCachedUser(null);
      });
      return { user: cached as User };
    }
  }
  return await me();
};

export const requestPasswordReset = (email: string) =>
  apiFetch<{ ok: true }>("/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = (token: string, new_password: string) =>
  apiFetch<{ ok: true }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password }),
  });
