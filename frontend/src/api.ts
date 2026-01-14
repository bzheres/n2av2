const raw = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const API_BASE_URL = raw.replace(/\/+$/, "");
console.log("API_BASE_URL =", API_BASE_URL);


export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body: any = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const msg = body?.detail || body?.message || (typeof body === "string" ? body : `Request failed (${res.status})`);
    throw new Error(msg);
  }
  return body as T;
}
