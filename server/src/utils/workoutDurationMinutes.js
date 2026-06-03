/**
 * @param {unknown} workoutTimeStr
 * @returns {number}
 */
export function parseWorkoutTimeStringToMinutes(workoutTimeStr) {
  const raw = String(workoutTimeStr ?? "").trim();
  if (!raw) return 0;

  const lower = raw.toLowerCase();
  const minWord = lower.match(/(\d+(?:[.,]\d+)?)\s*(menit|min(?:ute)?s?)\b/i);
  if (minWord) {
    const n = Number(String(minWord[1]).replace(",", "."));
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }

  if (!raw.includes(":")) {
    const n = Number(raw.replace(/[^\d.]/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }

  const segments = raw.split(":").map((p) => {
    const t = p.replace(/[^\d.]/g, "").replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  });

  if (segments.length >= 3) {
    const [h, m, sec] = segments;
    return Math.max(0, Math.round(h * 60 + m + sec / 60));
  }
  if (segments.length === 2) {
    const [a, b] = segments;
    if (a > 24) return Math.max(0, Math.round(a + b / 60));
    return Math.max(0, Math.round(a * 60 + b));
  }
  return 0;
}
