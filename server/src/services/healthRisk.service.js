import * as foodRepo from "../repositories/foodAnalysis.repository.js";
import * as goalRepo from "../repositories/goal.repository.js";
import * as mcuService from "./mcu.service.js";

const SUGAR_KEYWORDS = [
  "manis",
  "gula",
  "sirup",
  "dessert",
  "cake",
  "kue",
  "donat",
  "teh manis",
  "soda",
  "boba",
  "es teh",
  "soft drink",
  "sirup",
  "coklat manis",
  "es krim",
  "permen",
];

const FAT_KEYWORDS = [
  "goreng",
  "jeroan",
  "kulit ayam",
  "santan",
  "lemak jenuh",
  "daging merah",
  "mentega",
  "keju",
  "fast food",
  "udang",
  "cumi",
  "kerang",
];

const DISCLAIMER =
  "Berdasarkan MCU terakhir — bukan diagnosis medis. Konsultasikan tenaga kesehatan bila perlu.";

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function parseLabNumber(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const normalized = String(v).replace(",", ".").replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} v
 */
function num(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse baris kondisi "Nama: Ya (note)" dari teks MCU.
 * @param {unknown} text
 * @returns {{ name: string, status: string }[]}
 */
export function parseKondisiLines(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?):\s*(Ya|Tidak|N\/A)(?:\s*\((.+)\))?$/i);
      if (m) return { name: m[1].trim(), status: m[2] };
      return { name: line, status: "" };
    });
}

/**
 * @param {string} name
 * @param {RegExp} re
 */
function nameMatches(name, re) {
  return re.test(String(name || ""));
}

/**
 * @param {Record<string, unknown> | null | undefined} mcu
 */
export function buildRiskProfile(mcu) {
  /** @type {Set<string>} */
  const flags = new Set();
  if (!mcu || typeof mcu !== "object") {
    return { flags: [], sources: [] };
  }

  /** @type {string[]} */
  const sources = [];

  const kondisiText = [mcu.kondisiKritis, mcu.kondisiNonKritis]
    .filter(Boolean)
    .map(String)
    .join("\n");
  const yesLines = parseKondisiLines(kondisiText).filter((l) => /^ya$/i.test(l.status));

  for (const line of yesLines) {
    const n = line.name;
    if (nameMatches(n, /diabetes|hiperglikemia|gula\s*darah/i)) {
      flags.add("diabetes");
      sources.push(`kondisi:${n}`);
    }
    if (nameMatches(n, /prediabetes/i)) {
      flags.add("prediabetes");
      sources.push(`kondisi:${n}`);
    }
    if (nameMatches(n, /hipertensi|tekanan\s*darah/i)) {
      flags.add("hipertensi");
      sources.push(`kondisi:${n}`);
    }
    if (nameMatches(n, /kolesterol|dislipidemia|hiperkolesterol/i)) {
      flags.add("dislipidemia");
      sources.push(`kondisi:${n}`);
    }
    if (nameMatches(n, /obesitas|sindrom\s*metabolik/i)) {
      flags.add("metabolik");
      sources.push(`kondisi:${n}`);
    }
  }

  const gdp = parseLabNumber(mcu.gulaDarahPuasa ?? mcu.GDP ?? mcu.GulaDarahPuasa);
  if (gdp != null) {
    if (gdp >= 126) {
      flags.add("diabetes");
      sources.push(`GDP:${gdp}`);
    } else if (gdp >= 100) {
      flags.add("prediabetes");
      sources.push(`GDP:${gdp}`);
    }
  }

  const chol = parseLabNumber(mcu.kolesterolTotal ?? mcu.Kolesterol ?? mcu.KolesterolTotal);
  if (chol != null && chol >= 200) {
    flags.add("dislipidemia");
    sources.push(`kolesterol:${chol}`);
  }

  const imt = parseLabNumber(mcu.IMT ?? mcu.imt ?? mcu.bmi);
  if (imt != null && imt >= 25) {
    flags.add("metabolik");
    sources.push(`IMT:${imt}`);
  }

  const catatan = String(mcu.catatan || mcu.SindromMetabolik || "").toLowerCase();
  if (/diabetes|hiperglikemia/.test(catatan)) {
    flags.add("diabetes");
    sources.push("catatan");
  }
  if (/prediabet/.test(catatan)) {
    flags.add("prediabetes");
    sources.push("catatan");
  }
  if (/kolesterol|hiperkolesterol|dislipidemia/.test(catatan)) {
    flags.add("dislipidemia");
    sources.push("catatan");
  }
  if (/sindrom metabolik/.test(catatan)) {
    flags.add("metabolik");
    sources.push("catatan");
  }
  if (/hipertensi/.test(catatan)) {
    flags.add("hipertensi");
    sources.push("catatan");
  }

  const bp = String(mcu.tekananDarah || "");
  const bpMatch = bp.match(/(\d+)\s*\/\s*(\d+)/);
  if (bpMatch) {
    const sys = Number(bpMatch[1]);
    const dia = Number(bpMatch[2]);
    if (sys >= 140 || dia >= 90) {
      flags.add("hipertensi");
      sources.push(`TD:${bp}`);
    }
  }

  return { flags: [...flags], sources: [...new Set(sources)] };
}

