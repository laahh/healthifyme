/**
 * Minggu dimulai Minggu (sesuai urutan label di UI: M,S,S,R,K,J,S).
 * Satu hari dianggap konsisten jika ada minimal satu item riwayat (makanan atau olahraga) dengan createdAt di tanggal itu (timezone lokal).
 */

/** Label singkat per kolom — sama seperti desain sebelumnya (Minggu → Sabtu). */
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
 * @param {unknown[]} historyItems - item dari localStorage (punya createdAt)
 * @param {Date} [referenceDate]
 * @returns {{ label: string, title: string, done: boolean, dateKey: string }[]}
 */
export function buildWeekUploadCells(historyItems, referenceDate = new Date()) {
  const uploaded = new Set();
  if (Array.isArray(historyItems)) {
    for (const it of historyItems) {
      if (!it || it.createdAt == null) continue;
      const key = localDateKeyFromTimestamp(it.createdAt);
      if (key) uploaded.add(key);
    }
  }

  const weekStart = startOfWeekSunday(referenceDate);

  return WEEK_LABELS_SUN_FIRST.map((meta, idx) => {
    const dateKey = dateKeyForDayOffset(weekStart, idx);
    return {
      label: meta.label,
      title: meta.title,
      dateKey,
      done: uploaded.has(dateKey),
    };
  });
}
