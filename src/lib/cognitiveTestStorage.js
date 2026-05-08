import { COGNITIVE_TESTS_KEY } from "./storageKeys";

export function getCognitiveUserKey(user) {
  if (!user || typeof user !== "object") return "anon";
  const id = user.id != null ? String(user.id) : "";
  if (id) return id;
  const u = String(user.username || user.email || "").trim();
  return u || "anon";
}

function readAll() {
  try {
    const raw = localStorage.getItem(COGNITIVE_TESTS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(COGNITIVE_TESTS_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

const MAX_ENTRIES = 80;

/**
 * @param {string} userKey
 * @returns {{ pvt: object[]; memory: object[] }}
 */
export function getCognitiveResultsForUser(userKey) {
  const all = readAll();
  const row = all[userKey];
  if (!row || typeof row !== "object") return { pvt: [], memory: [], sessions: [] };
  return {
    pvt: Array.isArray(row.pvt) ? row.pvt : [],
    memory: Array.isArray(row.memory) ? row.memory : [],
    sessions: Array.isArray(row.sessions) ? row.sessions : [],
  };
}

/**
 * @param {string} userKey
 * @param {object} result
 */
export function appendPvtResult(userKey, result) {
  const all = readAll();
  if (!all[userKey]) all[userKey] = { pvt: [], memory: [], sessions: [] };
  const entry = {
    ...result,
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pvt_${Date.now()}`,
    at: new Date().toISOString(),
  };
  all[userKey].pvt = [...(all[userKey].pvt || []), entry].slice(-MAX_ENTRIES);
  writeAll(all);
  return entry;
}

/**
 * @param {string} userKey
 * @param {object} result
 */
export function appendMemoryResult(userKey, result) {
  const all = readAll();
  if (!all[userKey]) all[userKey] = { pvt: [], memory: [], sessions: [] };
  const entry = {
    ...result,
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `mem_${Date.now()}`,
    at: new Date().toISOString(),
  };
  all[userKey].memory = [...(all[userKey].memory || []), entry].slice(-MAX_ENTRIES);
  writeAll(all);
  return entry;
}

const MAX_SESSIONS = 40;

/**
 * Simpan ringkasan satu sesi (PVT + memori + penilaian gabungan).
 * @param {string} userKey
 * @param {object} sessionRecord
 */
export function appendCognitiveSession(userKey, sessionRecord) {
  const all = readAll();
  if (!all[userKey]) all[userKey] = { pvt: [], memory: [], sessions: [] };
  const entry = {
    ...sessionRecord,
    id:
      sessionRecord.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ses_${Date.now()}`),
    at: sessionRecord.at || new Date().toISOString(),
  };
  all[userKey].sessions = [...(all[userKey].sessions || []), entry].slice(-MAX_SESSIONS);
  writeAll(all);
  return entry;
}