/**
 * Normalize meal-like object from Gemini payload or DB row.
 * @param {Record<string, unknown> | null | undefined} meal
 */
export function normalizeMealInput(meal) {
  if (!meal || typeof meal !== "object") {
    return {
      foodName: "",
      nutritionNotes: "",
      carbsG: 0,
      fatsG: 0,
      calories: 0,
      sugarG: null,
      riskTags: [],
      foodItems: [],
    };
  }
  const items = Array.isArray(meal.foodItems)
    ? meal.foodItems
    : Array.isArray(meal.items)
      ? meal.items
      : [];
  const riskTagsRaw = meal.riskTags ?? meal.risk_tags;
  const riskTags = Array.isArray(riskTagsRaw)
    ? riskTagsRaw.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
    : [];
  const sugarRaw = meal.sugarG ?? meal.sugar_g;
  const sugarG =
    sugarRaw != null && sugarRaw !== "" && Number.isFinite(Number(sugarRaw))
      ? Number(sugarRaw)
      : null;

  return {
    foodName: String(meal.foodName ?? meal.food_name ?? "").trim(),
    nutritionNotes: String(meal.nutritionNotes ?? meal.nutrition_notes ?? "").trim(),
    carbsG: num(meal.carbsG ?? meal.carbs_g),
    fatsG: num(meal.fatsG ?? meal.fats_g),
    calories: num(meal.totalCalories ?? meal.energyKkal ?? meal.calories ?? meal.total_calories),
    sugarG,
    riskTags,
    foodItems: items,
  };
}

/**
 * @param {ReturnType<typeof normalizeMealInput>} meal
 */
function mealHaystack(meal) {
  const itemText = (meal.foodItems || [])
    .flatMap((it) => [it?.name, it?.detail])
    .filter(Boolean)
    .join(" ");
  return `${meal.foodName} ${meal.nutritionNotes} ${itemText}`.toLowerCase();
}

/**
 * @param {Record<string, unknown> | null | undefined} mealPayload
 * @param {{ flags: string[] }} profile
 */
export function scoreMeal(mealPayload, profile) {
  const meal = normalizeMealInput(mealPayload);
  const flags = new Set(profile?.flags || []);
  const haystack = mealHaystack(meal);
  /** @type {string[]} */
  const tags = [];

  const highSugarFromTags =
    meal.riskTags.includes("high_sugar") || meal.riskTags.includes("tinggi_gula");
  const highFatFromTags =
    meal.riskTags.includes("high_fat") || meal.riskTags.includes("tinggi_lemak");
  const highCalFromTags =
    meal.riskTags.includes("high_calorie") || meal.riskTags.includes("tinggi_kalori");

  const highSugar =
    highSugarFromTags ||
    (meal.sugarG != null && meal.sugarG >= 25) ||
    meal.carbsG >= 70 ||
    SUGAR_KEYWORDS.some((kw) => haystack.includes(kw));

  const highFat =
    highFatFromTags || meal.fatsG >= 30 || FAT_KEYWORDS.some((kw) => haystack.includes(kw));

  const highCalorie = highCalFromTags || meal.calories >= 700 || meal.fatsG >= 30;

  if (highSugar) tags.push("high_sugar");
  if (highFat) tags.push("high_fat");
  if (highCalorie) tags.push("high_calorie");

  /** @type {string[]} */
  const matchedFlags = [];
  /** @type {string[]} */
  const messages = [];
  let severity = null;

  const hasGlucoseRisk = flags.has("diabetes") || flags.has("prediabetes");

  if (highSugar && hasGlucoseRisk) {
    matchedFlags.push(flags.has("diabetes") ? "diabetes" : "prediabetes");
    severity = "info";
    messages.push(
      `Makanan ini cenderung tinggi gula/karbo. MCU Anda menandai risiko gula darah — batasi manis dan pilih karbo kompleks.`
    );
  }

  if (highFat && flags.has("dislipidemia")) {
    matchedFlags.push("dislipidemia");
    severity = severity === "high" ? "high" : "warning";
    messages.push(
      `Asupan cenderung tinggi lemak. MCU menunjukkan kolesterol/dislipidemia — kurangi gorengan, santan, dan lemak jenuh.`
    );
  }

  if (highCalorie && flags.has("metabolik")) {
    matchedFlags.push("metabolik");
    if (!severity) severity = "info";
    else if (severity === "info") severity = "warning";
    messages.push(
      `Kalori/lemak porsi ini cukup tinggi. Dengan baseline IMT/sindrom metabolik, atur porsi dan imbangi aktivitas fisik.`
    );
  }

  if (highFat && flags.has("hipertensi") && !messages.some((m) => /hipertensi|garam/i.test(m))) {
    // soft note only if fried/salty keywords
    if (/asin|garam|goreng|fast food/.test(haystack)) {
      matchedFlags.push("hipertensi");
      if (!severity) severity = "info";
      messages.push(
        `MCU mencatat hipertensi. Batasi makanan asin/gorengan dan jaga asupan garam.`
      );
    }
  }

  return {
    tags,
    matchedFlags: [...new Set(matchedFlags)],
    severity,
    messages,
    meal: {
      foodName: meal.foodName,
      carbsG: meal.carbsG,
      fatsG: meal.fatsG,
      calories: meal.calories,
      sugarG: meal.sugarG,
    },
  };
}

