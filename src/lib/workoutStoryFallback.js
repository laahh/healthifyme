/** Default target jika API belum mengirim targets / workoutStory. */
export const DEFAULT_DURATION_TARGET_MIN = 30;
export const DEFAULT_SESSIONS_PER_WEEK = 3;
export const LOOKBACK_DAYS = 90;

/**
 * @returns {{
 *   duration_min: number,
 *   sessions_per_week: number,
 *   source: string,
 *   has_active_goal: boolean,
 * }}
 */
export function defaultWorkoutTargets() {
  return {
    duration_min: DEFAULT_DURATION_TARGET_MIN,
    sessions_per_week: DEFAULT_SESSIONS_PER_WEEK,
    source: "default",
    has_active_goal: false,
  };
}

/**
 * @param {unknown} dailySummary
 * @param {{ isToday?: boolean }} [opts]
 */
export function resolveWorkoutStoryFromDaily(dailySummary, opts = {}) {
  if (dailySummary?.workoutStory && typeof dailySummary.workoutStory === "object") {
    return dailySummary.workoutStory;
  }

  const targets = dailySummary?.targets || defaultWorkoutTargets();
  const date = String(dailySummary?.date || "").slice(0, 10);
  const isToday = opts.isToday !== undefined ? opts.isToday : true;
  const totals = dailySummary?.totals || {};
  const sessions =
    Array.isArray(dailySummary?.items) && dailySummary.items.length > 0
      ? dailySummary.items.length
      : Number(totals.sessions) || 0;
  const duration = Number(totals.duration_min) || 0;
  const durationTarget = Number(targets.duration_min) || DEFAULT_DURATION_TARGET_MIN;
  const durationProgressPct =
    durationTarget > 0 ? Math.round((duration / durationTarget) * 100) : 0;

  if (sessions <= 0) {
    return {
      score: null,
      grade: "incomplete",
      title: isToday ? "Belum ada olahraga tercatat" : "Belum ada olahraga pada tanggal ini",
      summary: "Catat sesi olahraga atau sync Strava agar insight aktivitas bisa ditampilkan.",
      tips: ["Tambah sesi lewat log manual, scan, atau sync Strava."],
      mcuFlags: [],
      durationProgressPct: 0,
      focus: "incomplete",
      date,
      isToday,
      disclaimer: "Berdasarkan MCU terakhir — bukan diagnosis medis.",
      targets,
    };
  }

  let score = 80;
  let grade = "good";
  if (durationProgressPct < 50) {
    score = 45;
    grade = "alert";
  } else if (durationProgressPct < 80) {
    score = 62;
    grade = "watch";
  } else if (durationProgressPct < 100) {
    score = 78;
    grade = "watch";
  }

  return {
    score,
    grade,
    title: isToday ? "Ringkasan olahraga hari ini" : "Ringkasan olahraga",
    summary: `Tercatat ${sessions} sesi (~${Math.round(duration)} menit dari target ${durationTarget} menit).`,
    tips: [],
    mcuFlags: [],
    durationProgressPct,
    focus: durationProgressPct < 80 ? "low" : "on_track",
    date,
    isToday,
    disclaimer: "Berdasarkan MCU terakhir — bukan diagnosis medis.",
    targets,
  };
}

/**
 * @param {string} ymd
 * @param {number} delta
 */
export function addDaysYmd(ymd, delta) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} ymd
 * @param {string} todayYmd
 */
export function formatInsightDateLabel(ymd, todayYmd) {
  if (ymd === todayYmd) return "Hari ini";
  if (ymd === addDaysYmd(todayYmd, -1)) return "Kemarin";
  try {
    const d = new Date(`${ymd}T12:00:00`);
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return ymd;
  }
}
