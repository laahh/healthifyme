import { AUTH_SESSION_KEY, AUTH_TOKEN_KEY } from "./storageKeys";
import { getApiOriginsToTry, getApiPathPrefix } from "./apiOrigin";

function apiBase() {
  const bases = getApiOriginsToTry();
  return bases[0] || "";
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
  const prefix = getApiPathPrefix();
  const bases = getApiOriginsToTry();

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

  let res = /** @type {Response | null} */ (null);
  let url = "";
  for (let i = 0; i < bases.length; i += 1) {
    url = `${bases[i]}${prefix}${normalized}`;
    res = await fetch(url, { ...rest, headers, body });
    if (res.status !== 404 || i === bases.length - 1) break;
  }
  if (!res) {
    throw new Error("Permintaan API gagal.");
  }

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
    let msg = typeof errBody.error === "string" ? errBody.error : `HTTP ${res.status}`;
    if (res.status === 404 && typeof errBody.error !== "string") {
      msg = `HTTP 404 — ${url}. Cek VITE_API_URL (hanya origin, tanpa /api), deploy server, dan Nginx proxy ke Node.`;
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
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