/**
 * @param {"info"|"warning"|"high"|null} a
 * @param {"info"|"warning"|"high"|null} b
 */
function maxSeverity(a, b) {
  const rank = { info: 1, warning: 2, high: 3 };
  const ra = a ? rank[a] || 0 : 0;
  const rb = b ? rank[b] || 0 : 0;
  if (ra >= rb) return a;
  return b;
}

/**
 * @param {string} [dateStr]
 */
function todayIso(dateStr) {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {unknown} row
 */
function dbRowToMeal(row) {
  return {
    foodName: row?.food_name,
    nutritionNotes: row?.nutrition_notes,
    carbsG: row?.carbs_g,
    fatsG: row?.fats_g,
    totalCalories: row?.total_calories,
    foodItems: [],
  };
}

/**
 * @param {string} userId
 * @param {{ date?: string, pendingMeal?: Record<string, unknown> | null }} [opts]
 */
export async function evaluateDay(userId, opts = {}) {
  const date = todayIso(opts.date);
  const { mcu } = await mcuService.getMcuForUser(userId);
  const profile = buildRiskProfile(mcu);

  const rows = await foodRepo.listFoodAnalysesForUserDate(userId, date);
  const meals = rows.map(dbRowToMeal);
  if (opts.pendingMeal) {
    meals.push(opts.pendingMeal);
  }

  /** @type {ReturnType<typeof scoreMeal>[]} */
  const scores = meals.map((m) => scoreMeal(m, profile));
  const sugarRisky = scores.filter((s) => s.tags.includes("high_sugar"));
  const riskyMealCount = sugarRisky.length;

  /** @type {{ id: string, severity: string, title: string, message: string, tags: string[], matchedFlags: string[] }[]} */
  const alerts = [];

  const hasGlucoseRisk =
    profile.flags.includes("diabetes") || profile.flags.includes("prediabetes");

  // Aggregate day-level glucose pattern
  if (hasGlucoseRisk && riskyMealCount >= 3) {
    alerts.push({
      id: "day_high_sugar_pattern",
      severity: "high",
      title: "Pola gula tinggi hari ini",
      message: `Sudah ${riskyMealCount} kali asupan tinggi gula/karbo hari ini. MCU Anda berisiko gula darah tinggi — batasi manis dan pilih karbo kompleks. ${DISCLAIMER}`,
      tags: ["high_sugar"],
      matchedFlags: profile.flags.filter((f) => f === "diabetes" || f === "prediabetes"),
    });
  } else if (hasGlucoseRisk && riskyMealCount === 2) {
    alerts.push({
      id: "day_sugar_warning",
      severity: "warning",
      title: "Perhatian asupan gula",
      message: `Sudah 2 kali asupan tinggi gula/karbo hari ini. Sesuaikan porsi berikutnya agar lebih aman untuk gula darah. ${DISCLAIMER}`,
      tags: ["high_sugar"],
      matchedFlags: profile.flags.filter((f) => f === "diabetes" || f === "prediabetes"),
    });
  }

  // Latest / pending meal soft alerts (avoid duplicating day pattern)
  const focusScore = opts.pendingMeal
    ? scoreMeal(opts.pendingMeal, profile)
    : scores[0] || null;

  if (focusScore?.severity && focusScore.messages.length) {
    const dayAlreadyHigh = alerts.some((a) => a.severity === "high");
    let sev = focusScore.severity;
    if (riskyMealCount >= 3 && hasGlucoseRisk && focusScore.tags.includes("high_sugar")) {
      sev = "high";
    } else if (riskyMealCount === 2 && hasGlucoseRisk && focusScore.tags.includes("high_sugar")) {
      sev = maxSeverity(sev, "warning");
    }
    if (!dayAlreadyHigh || sev === "high") {
      // If day-level high exists, still attach meal chip as high with shorter title
      const existsSame = alerts.some(
        (a) => a.id === "meal_focus" || (a.severity === sev && a.tags.join() === focusScore.tags.join())
      );
      if (!existsSame && !(dayAlreadyHigh && sev !== "high")) {
        alerts.push({
          id: "meal_focus",
          severity: sev,
          title: sev === "high" ? "Peringatan MCU" : "Saran terkait MCU",
          message: `${focusScore.messages.join(" ")} ${DISCLAIMER}`,
          tags: focusScore.tags,
          matchedFlags: focusScore.matchedFlags,
        });
      }
    }
  }

  // Fat / calorie day totals with profile
  const totalFats = meals.reduce((s, m) => s + num(normalizeMealInput(m).fatsG), 0);
  const totalCal = meals.reduce((s, m) => s + num(normalizeMealInput(m).calories), 0);
  const targets = await resolveDailyTargets(userId, date);
  const fatLimit = Number(targets.fat_g) > 0 ? Number(targets.fat_g) * 1.35 : 65;
  const calLimit = Math.round(Number(targets.calorie_kcal) * 1.04) || 2350;

  if (profile.flags.includes("dislipidemia") && totalFats > fatLimit) {
    alerts.push({
      id: "day_fat_high",
      severity: "warning",
      title: "Lemak harian tinggi",
      message: `Total lemak hari ini ~${Math.round(totalFats)} g. MCU menunjukkan kolesterol tinggi — kurangi gorengan dan lemak jenuh. ${DISCLAIMER}`,
      tags: ["high_fat"],
      matchedFlags: ["dislipidemia"],
    });
  }
  if (profile.flags.includes("metabolik") && totalCal > calLimit) {
    alerts.push({
      id: "day_cal_high",
      severity: maxSeverity(null, "warning") || "warning",
      title: "Kalori harian tinggi",
      message: `Estimasi kalori hari ini ~${Math.round(totalCal)} kkal (target ~${targets.calorie_kcal}). Dengan baseline metabolik/IMT, atur porsi. ${DISCLAIMER}`,
      tags: ["high_calorie"],
      matchedFlags: ["metabolik"],
    });
  }

  // Deduplicate by id; keep highest severity overall for summary
  const byId = new Map();
  for (const a of alerts) {
    const prev = byId.get(a.id);
    if (!prev || (maxSeverity(prev.severity, a.severity) === a.severity && prev.severity !== a.severity)) {
      byId.set(a.id, a);
    } else if (!prev) {
      byId.set(a.id, a);
    }
  }
  const uniqueAlerts = [...byId.values()].sort((a, b) => {
    const rank = { high: 3, warning: 2, info: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0);
  });

  /** @type {"info"|"warning"|"high"|null} */
  let topSeverity = null;
  for (const a of uniqueAlerts) {
    topSeverity = maxSeverity(topSeverity, a.severity);
  }

  const primary = uniqueAlerts[0] || null;

  return {
    date,
    profile: {
      flags: profile.flags,
      sources: profile.sources,
      hasMcu: Boolean(mcu),
    },
    alerts: uniqueAlerts,
    riskyMealCount,
    mealCount: meals.length,
    severity: topSeverity,
    primary,
    mealScore: focusScore,
  };
}

/**
 * Compact payload for API responses.
 * @param {Awaited<ReturnType<typeof evaluateDay>>} day
 */
export function toHealthAlertPayload(day) {
  if (!day) return null;
  if (!day.alerts?.length && !day.profile?.flags?.length) {
    return {
      date: day.date,
      profile: day.profile,
      alerts: [],
      riskyMealCount: day.riskyMealCount || 0,
      mealCount: day.mealCount || 0,
      severity: null,
      primary: null,
    };
  }
  return {
    date: day.date,
    profile: day.profile,
    alerts: day.alerts,
    riskyMealCount: day.riskyMealCount,
    mealCount: day.mealCount,
    severity: day.severity,
    primary: day.primary,
    mealScore: day.mealScore
      ? {
          tags: day.mealScore.tags,
          matchedFlags: day.mealScore.matchedFlags,
          severity: day.mealScore.severity,
          messages: day.mealScore.messages,
        }
      : null,
  };
}

export const DEFAULT_DAILY_CALORIE_TARGET = 2250;
export const DEFAULT_WORKOUT_DURATION_MIN = 30;
export const DEFAULT_WORKOUT_SESSIONS_PER_WEEK = 3;

/**
 * @returns {{ duration_min: number, sessions_per_week: number, source: string, has_active_goal: boolean }}
 */
export function defaultWorkoutTargets() {
  return {
    duration_min: DEFAULT_WORKOUT_DURATION_MIN,
    sessions_per_week: DEFAULT_WORKOUT_SESSIONS_PER_WEEK,
    source: "default",
    has_active_goal: false,
  };
}

/**
 * @param {number} calorieKcal
 */
export function defaultMacroTargetsFromCalories(calorieKcal) {
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
 * Target harian dari goal aktif (jika ada), else default 2250.
 * @param {string} userId
 * @param {string} dateStr YYYY-MM-DD
 */
export async function resolveDailyTargets(userId, dateStr) {
  const date = todayIso(dateStr);
  try {
    const active = await goalRepo.findActiveGoalByUserId(userId);
    if (!active) {
      return { ...defaultMacroTargetsFromCalories(DEFAULT_DAILY_CALORIE_TARGET), has_active_goal: false };
    }
    const daily = await goalRepo.findDailyTarget(String(active.id), date);
    if (!daily || !(Number(daily.calorie_target) > 0)) {
      return { ...defaultMacroTargetsFromCalories(DEFAULT_DAILY_CALORIE_TARGET), has_active_goal: true };
    }
    const cal = Math.round(Number(daily.calorie_target));
    return {
      calorie_kcal: cal,
      protein_g: Math.round(Number(daily.protein_target_g) || (cal * 0.2) / 4),
      fat_g: Math.round(Number(daily.fat_target_g) || (cal * 0.3) / 9),
      carb_g: Math.round(Number(daily.carb_target_g) || (cal * 0.5) / 4),
      fiber_g: 30,
      water_ml: daily.water_target_ml != null ? Math.round(Number(daily.water_target_ml)) : null,
      source: "goal",
      has_active_goal: true,
    };
  } catch (err) {
    console.warn("[healthRisk] resolveDailyTargets:", err?.message || err);
    return defaultMacroTargetsFromCalories(DEFAULT_DAILY_CALORIE_TARGET);
  }
}

/**
 * Target olahraga harian/mingguan dari goal aktif, else default 30 menit / 3 sesi.
 * @param {string} userId
 * @param {string} dateStr YYYY-MM-DD
 */
export async function resolveWorkoutTargets(userId, dateStr) {
  const date = todayIso(dateStr);
  try {
    const active = await goalRepo.findActiveGoalByUserId(userId);
    if (!active) {
      return defaultWorkoutTargets();
    }
    const weeklySessions =
      active.target_workout_per_week != null && Number(active.target_workout_per_week) > 0
        ? Math.round(Number(active.target_workout_per_week))
        : DEFAULT_WORKOUT_SESSIONS_PER_WEEK;
    const daily = await goalRepo.findDailyTarget(String(active.id), date);
    const durationMin =
      daily?.exercise_duration_target_min != null && Number(daily.exercise_duration_target_min) > 0
        ? Math.round(Number(daily.exercise_duration_target_min))
        : DEFAULT_WORKOUT_DURATION_MIN;
    return {
      duration_min: durationMin,
      sessions_per_week: weeklySessions,
      source: "goal",
      has_active_goal: true,
    };
  } catch (err) {
    console.warn("[healthRisk] resolveWorkoutTargets:", err?.message || err);
    return defaultWorkoutTargets();
  }
}

/**
 * @param {string} dateStr
 */
function formatDateIdLabel(dateStr) {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * Narasi insight nutrisi (template, bukan LLM).
 * @param {Awaited<ReturnType<typeof evaluateDay>>} dayEval
 * @param {{ energy_kkal?: number, protein_g?: number, fats_g?: number, carbs_g?: number, fiber_g?: number }} dailyTotals
 * @param {{ date: string, isToday: boolean, targets: Awaited<ReturnType<typeof resolveDailyTargets>> }} opts
 */
export function buildNutritionStory(dayEval, dailyTotals, opts) {
  const date = opts.date;
  const isToday = Boolean(opts.isToday);
  const targets = opts.targets || defaultMacroTargetsFromCalories(DEFAULT_DAILY_CALORIE_TARGET);
  const mealCount = dayEval?.mealCount ?? 0;
  const flags = dayEval?.profile?.flags || [];
  const alerts = dayEval?.alerts || [];
  const energy = num(dailyTotals?.energy_kkal);
  const protein = num(dailyTotals?.protein_g);
  const fats = num(dailyTotals?.fats_g);
  const carbs = num(dailyTotals?.carbs_g);
  const calorieTarget = Math.max(1, Number(targets.calorie_kcal) || DEFAULT_DAILY_CALORIE_TARGET);
  const calorieProgressPct = Math.round((energy / calorieTarget) * 100);
  const dateLabel = formatDateIdLabel(date);
  const dayPhrase = isToday ? "hari ini" : `pada ${dateLabel}`;

  if (mealCount <= 0) {
    return {
      score: null,
      grade: "incomplete",
      title: isToday ? "Belum ada asupan tercatat" : `Belum ada asupan ${dateLabel}`,
      summary: isToday
        ? "Catat makanan Anda agar kami bisa menilai kecocokan asupan dengan baseline MCU dan target kalori."
        : `Tidak ada makanan yang tercatat ${dayPhrase}. Pilih tanggal lain atau pastikan data sudah tersimpan.`,
      tips: isToday
        ? ["Tambah makanan lewat scan atau log manual.", "Setelah ada asupan, skor kesehatan harian akan muncul di sini."]
        : ["Geser ke hari lain untuk melihat riwayat.", "Pastikan makanan sudah disimpan ke riwayat pada tanggal tersebut."],
      mcuFlags: flags,
      calorieProgressPct: 0,
      focus: "incomplete",
      date,
      isToday,
      disclaimer: DISCLAIMER,
      targets,
    };
  }

  let score = 100;
  let infoN = 0;
  let warnN = 0;
  let highN = 0;
  for (const a of alerts) {
    if (a.severity === "high") {
      highN += 1;
      score -= 25;
    } else if (a.severity === "warning") {
      warnN += 1;
      score -= 15;
    } else if (a.severity === "info") {
      infoN += 1;
      if (infoN <= 3) score -= 8;
    }
  }
  if (calorieProgressPct > 120) score -= 15;
  else if (calorieProgressPct > 100) score -= 10;

  const hasGlucose = flags.includes("diabetes") || flags.includes("prediabetes");
  const carbLimit = Number(targets.carb_g) > 0 ? Number(targets.carb_g) * 1.35 : 300;
  if (hasGlucose && carbs > carbLimit) score -= 10;

  const fatLimit = Number(targets.fat_g) > 0 ? Number(targets.fat_g) * 1.35 : 65;
  if (flags.includes("dislipidemia") && fats > fatLimit) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));
  /** @type {"good"|"watch"|"alert"} */
  let grade = "good";
  if (score < 50) grade = "alert";
  else if (score < 75) grade = "watch";

  /** @type {"balanced"|"sugar"|"fat"|"calorie"|"incomplete"} */
  let focus = "balanced";
  if (highN > 0 || (dayEval?.riskyMealCount || 0) >= 3) focus = "sugar";
  else if (flags.includes("dislipidemia") && fats > fatLimit) focus = "fat";
  else if (calorieProgressPct > 100) focus = "calorie";
  else if (hasGlucose && (dayEval?.riskyMealCount || 0) >= 1) focus = "sugar";

  const parts = [];
  parts.push(
    `Anda mencatat ${mealCount} asupan ${dayPhrase} (~${Math.round(energy)} kkal dari target ${calorieTarget.toLocaleString("id-ID")} kkal).`
  );

  if (flags.length) {
    const flagLabel = flags
      .map((f) =>
        f === "diabetes"
          ? "diabetes/gula darah"
          : f === "prediabetes"
            ? "prediabetes"
            : f === "dislipidemia"
              ? "kolesterol"
              : f === "hipertensi"
                ? "hipertensi"
                : f === "metabolik"
                  ? "metabolik/IMT"
                  : f
      )
      .join(", ");
    parts.push(`Baseline MCU relevan: ${flagLabel}.`);
  } else {
    parts.push("Belum ada flag risiko kuat dari MCU, penilaian terutama dari pola asupan vs target.");
  }

  if (focus === "sugar") {
    parts.push(
      isToday
        ? "Pola gula/karbo cenderung tinggi terhadap risiko MCU — batasi manis di sisa hari."
        : "Pada hari itu pola gula/karbo relatif tinggi terhadap risiko MCU — perhatikan porsi serupa ke depan."
    );
  } else if (focus === "fat") {
    parts.push("Asupan lemak relatif tinggi terhadap baseline kolesterol MCU.");
  } else if (focus === "calorie") {
    parts.push(
      isToday
        ? "Kalori sudah mendekati/melewati target — atur porsi sisa hari."
        : "Kalori pada hari itu mendekati atau melewati target."
    );
  } else if (grade === "good") {
    parts.push("Secara keseluruhan asupan relatif selaras dengan target dan tidak bentrok keras dengan MCU.");
  }

  /** @type {string[]} */
  const tips = [];
  if (focus === "sugar" || hasGlucose) {
    tips.push(
      isToday
        ? "Pilih karbo kompleks dan kurangi minuman manis untuk sisa hari."
        : "Untuk hari serupa, batasi minuman manis dan pilih karbo kompleks."
    );
  }
  if (focus === "fat" || flags.includes("dislipidemia")) {
    tips.push("Kurangi gorengan, santan kental, dan lemak jenuh; utamakan rebus/kukus/panggang.");
  }
  if (focus === "calorie" || calorieProgressPct > 95) {
    tips.push(
      isToday
        ? "Sesuaikan porsi malam agar tetap dekat target kalori."
        : "Jaga porsi agar mendekati target kalori harian Anda."
    );
  }
  if (protein < Number(targets.protein_g) * 0.6) {
    tips.push("Tingkatkan sumber protein (tahu, tempe, telur, ikan, dada ayam).");
  }
  if (tips.length === 0) {
    tips.push("Pertahankan variasi sayur dan protein di setiap makan.");
    if (!targets.has_active_goal) {
      tips.push("Atur goal agar target kalori lebih personal.");
    }
  }

  const titleByGrade = {
    good: isToday ? "Asupan hari ini cukup baik" : `Asupan ${dateLabel} cukup baik`,
    watch: isToday ? "Perlu perhatian hari ini" : `Perlu perhatian · ${dateLabel}`,
    alert: isToday ? "Pola asupan perlu diwaspadai" : `Waspada · ${dateLabel}`,
  };

  return {
    score,
    grade,
    title: titleByGrade[grade],
    summary: parts.join(" "),
    tips: tips.slice(0, 3),
    mcuFlags: flags,
    calorieProgressPct,
    focus,
    date,
    isToday,
    disclaimer: DISCLAIMER,
    targets,
    meta: { infoN, warnN, highN, riskyMealCount: dayEval?.riskyMealCount || 0 },
  };
}

/**
 * Narasi insight olahraga (template, bukan LLM).
 * @param {{
 *   duration_min?: number,
 *   calories_kcal?: number,
 *   sessions?: number,
 *   distance_m?: number,
 *   avg_heart_rate?: number | null,
 * }} dayTotals
 * @param {string[]} mcuFlags
 * @param {{
 *   date: string,
 *   isToday: boolean,
 *   targets: Awaited<ReturnType<typeof resolveWorkoutTargets>>,
 * }} opts
 */
export function buildWorkoutStory(dayTotals, mcuFlags, opts) {
  const date = opts.date;
  const isToday = Boolean(opts.isToday);
  const targets = opts.targets || defaultWorkoutTargets();
  const flags = Array.isArray(mcuFlags) ? mcuFlags : [];
  const duration = num(dayTotals?.duration_min);
  const calories = num(dayTotals?.calories_kcal);
  const sessions = Math.max(0, Math.round(num(dayTotals?.sessions)));
  const avgHr = dayTotals?.avg_heart_rate != null ? Number(dayTotals.avg_heart_rate) : null;
  const durationTarget = Math.max(1, Number(targets.duration_min) || DEFAULT_WORKOUT_DURATION_MIN);
  const durationProgressPct = Math.round((duration / durationTarget) * 100);
  const dateLabel = formatDateIdLabel(date);
  const dayPhrase = isToday ? "hari ini" : `pada ${dateLabel}`;

  if (sessions <= 0) {
    return {
      score: null,
      grade: "incomplete",
      title: isToday ? "Belum ada olahraga tercatat" : `Belum ada olahraga ${dateLabel}`,
      summary: isToday
        ? "Catat sesi olahraga atau sync Strava agar kami bisa menilai aktivitas terhadap target dan baseline MCU."
        : `Tidak ada sesi tercatat ${dayPhrase}. Pilih tanggal lain atau pastikan data sudah tersimpan.`,
      tips: isToday
        ? [
            "Tambah sesi lewat log manual, scan, atau sync Strava.",
            "Target default 30 menit/hari — atur goal untuk target personal.",
          ]
        : ["Geser ke hari lain untuk melihat riwayat.", "Pastikan olahraga sudah disimpan pada tanggal tersebut."],
      mcuFlags: flags,
      durationProgressPct: 0,
      focus: "incomplete",
      date,
      isToday,
      disclaimer: DISCLAIMER,
      targets,
    };
  }

  let score = 100;
  if (durationProgressPct < 50) score -= 35;
  else if (durationProgressPct < 80) score -= 20;
  else if (durationProgressPct < 100) score -= 8;

  if (avgHr != null && Number.isFinite(avgHr) && avgHr > 175 && flags.includes("hipertensi")) {
    score -= 15;
  } else if (avgHr != null && Number.isFinite(avgHr) && avgHr > 185) {
    score -= 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  /** @type {"good"|"watch"|"alert"} */
  let grade = "good";
  if (score < 50) grade = "alert";
  else if (score < 75) grade = "watch";

  /** @type {"on_track"|"low"|"intensity"|"incomplete"} */
  let focus = "on_track";
  if (durationProgressPct < 80) focus = "low";
  else if (avgHr != null && avgHr > 175 && flags.includes("hipertensi")) focus = "intensity";

  const parts = [];
  parts.push(
    `Anda mencatat ${sessions} sesi ${dayPhrase} (~${Math.round(duration)} menit dari target ${durationTarget} menit${
      calories > 0 ? `, ~${Math.round(calories)} kkal` : ""
    }).`
  );

  if (flags.length) {
    const flagLabel = flags
      .map((f) =>
        f === "diabetes"
          ? "diabetes/gula darah"
          : f === "prediabetes"
            ? "prediabetes"
            : f === "dislipidemia"
              ? "kolesterol"
              : f === "hipertensi"
                ? "hipertensi"
                : f === "metabolik"
                  ? "metabolik/IMT"
                  : f
      )
      .join(", ");
    parts.push(`Baseline MCU relevan: ${flagLabel}.`);
  } else {
    parts.push("Belum ada flag risiko kuat dari MCU, penilaian terutama dari durasi vs target.");
  }

  if (focus === "low") {
    parts.push(
      isToday
        ? "Durasi masih di bawah target — tambah gerakan ringan sisa hari jika memungkinkan."
        : "Pada hari itu durasi di bawah target — perhatikan konsistensi ke depan."
    );
  } else if (focus === "intensity") {
    parts.push("Intensitas (denyut) relatif tinggi terhadap baseline hipertensi MCU — utamakan zona sedang.");
  } else if (grade === "good") {
    parts.push("Secara keseluruhan aktivitas relatif selaras dengan target harian.");
  }

  /** @type {string[]} */
  const tips = [];
  if (flags.includes("hipertensi") || focus === "intensity") {
    tips.push("Hindari spike denyut ekstrem; prefer zona sedang dan pemanasan/pendinginan.");
  }
  if (flags.includes("diabetes") || flags.includes("prediabetes")) {
    tips.push("Aktivitas teratur membantu kontrol glukosa — jaga konsistensi harian/mingguan.");
  }
  if (flags.includes("metabolik")) {
    tips.push("Kombinasikan cardio dengan gerakan harian (jalan, naik tangga) untuk metabolik.");
  }
  if (focus === "low") {
    tips.push(
      isToday
        ? "Jalan cepat 15–20 menit atau latihan ringan di rumah untuk mendekati target."
        : "Untuk hari serupa, sisipkan sesi singkat agar mendekati target menit."
    );
  }
  if (tips.length === 0) {
    tips.push("Pertahankan ritme: sesi pendek konsisten lebih baik daripada jarang dan ekstrem.");
    if (!targets.has_active_goal) {
      tips.push("Atur goal agar target menit olahraga lebih personal.");
    }
  }

  const titleByGrade = {
    good: isToday ? "Aktivitas hari ini cukup baik" : `Aktivitas ${dateLabel} cukup baik`,
    watch: isToday ? "Perlu perhatian hari ini" : `Perlu perhatian · ${dateLabel}`,
    alert: isToday ? "Aktivitas perlu diwaspadai" : `Waspada · ${dateLabel}`,
  };

  return {
    score,
    grade,
    title: titleByGrade[grade],
    summary: parts.join(" "),
    tips: tips.slice(0, 3),
    mcuFlags: flags,
    durationProgressPct,
    focus,
    date,
    isToday,
    disclaimer: DISCLAIMER,
    targets,
  };
}
