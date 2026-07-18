/**
 * Minggu dimulai Minggu (label UI: M,S,S,R,K,J,S).
 * Satu hari “aktif” (gabungan) jika ada upload makanan ATAU olahraga.
 */

/** Label singkat per kolom — Minggu → Sabtu. */
export const WEEK_LABELS_SUN_FIRST = [
  { label: "M", title: "Minggu" },
  { label: "S", title: "Senin" },
  { label: "S", title: "Selasa" },
  { label: "R", title: "Rabu" },
  { label: "K", title: "Kamis" },
  { label: "J", title: "Jumat" },
  { label: "S", title: "Sabtu" },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Kunci tanggal lokal YYYY-MM-DD untuk timestamp ms atau Date. */
export function localDateKeyFromTimestamp(ts) {
  if (ts == null) return null;
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n)) return null;
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Awal hari Minggu (00:00 lokal) untuk minggu yang berisi `reference`. */
export function startOfWeekSunday(reference = new Date()) {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Minggu
  d.setDate(d.getDate() - dow);
  return d;
}

function dateKeyForDayOffset(weekStartSunday, dayOffset) {
  const d = new Date(weekStartSunday);
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * @param {unknown[]} historyItems
 * @param {Date} [referenceDate]
 * @returns {{
 *   label: string,
 *   title: string,
 *   dateKey: string,
 *   food: boolean,
 *   activity: boolean,
 *   done: boolean,
 * }[]}
 */
export function buildWeekUploadCells(historyItems, referenceDate = new Date()) {
  /** @type {Set<string>} */
  const foodDays = new Set();
  /** @type {Set<string>} */
  const activityDays = new Set();

  if (Array.isArray(historyItems)) {
    for (const it of historyItems) {
      if (!it || it.createdAt == null) continue;
      const key = localDateKeyFromTimestamp(it.createdAt);
      if (!key) continue;
      if (it.type === "food") foodDays.add(key);
      else if (it.type === "activity") activityDays.add(key);
      else {
        // tipe tidak dikenal — hitung sebagai aktivitas umum agar tidak hilang
        activityDays.add(key);
      }
    }
  }

  const weekStart = startOfWeekSunday(referenceDate);

  return WEEK_LABELS_SUN_FIRST.map((meta, idx) => {
    const dateKey = dateKeyForDayOffset(weekStart, idx);
    const food = foodDays.has(dateKey);
    const activity = activityDays.has(dateKey);
    return {
      label: meta.label,
      title: meta.title,
      dateKey,
      food,
      activity,
      done: food || activity,
    };
  });
}

/**
 * Ringkasan konsistensi gabungan minggu ini.
 * @param {ReturnType<typeof buildWeekUploadCells>} cells
 */
export function summarizeWeekConsistency(cells) {
  const list = Array.isArray(cells) ? cells : [];
  const foodDays = list.filter((c) => c.food).length;
  const activityDays = list.filter((c) => c.activity).length;
  const combinedDays = list.filter((c) => c.done).length;
  const target = 7;
  const progressPct = Math.round((combinedDays / target) * 100);
  return {
    target,
    foodDays,
    activityDays,
    combinedDays,
    progressPct,
  };
}
