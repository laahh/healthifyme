import { apiRequest, isApiBackendEnabled } from "./apiClient";

async function workoutRequest(path, options) {
  if (!isApiBackendEnabled()) {
    const err = new Error("API belum dikonfigurasi (VITE_API_URL).");
    err.code = "API_DISABLED";
    throw err;
  }
  return apiRequest(path, options);
}

export const FALLBACK_WORKOUT_CATALOG = [
  { id: "run", name: "Lari", calories: 300, duration_min: 30, duration_label: "30 menit", icon: "directions_run" },
  { id: "walk", name: "Jalan Kaki", calories: 150, duration_min: 30, duration_label: "30 menit", icon: "directions_walk" },
  { id: "cycle", name: "Bersepeda", calories: 350, duration_min: 40, duration_label: "40 menit", icon: "directions_bike" },
  { id: "gym", name: "Gym / Strength", calories: 250, duration_min: 45, duration_label: "45 menit", icon: "fitness_center" },
  { id: "yoga", name: "Yoga", calories: 120, duration_min: 30, duration_label: "30 menit", icon: "self_improvement" },
  { id: "swim", name: "Renang", calories: 400, duration_min: 40, duration_label: "40 menit", icon: "pool" },
  { id: "badminton", name: "Badminton", calories: 280, duration_min: 45, duration_label: "45 menit", icon: "sports_tennis" },
  { id: "football", name: "Sepak Bola", calories: 450, duration_min: 60, duration_label: "60 menit", icon: "sports_soccer" },
  { id: "padel", name: "Padel", calories: 350, duration_min: 60, duration_label: "60 menit", icon: "sports_tennis" },
  { id: "hiit", name: "HIIT", calories: 320, duration_min: 25, duration_label: "25 menit", icon: "bolt" },
];

export function fetchWorkoutCatalog(params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  const qs = q.toString();
  return workoutRequest(`/workout/catalog${qs ? `?${qs}` : ""}`);
}

export function fetchWorkoutRecent() {
  return workoutRequest("/workout/recent");
}

export function logWorkoutItem(body) {
  return workoutRequest("/workout/log", { method: "POST", json: body });
}
