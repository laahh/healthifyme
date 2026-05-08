import { AUTH_SESSION_KEY, AUTH_TOKEN_KEY } from "./storageKeys";

function apiBase() {
  const b = import.meta.env.VITE_API_URL;
  return typeof b === "string" ? b.trim().replace(/\/$/, "") : "";
}

export function isApiBackendEnabled() {
  return Boolean(apiBase());
}

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token) {
  try {
    if (!token) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return;
    }
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} path - contoh: `/auth/me` (prefix /api/v1 otomatis)
 * @param {RequestInit & { json?: unknown }} [options]
 */
export async function apiRequest(path, options = {}) {
  const base = apiBase();
  if (!base) {
    throw new Error("VITE_API_URL tidak di-set.");
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}/api/v1${normalized}`;

  const { json, headers: extraHeaders, ...rest } = options;
  /** @type {Record<string, string>} */
  const headers = { ...(extraHeaders || {}) };
  let body = rest.body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...rest, headers, body });

  if (res.status === 401) {
    clearAuthToken();
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
    const errBody = await res.json().catch(() => ({}));
    const msg = typeof errBody.error === "string" ? errBody.error : "Sesi berakhir. Silakan login lagi.";
    throw new Error(msg);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = typeof errBody.error === "string" ? errBody.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
