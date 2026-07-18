import { env } from "../config/env.js";
import { ValidationError } from "../domain/errors/AppError.js";
import { signStravaOAuthState, verifyStravaOAuthState } from "../utils/jwt.js";
import * as repo from "../repositories/strava.repository.js";

export function isStravaConfigured() {
  return Boolean(String(env.STRAVA_CLIENT_ID || "").trim() && String(env.STRAVA_CLIENT_SECRET || "").trim());
}

export function assertStravaConfigured() {
  if (!isStravaConfigured()) {
    throw new ValidationError(
      "Strava belum dikonfigurasi. Set STRAVA_CLIENT_ID dan STRAVA_CLIENT_SECRET di server/.env."
    );
  }
}

export function buildAuthUrl(userId) {
  assertStravaConfigured();
  const state = signStravaOAuthState(userId);
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: env.STRAVA_REDIRECT_URI,
    response_type: "code",
    // Jangan otomatis memakai akun Strava terakhir yang masih login di browser.
    // User harus mengonfirmasi akun setiap kali memulai koneksi baru.
    approval_prompt: "force",
    scope: env.STRAVA_SCOPES || "read,activity:read_all,profile:read_all",
    state,
  });
  return {
    url: `https://www.strava.com/oauth/authorize?${params.toString()}`,
    state,
  };
}

export function resolveUserIdFromState(state) {
  if (!state) throw new ValidationError("State OAuth tidak ada.");
  try {
    return verifyStravaOAuthState(String(state));
  } catch {
    throw new ValidationError("State OAuth tidak valid atau kedaluwarsa. Coba Connect ulang.");
  }
}

/**
 * Exchange authorization code for tokens and persist connection.
 */
export async function exchangeCodeAndSave(userId, code) {
  assertStravaConfigured();
  const body = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
    code: String(code),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ValidationError(data?.message || "Gagal menukar kode Strava.");
  }
  const athlete = data.athlete || {};
  const expiresAt = new Date((Number(data.expires_at) || 0) * 1000);
  await repo.upsertConnection(userId, {
    athlete_id: athlete.id,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    scope: data.scope || env.STRAVA_SCOPES,
    athlete_firstname: athlete.firstname,
    athlete_lastname: athlete.lastname,
    athlete_profile_url: athlete.profile || athlete.profile_medium,
  });
  return repo.findConnection(userId);
}

async function refreshTokens(userId, connection) {
  assertStravaConfigured();
  const body = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ValidationError(data?.message || "Gagal refresh token Strava. Connect ulang.");
  }
  const expiresAt = new Date((Number(data.expires_at) || 0) * 1000);
  await repo.updateTokens(userId, {
    access_token: data.access_token,
    refresh_token: data.refresh_token || connection.refresh_token,
    expires_at: expiresAt,
  });
  return repo.findConnection(userId);
}

function needsRefresh(connection) {
  if (!connection?.expires_at) return true;
  const exp = new Date(connection.expires_at).getTime();
  return Number.isNaN(exp) || exp < Date.now() + 60_000;
}

/**
 * Authenticated request to Strava API with auto-refresh.
 * @param {string|number} userId
 * @param {string} path e.g. "/athlete/activities?per_page=50&page=1"
 */
export async function stravaApiRequest(userId, path) {
  let connection = await repo.findConnection(userId);
  if (!connection) throw new ValidationError("Belum terhubung ke Strava.");

  if (needsRefresh(connection)) {
    connection = await refreshTokens(userId, connection);
  }

  const doFetch = (token) =>
    fetch(`https://www.strava.com/api/v3${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let res = await doFetch(connection.access_token);
  if (res.status === 401) {
    connection = await refreshTokens(userId, connection);
    res = await doFetch(connection.access_token);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.errors?.[0]?.msg || `Strava API error ${res.status}`;
    throw new ValidationError(msg);
  }
  return data;
}

export function feRedirectUrl(query = {}) {
  const base = String(env.STRAVA_FE_REDIRECT || "http://localhost:5173/strava").replace(/\/$/, "");
  const q = new URLSearchParams(query);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}
