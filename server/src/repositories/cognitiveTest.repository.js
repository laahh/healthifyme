import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

function parseTestedAt(iso) {
  if (iso == null || iso === "") return new Date();
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** @param {boolean | undefined | null} v */
function toSqlPassed(v) {
  if (v === true) return 1;
  if (v === false) return 0;
  return null;
}

/**
 * @param {string} userId
 * @param {object} body - normalized from controller
 */
export async function upsertPvtResult(userId, body) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  const testedAt = parseTestedAt(body.at);
  const raw = JSON.stringify(body.rawPayload ?? {});

  await pool.execute(
    `INSERT INTO cognitive_pvt_results (
       user_id, client_id, session_id, trials, valid_trials, mean_rt_ms, median_rt_ms,
       lapses, false_starts, passed, evaluation_label, raw_payload, tested_at
     ) VALUES (
       :userId, :clientId, :sessionId, :trials, :validTrials, :meanRt, :medianRt,
       :lapses, :falseStarts, :passed, :evalLabel, CAST(:rawPayload AS JSON), :testedAt
     )
     ON DUPLICATE KEY UPDATE
       session_id = VALUES(session_id),
       trials = VALUES(trials),
       valid_trials = VALUES(valid_trials),
       mean_rt_ms = VALUES(mean_rt_ms),
       median_rt_ms = VALUES(median_rt_ms),
       lapses = VALUES(lapses),
       false_starts = VALUES(false_starts),
       passed = VALUES(passed),
       evaluation_label = VALUES(evaluation_label),
       raw_payload = VALUES(raw_payload),
       tested_at = VALUES(tested_at)`,
    {
      userId: uid,
      clientId: String(body.clientId),
      sessionId: body.sessionId != null && body.sessionId !== "" ? String(body.sessionId) : null,
      trials: Number(body.trials) || 0,
      validTrials: Number(body.validTrials) || 0,
      meanRt: Number(body.meanRtMs) || 0,
      medianRt: Number(body.medianRtMs) || 0,
      lapses: Number(body.lapses) || 0,
      falseStarts: Number(body.falseStarts) || 0,
      passed: toSqlPassed(body.passed),
      evalLabel: body.evaluationLabel != null ? String(body.evaluationLabel).slice(0, 512) : null,
      rawPayload: raw,
      testedAt,
    }
  );
  return true;
}

/**
 * @param {string} userId
 * @param {object} body
 */
export async function upsertMemoryResult(userId, body) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  const testedAt = parseTestedAt(body.at);
  const raw = JSON.stringify(body.rawPayload ?? {});

  await pool.execute(
    `INSERT INTO cognitive_memory_results (
       user_id, client_id, session_id, rounds, rounds_correct, max_span, sum_correct_lengths,
       score, passed, evaluation_label, raw_payload, tested_at
     ) VALUES (
       :userId, :clientId, :sessionId, :rounds, :roundsCorrect, :maxSpan, :sumCorrect,
       :score, :passed, :evalLabel, CAST(:rawPayload AS JSON), :testedAt
     )
     ON DUPLICATE KEY UPDATE
       session_id = VALUES(session_id),
       rounds = VALUES(rounds),
       rounds_correct = VALUES(rounds_correct),
       max_span = VALUES(max_span),
       sum_correct_lengths = VALUES(sum_correct_lengths),
       score = VALUES(score),
       passed = VALUES(passed),
       evaluation_label = VALUES(evaluation_label),
       raw_payload = VALUES(raw_payload),
       tested_at = VALUES(tested_at)`,
    {
      userId: uid,
      clientId: String(body.clientId),
      sessionId: body.sessionId != null && body.sessionId !== "" ? String(body.sessionId) : null,
      rounds: Number(body.rounds) || 0,
      roundsCorrect: Number(body.roundsCorrect) || 0,
      maxSpan: Number(body.maxSpan) || 0,
      sumCorrect: Number(body.sumCorrectLengths) || 0,
      score: Number(body.score) || 0,
      passed: toSqlPassed(body.passed),
      evalLabel: body.evaluationLabel != null ? String(body.evaluationLabel).slice(0, 512) : null,
      rawPayload: raw,
      testedAt,
    }
  );
  return true;
}

/**
 * @param {string} userId
 * @param {object} body
 */
export async function upsertTestSession(userId, body) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  const testedAt = parseTestedAt(body.at);
  const overallStr = JSON.stringify(body.overall ?? {});
  const level = String(body.overallLevel ?? "").slice(0, 32);
  /** @type {string | null} */
  const pvtStr = body.pvt !== undefined && body.pvt !== null ? JSON.stringify(body.pvt) : null;
  /** @type {string | null} */
  const memStr = body.memory !== undefined && body.memory !== null ? JSON.stringify(body.memory) : null;

  await pool.execute(
    `INSERT INTO cognitive_test_sessions (
       user_id, session_id, overall_level, overall_json, pvt_json, memory_json, tested_at
     ) VALUES (
       :userId, :sessionId, :level, CAST(:overallJson AS JSON),
       CAST(:pvtJson AS JSON), CAST(:memJson AS JSON), :testedAt
     )
     ON DUPLICATE KEY UPDATE
       overall_level = VALUES(overall_level),
       overall_json = VALUES(overall_json),
       pvt_json = VALUES(pvt_json),
       memory_json = VALUES(memory_json),
       tested_at = VALUES(tested_at)`,
    {
      userId: uid,
      sessionId: String(body.sessionId),
      level,
      overallJson: overallStr,
      pvtJson: pvtStr ?? "null",
      memJson: memStr ?? "null",
      testedAt,
    }
  );
  return true;
}
