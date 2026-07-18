import { ValidationError } from "../domain/errors/AppError.js";
import * as historyService from "./history.service.js";
import * as workoutRepo from "../repositories/workoutAnalysis.repository.js";

const POPULAR = [
  { id: "run", name: "Lari", calories: 300, duration_min: 30, icon: "directions_run" },
  { id: "walk", name: "Jalan Kaki", calories: 150, duration_min: 30, icon: "directions_walk" },
  { id: "cycle", name: "Bersepeda", calories: 350, duration_min: 40, icon: "directions_bike" },
  { id: "gym", name: "Gym / Strength", calories: 250, duration_min: 45, icon: "fitness_center" },
  { id: "yoga", name: "Yoga", calories: 120, duration_min: 30, icon: "self_improvement" },
  { id: "swim", name: "Renang", calories: 400, duration_min: 40, icon: "pool" },
  { id: "badminton", name: "Badminton", calories: 280, duration_min: 45, icon: "sports_tennis" },
  { id: "football", name: "Sepak Bola", calories: 450, duration_min: 60, icon: "sports_soccer" },
  { id: "padel", name: "Padel", calories: 350, duration_min: 60, icon: "sports_tennis" },
  { id: "hiit", name: "HIIT", calories: 320, duration_min: 25, icon: "bolt" },
];

function formatDurationLabel(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return "";
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}j ${rem}m` : `${h}j`;
}

export function getCatalog(query = {}) {
  const q = String(query.q || "").trim().toLowerCase();
  const items = !q
    ? POPULAR
    : POPULAR.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q));
  return items.map((p) => ({
    ...p,
    duration_label: formatDurationLabel(p.duration_min),
  }));
}

export async function getRecent(userId, query = {}) {
  return workoutRepo.listRecentWorkouts(userId, query.limit ? Number(query.limit) : 20);
}

/**
 * Log olahraga manual / quick-add via history pipeline → workout_analyses.
 */
export async function logWorkout(userId, body) {
  const activityType = String(body?.activity_type || body?.name || "").trim();
  if (!activityType) throw new ValidationError("Jenis olahraga wajib.");

  const calories = Number(body?.calories);
  if (!Number.isFinite(calories) || calories < 0) {
    throw new ValidationError("Kalori tidak valid.");
  }

  const durationMin = body?.duration_min != null ? Number(body.duration_min) : null;
  const workoutTime =
    body?.workout_time != null && String(body.workout_time).trim()
      ? String(body.workout_time).trim().slice(0, 128)
      : durationMin != null && Number.isFinite(durationMin) && durationMin > 0
        ? formatDurationLabel(durationMin)
        : "";

  const distance =
    body?.distance != null && String(body.distance).trim()
      ? String(body.distance).trim().slice(0, 128)
      : "";

  const avgHeartRate =
    body?.avg_heart_rate != null && String(body.avg_heart_rate).trim()
      ? String(body.avg_heart_rate).trim().slice(0, 128)
      : "";

  const notes = body?.notes != null ? String(body.notes).trim() : "";

  const clientItemId =
    String(body?.client_item_id || "").trim() ||
    `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const payload = {
    type: "activity",
    activityType,
    foodName: activityType,
    calories,
    nutritionNotes: notes || null,
    workoutSummary: notes || `${activityType} — log manual`,
    workoutMetrics: {
      workoutTime: workoutTime || null,
      distance: distance || null,
      activeKilocalories: String(calories),
      totalKilocalories: String(calories),
      avgHeartRate: avgHeartRate || null,
      source: "manual",
    },
    source_type: "manual",
    sourceType: "manual",
    loggedAt: new Date().toISOString(),
  };

  await historyService.upsertHistory(
    userId,
    userId,
    clientItemId,
    payload,
    new Date().toISOString()
  );

  return {
    client_item_id: clientItemId,
    activity_type: activityType,
    calories,
    workout_time: workoutTime,
    distance,
    source_type: "manual",
  };
}
