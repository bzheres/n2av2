import { apiFetch } from "./api";
export type User = { id: string; username: string; email: string; plan: string; usage_month?: string | null; usage_count?: number | null; created_at?: string | null };

export const signup = (username: string, email: string, password: string) =>
  apiFetch<{ ok: true }>("/auth/signup", { method: "POST", body: JSON.stringify({ username, email, password }) });

export const login = (email: string, password: string) =>
  apiFetch<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const logout = () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" });
export const me = () => apiFetch<{ user: User | null }>("/auth/me");
export const requestPasswordReset = (email: string) =>
  apiFetch<{ ok: true }>("/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email }) });
export const resetPassword = (token: string, new_password: string) =>
  apiFetch<{ ok: true }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password }) });
