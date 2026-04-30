/**
 * Thin fetch wrapper. All calls go through the same origin (basePath
 * `/blackbox/api/...`); in dev that's proxied to the backend by Next's
 * rewrites, in prod it lands directly on FastAPI. Cookie auth is
 * implicit because we always send `credentials: include`.
 */

const API = "/blackbox/api";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // empty body is fine
  }
  if (!res.ok) {
    const detail =
      (payload && typeof payload === "object" && "detail" in payload &&
        (payload as { detail?: string }).detail) ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, payload, String(detail));
  }
  return payload as T;
}

export const api = {
  get:    <T>(p: string, init?: RequestInit) => request<T>("GET",    p, undefined, init),
  post:   <T>(p: string, b?: unknown, init?: RequestInit) => request<T>("POST",   p, b, init),
  put:    <T>(p: string, b?: unknown, init?: RequestInit) => request<T>("PUT",    p, b, init),
  patch:  <T>(p: string, b?: unknown, init?: RequestInit) => request<T>("PATCH",  p, b, init),
  delete: <T>(p: string, init?: RequestInit) => request<T>("DELETE", p, undefined, init),
};
