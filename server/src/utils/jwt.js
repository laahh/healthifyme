import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * @param {{ sub: string, email: string }} payload
 */
export function signAccessToken(payload) {
  const sub = String(payload.sub ?? "").trim();
  const email = String(payload.email ?? "").trim();
  if (!sub || !email) {
    throw new Error("Invalid JWT payload: missing sub or email");
  }
  return jwt.sign({ sub, email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: "health-app-api",
  });
}

/**
 * @param {string} token
 * @returns {{ sub: string, email: string }}
 */
export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: "health-app-api",
  });
  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }
  const rawSub = /** @type {{ sub?: unknown; email?: unknown }} */ (decoded).sub;
  const rawEmail = /** @type {{ sub?: unknown; email?: unknown }} */ (decoded).email;
  const sub = rawSub != null ? String(rawSub).trim() : "";
  const email = rawEmail != null ? String(rawEmail).trim() : "";
  if (!sub || !email) {
    throw new Error("Invalid token claims");
  }
  return { sub, email };
}

/** Short-lived OAuth state for Strava callback (~10 min). */
export function signStravaOAuthState(userId) {
  const sub = String(userId ?? "").trim();
  if (!sub) throw new Error("Invalid Strava OAuth state: missing userId");
  return jwt.sign({ sub, purpose: "strava_oauth" }, env.JWT_SECRET, {
    expiresIn: "10m",
    issuer: "health-app-api",
  });
}

/**
 * @param {string} token
 * @returns {string} userId
 */
export function verifyStravaOAuthState(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: "health-app-api",
  });
  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid Strava OAuth state");
  }
  const purpose = /** @type {{ purpose?: unknown; sub?: unknown }} */ (decoded).purpose;
  const sub = /** @type {{ purpose?: unknown; sub?: unknown }} */ (decoded).sub;
  if (purpose !== "strava_oauth") throw new Error("Invalid Strava OAuth purpose");
  const userId = sub != null ? String(sub).trim() : "";
  if (!userId) throw new Error("Invalid Strava OAuth sub");
  return userId;
}
