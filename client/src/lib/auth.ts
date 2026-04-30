/**
 * Auth client: login/logout/me.
 *
 * The backend sets a httpOnly `bb_session` cookie on /api/auth/login, so
 * we never see the raw JWT in JS — we just hit /api/auth/me to learn
 * whether the current request is authenticated and who the user is.
 */

import { api } from "@/lib/api";

export interface MeResponse {
  username: string;
  role: "admin" | "viewer" | string;
  expires_at: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  username: string;
}

export const auth = {
  login: (creds: LoginRequest) => api.post<TokenResponse>("/auth/login", creds),
  logout: () => api.post<{ ok: boolean }>("/auth/logout"),
  me: () => api.get<MeResponse>("/auth/me"),
};
