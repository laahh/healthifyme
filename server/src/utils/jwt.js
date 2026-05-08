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
