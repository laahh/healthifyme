import { apiRequest, isApiBackendEnabled } from "./apiClient";

async function stravaRequest(path, options) {
  if (!isApiBackendEnabled()) {
    const err = new Error("API belum dikonfigurasi (VITE_API_URL).");
    err.code = "API_DISABLED";
    throw err;
  }
  return apiRequest(path, options);
}

export function fetchStravaStatus() {
  return stravaRequest("/strava/status");
}

export function fetchStravaAuthUrl() {
  return stravaRequest("/strava/auth-url");
}

export function syncStrava() {
  return stravaRequest("/strava/sync", { method: "POST", json: {} });
}

export function disconnectStrava() {
  return stravaRequest("/strava/disconnect", { method: "DELETE" });
}

export function fetchStravaActivities(params = {}) {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return stravaRequest(`/strava/activities${qs ? `?${qs}` : ""}`);
}

/**
 * @param {string|number} id
 * @param {{ enrich?: boolean }} [opts]
 */
export function fetchStravaActivity(id, opts = {}) {
  const q = new URLSearchParams();
  if (opts.enrich === false) q.set("enrich", "0");
  const qs = q.toString();
  return stravaRequest(`/strava/activities/${id}${qs ? `?${qs}` : ""}`);
}

export function formatDistanceKm(meters) {
  const km = (Number(meters) || 0) / 1000;
  return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Pace min/km from distance_m + moving_time_s */
export function formatPace(distanceM, movingTimeS) {
  const m = Number(distanceM) || 0;
  const t = Number(movingTimeS) || 0;
  if (m < 50 || t <= 0) return "—";
  const secPerKm = t / (m / 1000);
  const mm = Math.floor(secPerKm / 60);
  const ss = Math.round(secPerKm % 60);
  return `${mm}:${String(ss).padStart(2, "0")} /km`;
}

/** m/s → km/h */
export function formatSpeedKmh(mps) {
  if (mps == null || !Number.isFinite(Number(mps))) return "—";
  return `${(Number(mps) * 3.6).toFixed(1)} km/j`;
}

export function formatHr(bpm) {
  if (bpm == null || !Number.isFinite(Number(bpm))) return "—";
  return `${Math.round(Number(bpm))} bpm`;
}

export function sportIcon(sportType) {
  const s = String(sportType || "").toLowerCase();
  if (s.includes("ride") || s.includes("bike") || s.includes("cycle")) return "directions_bike";
  if (s.includes("swim")) return "pool";
  if (s.includes("walk") || s.includes("hike")) return "hiking";
  if (s.includes("weight") || s.includes("gym") || s.includes("workout")) return "exercise";
  return "directions_run";
}

/** Best photo URL from Strava urls object (keys are sizes). */
export function pickPhotoUrl(urls) {
  if (!urls || typeof urls !== "object") return null;
  const preferred = ["600", "573", "500", "300", "100"];
  for (const k of preferred) {
    if (urls[k]) return urls[k];
  }
  const vals = Object.values(urls).filter((u) => typeof u === "string" && u.startsWith("http"));
  return vals[0] || null;
}
