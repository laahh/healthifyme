import { getSessionUser } from "../auth/auth";
import { apiRequest, getAuthToken, isApiBackendEnabled } from "./apiClient";

/** Sinkron ke MySQL hanya jika login lewat API Node (JWT) dan user.id numerik (employee_profiles.id). */
export function shouldSyncCognitiveToBackend() {
  if (!isApiBackendEnabled()) return false;
  if (!getAuthToken()) return false;
  const id = getSessionUser()?.id;
  return id != null && /^\d+$/.test(String(id).trim());
}

/**
 * @param {object} entry - hasil appendPvtResult
 */
export async function syncPvtResultToBackend(entry) {
  if (!shouldSyncCognitiveToBackend() || !entry?.id) return;
  try {
    await apiRequest("/me/cognitive-tests/pvt", {
      method: "POST",
      json: {
        id: entry.id,
        at: entry.at,
        sessionId: entry.sessionId ?? null,
        trials: entry.trials,
        validTrials: entry.validTrials,
        meanRtMs: entry.meanRtMs,
        medianRtMs: entry.medianRtMs,
        lapses: entry.lapses,
        falseStarts: entry.falseStarts,
        passed: entry.passed,
        evaluationLabel: entry.evaluationLabel,
      },
    });
  } catch (e) {
    console.warn("[cognitive] Sync PVT gagal:", e?.message || e);
  }
}

/**
 * @param {object} entry - hasil appendMemoryResult
 */
export async function syncMemoryResultToBackend(entry) {
  if (!shouldSyncCognitiveToBackend() || !entry?.id) return;
  try {
    await apiRequest("/me/cognitive-tests/memory", {
      method: "POST",
      json: {
        id: entry.id,
        at: entry.at,
        sessionId: entry.sessionId ?? null,
        rounds: entry.rounds,
        roundsCorrect: entry.roundsCorrect,
        maxSpan: entry.maxSpan,
        sumCorrectLengths: entry.sumCorrectLengths,
        score: entry.score,
        passed: entry.passed,
        evaluationLabel: entry.evaluationLabel,
      },
    });
  } catch (e) {
    console.warn("[cognitive] Sync memori gagal:", e?.message || e);
  }
}

/**
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} [params.at]
 * @param {object} params.overall
 * @param {object} [params.pvt]
 * @param {object} [params.memory]
 */
export async function syncSessionSummaryToBackend({ sessionId, at, overall, pvt, memory }) {
  if (!shouldSyncCognitiveToBackend() || !sessionId || !overall) return;
  try {
    await apiRequest("/me/cognitive-tests/session", {
      method: "POST",
      json: {
        sessionId,
        at,
        overall: {
          level: overall.level,
          title: overall.title,
          subtitle: overall.subtitle,
          color: overall.color,
          recommendations: overall.recommendations,
        },
        pvt,
        memory,
      },
    });
  } catch (e) {
    console.warn("[cognitive] Sync sesi gagal:", e?.message || e);
  }
}
