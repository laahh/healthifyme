import * as workoutRepo from "../repositories/workoutAnalysis.repository.js";
import { parseWorkoutTimeStringToMinutes } from "../utils/workoutDurationMinutes.js";

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
 * @param {string} userId
 * @param {string} [refDateStr] YYYY-MM-DD — sembarang hari; minggu = Senin–Minggu yang memuat tanggal ini
 */
export async function getWeeklyWorkoutSummary(userId, refDateStr) {
  const monday = mondayOfWeekIso(refDateStr || "");
  const sunday = addDaysIso(monday, 6);
  const rows = await workoutRepo.listWorkoutAnalysesInDateRange(userId, monday, sunday);

  /** @type {Record<string, { durationMin: number, calories: number, sessions: number, hrSum: number, hrCount: number, hrMax: number | null }>} */
  const byDate = {};
  for (let i = 0; i < 7; i++) {
    byDate[addDaysIso(monday, i)] = {
      durationMin: 0,
      calories: 0,
      sessions: 0,
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
    const hr = parseHeartRateBpm(r.avg_heart_rate);
    if (hr != null) {
      byDate[key].hrSum += hr;
      byDate[key].hrCount += 1;
      const cur = byDate[key].hrMax;
      byDate[key].hrMax = cur == null ? hr : Math.max(cur, hr);
    }
  }

  const days = [];
  let totalDur = 0;
  let totalCal = 0;
  let totalSessions = 0;
  let totalHrSum = 0;
  let totalHrCount = 0;

  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(monday, i);
    const b = byDate[date];
    totalDur += b.durationMin;
    totalCal += b.calories;
    totalSessions += b.sessions;
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
      avg_heart_rate: dayAvgHr,
      max_heart_rate: b.hrMax,
    });
  }

  const avgMinPerDay = totalDur / 7;
  const weekAvgHr = totalHrCount > 0 ? Math.round(totalHrSum / totalHrCount) : null;

  return {
    week_start: monday,
    week_end: sunday,
    days,
    totals: {
      duration_min: totalDur,
      calories_kcal: Math.round(totalCal * 10) / 10,
      sessions: totalSessions,
    },
    avg_minutes_per_day: Math.round(avgMinPerDay * 10) / 10,
    avg_heart_rate_week: weekAvgHr,
  };
}
