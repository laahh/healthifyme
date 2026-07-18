/** Default target jika API belum mengirim targets / nutritionStory. */
export const DEFAULT_DAILY_CALORIE_TARGET = 2250;

/**
 * @param {number} [calorieKcal]
 */
export function defaultTargets(calorieKcal = DEFAULT_DAILY_CALORIE_TARGET) {
  const cal = Number(calorieKcal) > 0 ? Number(calorieKcal) : DEFAULT_DAILY_CALORIE_TARGET;
  return {
    calorie_kcal: Math.round(cal),
    protein_g: Math.round((cal * 0.2) / 4),
    fat_g: Math.round((cal * 0.3) / 9),
    carb_g: Math.round((cal * 0.5) / 4),
    fiber_g: 30,
    water_ml: null,
    source: "default",
    has_active_goal: false,
  };
}

/**
 * @param {unknown} dailySummary
 * @param {{ isToday?: boolean }} [opts]
 */
export function resolveNutritionStoryFromDaily(dailySummary, opts = {}) {
  if (dailySummary?.nutritionStory && typeof dailySummary.nutritionStory === "object") {
    return dailySummary.nutritionStory;
  }

  const targets = dailySummary?.targets || defaultTargets();
  const date = String(dailySummary?.date || "").slice(0, 10);
  const isToday = opts.isToday !== undefined ? opts.isToday : true;
  const totals = dailySummary?.totals || {};
  const mealCount = Array.isArray(dailySummary?.items) ? dailySummary.items.length : 0;
  const alert = dailySummary?.healthAlert;
  const flags = alert?.profile?.flags || [];
  const energy = Number(totals.energy_kkal) || 0;
  const calorieTarget = Number(targets.calorie_kcal) || DEFAULT_DAILY_CALORIE_TARGET;
  const calorieProgressPct = calorieTarget > 0 ? Math.round((energy / calorieTarget) * 100) : 0;

  if (mealCount <= 0) {
    return {
      score: null,
      grade: "incomplete",
      title: isToday ? "Belum ada asupan tercatat" : "Belum ada asupan pada tanggal ini",
      summary: "Catat makanan agar insight kesehatan dari asupan bisa ditampilkan.",
      tips: ["Tambah makanan lewat scan atau log manual."],
      mcuFlags: flags,
      calorieProgressPct: 0,
      focus: "incomplete",
      date,
      isToday,
      disclaimer: "Berdasarkan MCU terakhir — bukan diagnosis medis.",
      targets,
    };
  }

  const severity = alert?.severity;
  let score = 80;
  let grade = "good";
  if (severity === "high") {
    score = 40;
    grade = "alert";
  } else if (severity === "warning") {
    score = 58;
    grade = "watch";
  } else if (severity === "info") {
    score = 70;
    grade = "watch";
  }
  if (calorieProgressPct > 120) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const primary = alert?.primary;
  return {
    score,
    grade,
    title: primary?.title || (isToday ? "Ringkasan asupan hari ini" : "Ringkasan asupan"),
    summary:
      primary?.message ||
      `Tercatat ${mealCount} asupan (~${Math.round(energy)} kkal dari target ${calorieTarget} kkal).`,
    tips: [],
    mcuFlags: flags,
    calorieProgressPct,
    focus: "balanced",
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

export const LOOKBACK_DAYS = 90;
