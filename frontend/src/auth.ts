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

// ---- basic endpoints ----
export const signup = (username: string, email: string, password: string) =>
  apiFetch<{ ok: true }>("/auth/signup", { method: "POST", body: JSON.stringify({ username, email, password }) });

export const login = (email: string, password: string) =>
  apiFetch<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const logout = () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" });

export const requestPasswordReset = (email: string) =>
  apiFetch<{ ok: true }>("/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email }) });

export const resetPassword = (token: string, new_password: string) =>
  apiFetch<{ ok: true }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password }) });

// ---- cached /auth/me to reduce flicker across page transitions ----
let mePromise: Promise<{ user: User | null }> | null = null;
let meCache: { user: User | null } | null = null;

export async function meCached(force = false) {
  if (!force && meCache) return meCache;
  if (!force && mePromise) return mePromise;

  mePromise = apiFetch<{ user: User | null }>("/auth/me")
    .then((r) => {
      meCache = r;
      return r;
    })
    .finally(() => {
      mePromise = null;
    });

  return mePromise;
}

// keep your old export for compatibility
export const me = () => meCached(false);

// optional helper (call this after login/logout to refresh quickly)
export const refreshMe = () => meCached(true);
