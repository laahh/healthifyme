import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

/**
 * @param {Record<string, unknown>} p
 */
export function isWorkoutHistoryPayload(p) {
  if (!p || typeof p !== "object") return false;
  if (p.type === "food") return false;
  if (p.type === "activity") return true;
  return Boolean(p.workoutMetrics && typeof p.workoutMetrics === "object");
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Record<string, unknown>} payload
 */
function rawJsonWithoutImage(payload) {
  try {
    const { image: _img, ...rest } = payload;
    return JSON.stringify(rest);
  } catch {
    return null;
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection | import('mysql2/promise').Pool} conn
 * @param {string} userId
 * @param {string} clientItemId
 */
export async function deleteWorkoutAnalysisByClientItem(conn, userId, clientItemId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;
  await conn.execute(
    `DELETE FROM workout_analyses WHERE user_id = :userId AND client_item_id = :clientItemId`,
    { userId: uid, clientItemId: String(clientItemId) }
  );
}

/**
 * Upsert baris workout_analyses dari payload history (type activity).
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} userId
 * @param {string} clientItemId
 * @param {Record<string, unknown>} payload
 */
export async function syncWorkoutAnalysisFromHistoryPayload(conn, userId, clientItemId, payload) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;

  if (!isWorkoutHistoryPayload(payload)) {
    await deleteWorkoutAnalysisByClientItem(conn, userId, clientItemId);
    return;
  }

  const p = payload;
  const m =
    p.workoutMetrics && typeof p.workoutMetrics === "object"
      ? /** @type {Record<string, unknown>} */ (p.workoutMetrics)
      : {};

  const activityType = String(p.activityType || p.foodName || "Workout").trim().slice(0, 512);
  const caloriesKcal = numOrNull(p.calories);
  const nutritionNotesShort =
    p.nutritionNotes != null ? String(p.nutritionNotes).trim().slice(0, 512) : null;
  const summaryText =
    p.workoutSummary != null ? String(p.workoutSummary) : p.nutritionNotes != null ? String(p.nutritionNotes) : null;

  const dateLine = m.dateLine != null ? String(m.dateLine).trim().slice(0, 255) : null;
  const timeRange = m.timeRange != null ? String(m.timeRange).trim().slice(0, 255) : null;
  const location = m.location != null ? String(m.location).trim().slice(0, 512) : null;
  const workoutTime = m.workoutTime != null ? String(m.workoutTime).trim().slice(0, 128) : null;
  const distance = m.distance != null ? String(m.distance).trim().slice(0, 128) : null;
  const activeKilocalories =
    m.activeKilocalories != null ? String(m.activeKilocalories).trim().slice(0, 128) : null;
  const totalKilocalories =
    m.totalKilocalories != null ? String(m.totalKilocalories).trim().slice(0, 128) : null;
  const elevationGain = m.elevationGain != null ? String(m.elevationGain).trim().slice(0, 128) : null;
  const avgPower = m.avgPower != null ? String(m.avgPower).trim().slice(0, 128) : null;
  const avgCadence = m.avgCadence != null ? String(m.avgCadence).trim().slice(0, 128) : null;
  const avgPace = m.avgPace != null ? String(m.avgPace).trim().slice(0, 128) : null;
  const avgHeartRate = m.avgHeartRate != null ? String(m.avgHeartRate).trim().slice(0, 128) : null;

  let rawMetricsJson = null;
  try {
    rawMetricsJson = JSON.stringify(m);
  } catch {
    rawMetricsJson = null;
  }
  const rawAiJson = rawJsonWithoutImage(p);

  const [existing] = await conn.execute(
    `SELECT id FROM workout_analyses WHERE user_id = :userId AND client_item_id = :clientItemId LIMIT 1`,
    { userId: uid, clientItemId: String(clientItemId) }
  );
  const rows = Array.isArray(existing) ? existing : [];
  const analysisId = rows[0]?.id != null ? Number(rows[0].id) : null;

  if (analysisId != null) {
    await conn.execute(
      `UPDATE workout_analyses SET
        activity_type = :activityType,
        calories_kcal = :caloriesKcal,
        nutrition_notes_short = :nutritionNotesShort,
        summary_text = :summaryText,
        date_line = :dateLine,
        time_range = :timeRange,
        location = :location,
        workout_time = :workoutTime,
        distance = :distance,
        active_kilocalories = :activeKilocalories,
        total_kilocalories = :totalKilocalories,
        elevation_gain = :elevationGain,
        avg_power = :avgPower,
        avg_cadence = :avgCadence,
        avg_pace = :avgPace,
        avg_heart_rate = :avgHeartRate,
        raw_metrics_json = CAST(:rawMetricsJson AS JSON),
        raw_ai_json = CAST(:rawAiJson AS JSON),
        updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = :analysisId`,
      {
        activityType,
        caloriesKcal,
        nutritionNotesShort,
        summaryText,
        dateLine,
        timeRange,
        location,
        workoutTime,
        distance,
        activeKilocalories,
        totalKilocalories,
        elevationGain,
        avgPower,
        avgCadence,
        avgPace,
        avgHeartRate,
        rawMetricsJson: rawMetricsJson || "{}",
        rawAiJson: rawAiJson || "{}",
        analysisId,
      }
    );
  } else {
    await conn.execute(
      `INSERT INTO workout_analyses (
        user_id, client_item_id, activity_type, calories_kcal, nutrition_notes_short, summary_text,
        date_line, time_range, location, workout_time, distance,
        active_kilocalories, total_kilocalories, elevation_gain,
        avg_power, avg_cadence, avg_pace, avg_heart_rate,
        raw_metrics_json, raw_ai_json
      ) VALUES (
        :userId, :clientItemId, :activityType, :caloriesKcal, :nutritionNotesShort, :summaryText,
        :dateLine, :timeRange, :location, :workoutTime, :distance,
        :activeKilocalories, :totalKilocalories, :elevationGain,
        :avgPower, :avgCadence, :avgPace, :avgHeartRate,
        CAST(:rawMetricsJson AS JSON), CAST(:rawAiJson AS JSON)
      )`,
      {
        userId: uid,
        clientItemId: String(clientItemId),
        activityType,
        caloriesKcal,
        nutritionNotesShort,
        summaryText,
        dateLine,
        timeRange,
        location,
        workoutTime,
        distance,
        activeKilocalories,
        totalKilocalories,
        elevationGain,
        avgPower,
        avgCadence,
        avgPace,
        avgHeartRate,
        rawMetricsJson: rawMetricsJson || "{}",
        rawAiJson: rawAiJson || "{}",
      }
    );
  }
}

