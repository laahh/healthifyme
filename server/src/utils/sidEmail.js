const SID_EMAIL_DOMAIN = "sid.internal";

export function sidToEmail(sid) {
  const normalizedSid = String(sid || "").trim().toLowerCase();
  if (!normalizedSid) return "";
  return `${normalizedSid}@${SID_EMAIL_DOMAIN}`;
}

export function sidFromEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) return "";
  return e.split("@")[0] || "";
}

export function resolveLoginEmail(identity) {
  const raw = String(identity || "").trim();
  if (!raw) return "";
  return raw.includes("@") ? raw.toLowerCase() : sidToEmail(raw);
}
