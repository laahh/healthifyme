import { apiRequest, isApiBackendEnabled } from "./apiClient";

/**
 * @param {{ date?: string }} [params]
 */
export async function fetchTodayHealthAlerts(params = {}) {
  if (!isApiBackendEnabled()) return null;
  const q = new URLSearchParams();
  if (params.date) q.set("date", String(params.date).slice(0, 10));
  const qs = q.toString();
  return apiRequest(`/me/health-alerts/today${qs ? `?${qs}` : ""}`);
}

/**
 * Evaluasi dengan meal sementara (scan belum save).
 * @param {{ pendingMeal?: object, date?: string }} body
 */
export async function evaluateHealthAlert(body = {}) {
  if (!isApiBackendEnabled()) return null;
  return apiRequest("/me/health-alerts/evaluate", {
    method: "POST",
    json: body,
  });
}

/**
 * @param {unknown} healthAlert
 * @returns {boolean}
 */
export function hasHealthAlerts(healthAlert) {
  if (!healthAlert || typeof healthAlert !== "object") return false;
  const alerts = healthAlert.alerts;
  return Array.isArray(alerts) && alerts.length > 0;
}

/**
 * @param {unknown} healthAlert
 * @returns {"info"|"warning"|"high"|null}
 */
export function healthAlertSeverity(healthAlert) {
  if (!healthAlert || typeof healthAlert !== "object") return null;
  const s = healthAlert.severity || healthAlert.primary?.severity;
  if (s === "info" || s === "warning" || s === "high") return s;
  return null;
}