/**
 * @param {string} userId
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 */
export async function listWorkoutAnalysesInDateRange(userId, startDate, endDate) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const start = String(startDate || "").slice(0, 10);
  const end = String(endDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, user_id, client_item_id, DATE(created_at) AS d, workout_time, calories_kcal,
            avg_heart_rate, activity_type, distance, created_at
     FROM workout_analyses
     WHERE user_id = :uid AND DATE(created_at) >= :start AND DATE(created_at) <= :end
     ORDER BY created_at ASC`,
    { uid: Number(uid), start, end }
  );
  const mine = String(uid);
  return (Array.isArray(rows) ? rows : []).filter((r) => String(r.user_id) === mine);
}

/**
 * Recent workout logs for the current user (manual / photo / sync).
 * @param {string} userId
 * @param {number} [limit]
 */
export async function listRecentWorkouts(userId, limit = 20) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const lim = Math.min(50, Math.max(1, Number(limit) || 20));
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, user_id, client_item_id, activity_type, calories_kcal, workout_time, distance,
            avg_heart_rate, summary_text, nutrition_notes_short, created_at
     FROM workout_analyses
     WHERE user_id = :uid
     ORDER BY created_at DESC
     LIMIT ${lim}`,
    { uid: Number(uid) }
  );
  const mine = String(uid);
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => String(r.user_id) === mine)
    .map((r) => ({
      id: String(r.id),
      client_item_id: r.client_item_id != null ? String(r.client_item_id) : "",
      activity_type: String(r.activity_type || "").trim() || "Workout",
      calories: r.calories_kcal != null ? Number(r.calories_kcal) : 0,
      workout_time: r.workout_time != null ? String(r.workout_time) : "",
      distance: r.distance != null ? String(r.distance) : "",
      avg_heart_rate: r.avg_heart_rate != null ? String(r.avg_heart_rate) : "",
      notes:
        (r.summary_text != null && String(r.summary_text).trim()) ||
        (r.nutrition_notes_short != null && String(r.nutrition_notes_short).trim()) ||
        "",
      created_at: r.created_at,
    }));
}
