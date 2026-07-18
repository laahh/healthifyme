import * as workoutRepo from "../repositories/workoutAnalysis.repository.js";
import * as stravaRepo from "../repositories/strava.repository.js";
import { parseWorkoutTimeStringToMinutes } from "../utils/workoutDurationMinutes.js";
import * as healthRiskService from "./healthRisk.service.js";
import * as mcuService from "./mcu.service.js";

const DAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

/**
 * @param {string} refDateStr YYYY-MM-DD or empty
 */
export function mondayOfWeekIso(refDateStr) {
  const ref =
    refDateStr && /^\d{4}-\d{2}-\d{2}$/.test(refDateStr)
      ? refDateStr
      : new Date().toISOString().slice(0, 10);
  const d = new Date(`${ref}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} iso YYYY-MM-DD
 * @param {number} n
 */
export function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {unknown} v
 */
function rowDateKey(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function parseHeartRateBpm(v) {
  if (v == null || v === "") return null;
  const n = parseInt(String(v).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 30 && n < 260 ? n : null;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function parseDistanceToMeters(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return 0;
    return v > 100 ? Math.round(v) : Math.round(v * 1000);
  }
  const s = String(v).trim().toLowerCase();
  const n = parseFloat(s.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (/\bkm\b/.test(s)) return Math.round(n * 1000);
  if (/\bm\b/.test(s) && !/\bkm\b/.test(s)) return Math.round(n);
  return n > 100 ? Math.round(n) : Math.round(n * 1000);
}

function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} userId
 * @param {string} [refDateStr] YYYY-MM-DD — sembarang hari; minggu = Senin–Minggu yang memuat tanggal ini
 */
export async function getWeeklyWorkoutSummary(userId, refDateStr) {
  const uid = String(userId ?? "").trim();
  const emptyTargets = healthRiskService.defaultWorkoutTargets();
  if (!uid || !/^\d+$/.test(uid)) {
    return {
      week_start: mondayOfWeekIso(refDateStr || ""),
      week_end: addDaysIso(mondayOfWeekIso(refDateStr || ""), 6),
      days: [],
      totals: {
        duration_min: 0,
        calories_kcal: 0,
        sessions: 0,
        strava_sessions: 0,
        manual_sessions: 0,
        distance_m: 0,
      },
      avg_minutes_per_day: 0,
      avg_heart_rate_week: null,
      user_id: uid || null,
      daily_target_duration_min: emptyTargets.duration_min,
      weekly_target_sessions: emptyTargets.sessions_per_week,
      target_source: emptyTargets.source,
    };
  }

  const monday = mondayOfWeekIso(refDateStr || "");
  const sunday = addDaysIso(monday, 6);
  const [rowsRaw, stravaRaw] = await Promise.all([
    workoutRepo.listWorkoutAnalysesInDateRange(uid, monday, sunday),
    stravaRepo.listActivitiesInDateRange(uid, monday, sunday).catch(() => []),
  ]);

  // Defense-in-depth: hanya hitung baris milik user login.
  const rows = (rowsRaw || []).filter((r) => String(r.user_id) === uid);
  const stravaActivities = (stravaRaw || []).filter((a) => String(a.user_id) === uid);

  /** @type {Record<string, { durationMin: number, calories: number, sessions: number, stravaSessions: number, manualSessions: number, distanceM: number, hrSum: number, hrCount: number, hrMax: number | null }>} */
  const byDate = {};
  for (let i = 0; i < 7; i++) {
    byDate[addDaysIso(monday, i)] = {
      durationMin: 0,
      calories: 0,
      sessions: 0,
      stravaSessions: 0,
      manualSessions: 0,
      distanceM: 0,
      hrSum: 0,
      hrCount: 0,
      hrMax: null,
    };
  }

  for (const r of rows) {
    const key = rowDateKey(r.d);
    if (!byDate[key]) continue;
    const dur = parseWorkoutTimeStringToMinutes(r.workout_time);
    const cal = r.calories_kcal != null ? Number(r.calories_kcal) : 0;
    byDate[key].durationMin += dur;
    byDate[key].calories += Number.isFinite(cal) ? cal : 0;
    byDate[key].sessions += 1;
    byDate[key].manualSessions += 1;
    const hr = parseHeartRateBpm(r.avg_heart_rate);
    if (hr != null) {
      byDate[key].hrSum += hr;
      byDate[key].hrCount += 1;
      const cur = byDate[key].hrMax;
      byDate[key].hrMax = cur == null ? hr : Math.max(cur, hr);
    }
  }

  for (const a of stravaActivities) {
    const key = rowDateKey(a.start_date);
    if (!byDate[key]) continue;
    const dur = Math.round(((Number(a.moving_time_s) || Number(a.elapsed_time_s) || 0) / 60) * 10) / 10;
    const cal = a.calories != null ? Number(a.calories) : 0;
    const dist = Number(a.distance_m) || 0;
    byDate[key].durationMin += Number.isFinite(dur) ? dur : 0;
    byDate[key].calories += Number.isFinite(cal) ? cal : 0;
    byDate[key].distanceM += Number.isFinite(dist) ? dist : 0;
    byDate[key].sessions += 1;
    byDate[key].stravaSessions += 1;
    const hr = a.average_heartrate != null ? Number(a.average_heartrate) : NaN;
    if (Number.isFinite(hr) && hr > 0) {
      byDate[key].hrSum += hr;
      byDate[key].hrCount += 1;
    }
    const maxHr = a.max_heartrate != null ? Number(a.max_heartrate) : NaN;
    const peak = Number.isFinite(maxHr) && maxHr > 0 ? maxHr : Number.isFinite(hr) && hr > 0 ? hr : null;
    if (peak != null) {
      const cur = byDate[key].hrMax;
      byDate[key].hrMax = cur == null ? peak : Math.max(cur, peak);
    }
  }

  const days = [];
  let totalDur = 0;
  let totalCal = 0;
  let totalSessions = 0;
  let totalStravaSessions = 0;
  let totalManualSessions = 0;
  let totalDistanceM = 0;
  let totalHrSum = 0;
  let totalHrCount = 0;

  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(monday, i);
    const b = byDate[date];
    totalDur += b.durationMin;
    totalCal += b.calories;
    totalSessions += b.sessions;
    totalStravaSessions += b.stravaSessions;
    totalManualSessions += b.manualSessions;
    totalDistanceM += b.distanceM;
    totalHrSum += b.hrSum;
    totalHrCount += b.hrCount;
    const dayAvgHr = b.hrCount > 0 ? Math.round(b.hrSum / b.hrCount) : null;
    days.push({
      index: i,
      label: DAY_LABELS[i],
      date,
      duration_min: b.durationMin,
      calories_kcal: Math.round(b.calories * 10) / 10,
      sessions: b.sessions,
      strava_sessions: b.stravaSessions,
      manual_sessions: b.manualSessions,
      distance_m: Math.round(b.distanceM),
      avg_heart_rate: dayAvgHr,
      max_heart_rate: b.hrMax,
    });
  }

  const avgMinPerDay = totalDur / 7;
  const weekAvgHr = totalHrCount > 0 ? Math.round(totalHrSum / totalHrCount) : null;

  const anchorDate = refDateStr && /^\d{4}-\d{2}-\d{2}$/.test(refDateStr) ? refDateStr : monday;
  let targets = emptyTargets;
  try {
    targets = await healthRiskService.resolveWorkoutTargets(uid, anchorDate);
  } catch {
    /* keep default */
  }

  return {
    week_start: monday,
    week_end: sunday,
    user_id: uid,
    days,
    totals: {
      duration_min: totalDur,
      calories_kcal: Math.round(totalCal * 10) / 10,
      sessions: totalSessions,
      strava_sessions: totalStravaSessions,
      manual_sessions: totalManualSessions,
      distance_m: Math.round(totalDistanceM),
    },
    avg_minutes_per_day: Math.round(avgMinPerDay * 10) / 10,
    avg_heart_rate_week: weekAvgHr,
    daily_target_duration_min: targets.duration_min,
    weekly_target_sessions: targets.sessions_per_week,
    target_source: targets.source,
  };
}

/**
 * @param {string} userId
 * @param {string} dateStr YYYY-MM-DD
 */
export async function getDailyWorkoutSummary(userId, dateStr) {
  const uid = String(userId ?? "").trim();
  const date =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr.slice(0, 10) : localTodayYmd();
  const isToday = date === localTodayYmd();

  if (!uid || !/^\d+$/.test(uid)) {
    const targets = healthRiskService.defaultWorkoutTargets();
    const totals = {
      duration_min: 0,
      calories_kcal: 0,
      sessions: 0,
      strava_sessions: 0,
      manual_sessions: 0,
      distance_m: 0,
      avg_heart_rate: null,
      max_heart_rate: null,
    };
    return {
      date,
      user_id: uid || null,
      items: [],
      totals,
      targets,
      workoutStory: healthRiskService.buildWorkoutStory(totals, [], { date, isToday, targets }),
    };
  }

  const [rowsRaw, stravaRaw, targets, mcuResult] = await Promise.all([
    workoutRepo.listWorkoutAnalysesInDateRange(uid, date, date),
    stravaRepo.listActivitiesInDateRange(uid, date, date).catch(() => []),
    healthRiskService.resolveWorkoutTargets(uid, date),
    mcuService.getMcuForUser(uid).catch(() => ({ mcu: null })),
  ]);

  const rows = (rowsRaw || []).filter((r) => String(r.user_id) === uid);
  const stravaActivities = (stravaRaw || []).filter((a) => String(a.user_id) === uid);
  const profile = healthRiskService.buildRiskProfile(mcuResult?.mcu);

  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  let totalDur = 0;
  let totalCal = 0;
  let totalDistance = 0;
  let hrSum = 0;
  let hrCount = 0;
  let hrMax = null;

  for (const r of rows) {
    const dur = parseWorkoutTimeStringToMinutes(r.workout_time);
    const cal = r.calories_kcal != null ? Number(r.calories_kcal) : 0;
    const hr = parseHeartRateBpm(r.avg_heart_rate);
    const distM = parseDistanceToMeters(r.distance);
    totalDur += dur;
    totalCal += Number.isFinite(cal) ? cal : 0;
    totalDistance += distM;
    if (hr != null) {
      hrSum += hr;
      hrCount += 1;
      hrMax = hrMax == null ? hr : Math.max(hrMax, hr);
    }
    const clientId = r.client_item_id != null ? String(r.client_item_id) : "";
    items.push({
      id: r.id != null ? String(r.id) : `manual-${rowDateKey(r.created_at)}`,
      source: "manual",
      name: r.activity_type || "Olahraga",
      sport_type: r.activity_type || null,
      duration_min: Math.round(dur * 10) / 10,
      calories_kcal: Number.isFinite(cal) ? Math.round(cal * 10) / 10 : 0,
      distance_m: distM,
      avg_heart_rate: hr,
      max_heart_rate: hr,
      average_speed: null,
      total_elevation_gain: null,
      start_at: r.created_at,
      href: clientId ? `/history/${clientId}` : null,
      client_item_id: clientId || null,
    });
  }

  for (const a of stravaActivities) {
    const dur = Math.round(((Number(a.moving_time_s) || Number(a.elapsed_time_s) || 0) / 60) * 10) / 10;
    const cal = a.calories != null ? Number(a.calories) : 0;
    const dist = Number(a.distance_m) || 0;
    totalDur += Number.isFinite(dur) ? dur : 0;
    totalCal += Number.isFinite(cal) ? cal : 0;
    totalDistance += Number.isFinite(dist) ? dist : 0;
    const hrRaw = a.average_heartrate != null ? Number(a.average_heartrate) : NaN;
    const hr = Number.isFinite(hrRaw) && hrRaw > 0 ? Math.round(hrRaw) : null;
    if (hr != null) {
      hrSum += hr;
      hrCount += 1;
    }
    const maxRaw = a.max_heartrate != null ? Number(a.max_heartrate) : NaN;
    const peak =
      Number.isFinite(maxRaw) && maxRaw > 0
        ? Math.round(maxRaw)
        : hr;
    if (peak != null) {
      hrMax = hrMax == null ? peak : Math.max(hrMax, peak);
    }
    const aid = a.id != null ? String(a.id) : "";
    const elev =
      a.total_elevation_gain != null && Number.isFinite(Number(a.total_elevation_gain))
        ? Math.round(Number(a.total_elevation_gain) * 10) / 10
        : null;
    const avgSpd =
      a.average_speed != null && Number.isFinite(Number(a.average_speed))
        ? Number(a.average_speed)
        : null;
    items.push({
      id: aid || `strava-${rowDateKey(a.start_date)}`,
      source: "strava",
      name: a.name || a.sport_type || a.type || "Strava",
      sport_type: a.sport_type || a.type || null,
      duration_min: Number.isFinite(dur) ? dur : 0,
      calories_kcal: Number.isFinite(cal) ? Math.round(cal * 10) / 10 : 0,
      distance_m: Math.round(dist),
      avg_heart_rate: hr,
      max_heart_rate: peak,
      average_speed: avgSpd,
      total_elevation_gain: elev,
      start_at: a.start_date,
      href: aid ? `/strava/activities/${aid}` : "/strava",
      client_item_id: null,
    });
  }

  items.sort((a, b) => {
    const ta = a.start_at ? new Date(/** @type {string} */ (a.start_at)).getTime() : 0;
    const tb = b.start_at ? new Date(/** @type {string} */ (b.start_at)).getTime() : 0;
    return tb - ta;
  });

  const totals = {
    duration_min: Math.round(totalDur * 10) / 10,
    calories_kcal: Math.round(totalCal * 10) / 10,
    sessions: items.length,
    strava_sessions: stravaActivities.length,
    manual_sessions: rows.length,
    distance_m: Math.round(totalDistance),
    avg_heart_rate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    max_heart_rate: hrMax,
  };

  let workoutStory;
  try {
    workoutStory = healthRiskService.buildWorkoutStory(totals, profile.flags || [], {
      date,
      isToday,
      targets,
    });
  } catch (err) {
    console.warn("[workoutInsight] daily-summary story:", err?.message || err);
    workoutStory = healthRiskService.buildWorkoutStory(totals, [], { date, isToday, targets });
  }

  return {
    date,
    user_id: uid,
    items,
    totals,
    targets,
    workoutStory,
  };
}
