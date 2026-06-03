import { ValidationError, NotFoundError } from "../domain/errors/AppError.js";
import { getPool } from "../config/database.js";
import * as goalRepo from "../repositories/goal.repository.js";
import * as profileRepo from "../repositories/userProfile.repository.js";
import * as employeeRepo from "../repositories/employeeProfile.repository.js";
import { parseWorkoutTimeStringToMinutes } from "../utils/workoutDurationMinutes.js";
import {
  computeBmr,
  computeTdee,
  intensityFactor,
  computeCalorieTarget,
  computeMacrosFromProteinAndFatPercent,
  proximityScore,
  ratioCapScore,
  totalHealthCategory,
} from "./goalCalculations.js";

/**
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} days
 */
function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} start YYYY-MM-DD
 * @param {string} end YYYY-MM-DD
 * @returns {string[]}
 */
function eachDateInclusive(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function daysBetween(start, end) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.round((b - a) / (86400 * 1000)));
}

/**
 * @param {'easy'|'normal'|'aggressive'} intensity
 * @param {ReturnType<typeof goalRepo.findCalculationConfig>} config
 */
function activityTargetsForGoal(goalTypeCode, intensity, config) {
  const intF = intensityFactor(intensity, config);
  const baseSteps = Number(config.default_steps_per_day) + Number(config.steps_bonus);
  const baseEx = Number(config.default_exercise_min_per_day) + Number(config.exercise_min_bonus);
  const baseWeek = Number(config.default_workout_per_week) + Number(config.workout_week_bonus);
  const code = String(goalTypeCode);
  if (code === "ACTIVE_LIFESTYLE" || code === "HEALTHY_LIFESTYLE") {
    return {
      steps: Math.max(3000, Math.round(baseSteps * intF)),
      exerciseMin: Math.max(10, Math.round(baseEx * intF)),
      workoutWeek: Math.max(2, Math.round(baseWeek + (intF - 1) * 2)),
    };
  }
  return {
    steps: Math.max(3000, Math.round(baseSteps)),
    exerciseMin: Math.max(10, Math.round(baseEx)),
    workoutWeek: Math.max(2, Math.round(baseWeek)),
  };
}

export async function listGoalTypes() {
  return goalRepo.listGoalTypes();
}

export async function listMyGoals(userId) {
  const rows = await goalRepo.listGoalsForUser(userId);
  return rows.map(mapUserGoalRow);
}

function mapUserGoalRow(row) {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    goal_type_id: String(row.goal_type_id),
    goal_type_code: row.goal_type_code,
    goal_type_name: row.goal_type_name,
    goal_name: row.goal_name,
    start_date: formatDateOnly(row.start_date),
    target_date: formatDateOnly(row.target_date),
    start_weight_kg: Number(row.start_weight_kg),
    target_weight_kg: Number(row.target_weight_kg),
    intensity_level: row.intensity_level,
    activity_level: row.activity_level,
    status: row.status,
    target_workout_per_week: row.target_workout_per_week != null ? Number(row.target_workout_per_week) : null,
    target_steps_per_day: row.target_steps_per_day != null ? Number(row.target_steps_per_day) : null,
  };
}

function formatDateOnly(d) {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

async function assertProfileReadyForGoal(userId) {
  const [profile, employee] = await Promise.all([
    profileRepo.findProfileByUserId(userId),
    employeeRepo.findEmployeeById(userId),
  ]);
  if (!profile) {
    throw new ValidationError("Lengkapi profil terlebih dahulu (nama kontak).");
  }
  const gender = String(profile.gender || "").trim().toLowerCase();
  const height = profile.height_cm != null ? Number(profile.height_cm) : null;
  const weight = profile.weight_kg != null ? Number(profile.weight_kg) : null;
  const ageFromEmployee = employee?.usia != null ? Number(employee.usia) : null;
  if (!gender || !["male", "female", "other"].includes(gender)) {
    throw new ValidationError("Isi gender di profil (male / female / other).");
  }
  if (height == null || height < 100 || height > 250) {
    throw new ValidationError("Isi tinggi badan (cm) yang valid di profil.");
  }
  if (weight == null || weight < 30 || weight > 300) {
    throw new ValidationError("Isi berat badan (kg) yang valid di profil.");
  }
  const age =
    ageFromEmployee != null && ageFromEmployee >= 15 && ageFromEmployee <= 100 ? ageFromEmployee : null;
  return { profile, employee, gender, height, weight, age };
}

/**
 * @param {string} userId
 * @param {object} body
 */
export async function createGoalDraft(userId, body) {
  const goalTypeCode = String(body.goal_type_code || "").trim();
  const goalName = String(body.goal_name || "").trim().slice(0, 255);
  const startDate = String(body.start_date || "").slice(0, 10);
  const targetDate = String(body.target_date || "").slice(0, 10);
  const startWeight = Number(body.start_weight_kg);
  const targetWeight = Number(body.target_weight_kg);
  const intensity = String(body.intensity_level || "normal").toLowerCase();
  const activityLevel = String(body.activity_level || "moderate").toLowerCase();
  const exercisePreferences = body.exercise_preferences != null ? String(body.exercise_preferences).slice(0, 2000) : null;
  const foodRestrictions = body.food_restrictions != null ? String(body.food_restrictions).slice(0, 2000) : null;

  if (!goalTypeCode) throw new ValidationError("Pilih jenis goal.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new ValidationError("Format tanggal harus YYYY-MM-DD.");
  }
  if (targetDate <= startDate) throw new ValidationError("Tanggal selesai harus setelah tanggal mulai.");
  if (!["easy", "normal", "aggressive"].includes(intensity)) {
    throw new ValidationError("Intensitas tidak valid.");
  }
  if (!["low", "moderate", "high", "very_high"].includes(activityLevel)) {
    throw new ValidationError("Level aktivitas tidak valid.");
  }
  if (!Number.isFinite(startWeight) || !Number.isFinite(targetWeight)) {
    throw new ValidationError("Berat awal dan target harus angka.");
  }
  if (Math.abs(targetWeight - startWeight) > 80) {
    throw new ValidationError("Target berat badan terlalu ekstrem. Periksa kembali input.");
  }

  const { gender, height, weight: profileWeight, age: ageFromProfile } = await assertProfileReadyForGoal(userId);
  let age = ageFromProfile;
  if (body.age_years != null && Number.isFinite(Number(body.age_years))) {
    const ay = Number(body.age_years);
    if (ay >= 15 && ay <= 100) age = ay;
  }
  if (age == null) {
    throw new ValidationError("Usia diperlukan untuk BMR. Isi usia di data karyawan atau kirim age_years saat membuat goal.");
  }
  if (Math.abs(startWeight - profileWeight) > 15) {
    /* izinkan selisih berat awal vs profil */
  }

  const gt = await goalRepo.findGoalTypeByCode(goalTypeCode);
  if (!gt) throw new ValidationError("Jenis goal tidak dikenal.");
  const cfg = await goalRepo.findCalculationConfig(goalTypeCode);
  if (!cfg) throw new ValidationError("Konfigurasi perhitungan goal tidak ditemukan.");

  if (goalTypeCode === "WEIGHT_LOSS" && targetWeight >= startWeight) {
    throw new ValidationError("Untuk turun berat, target harus lebih kecil dari berat awal.");
  }
  if (goalTypeCode === "MUSCLE_GAIN" && targetWeight < startWeight) {
    throw new ValidationError("Untuk naik massa otot, target berat biasanya tidak lebih kecil dari berat awal.");
  }

  const mult = await goalRepo.findActivityMultiplier(activityLevel);
  if (mult == null) throw new ValidationError("Level aktivitas tidak dikenal di server.");
  const intF = intensityFactor(intensity, cfg);

  const bmr = computeBmr({ gender, weightKg: startWeight, heightCm: height, ageYears: age });
  const tdee = computeTdee(bmr, mult);
  const calorieTarget = computeCalorieTarget(
    cfg.calorie_mode,
    tdee,
    cfg.calorie_adjustment_percent,
    cfg.soft_deficit_percent,
    intF
  );
  const proteinG = startWeight * cfg.protein_multiplier_per_kg;
  const macros = computeMacrosFromProteinAndFatPercent(calorieTarget, proteinG, cfg.fat_percent_of_calories);

  const act = activityTargetsForGoal(goalTypeCode, intensity, cfg);

  const pool = getPool();
  const conn = await pool.getConnection();
  let goalId;
  try {
    await conn.beginTransaction();
    goalId = await goalRepo.insertUserGoalWithConnection(conn, {
      user_id: userId,
      goal_type_id: gt.id,
      goal_name: goalName || gt.name,
      start_date: startDate,
      target_date: targetDate,
      start_weight_kg: startWeight,
      target_weight_kg: targetWeight,
      target_body_fat_percent: body.target_body_fat_percent != null ? Number(body.target_body_fat_percent) : null,
      target_workout_per_week: act.workoutWeek,
      target_steps_per_day: act.steps,
      intensity_level: intensity,
      activity_level: activityLevel,
      exercise_preferences: exercisePreferences,
      food_restrictions: foodRestrictions,
      status: "draft",
      notes: body.notes != null ? String(body.notes).slice(0, 4000) : null,
    });
    if (!goalId) throw new ValidationError("Gagal menyimpan goal.");

    const dates = eachDateInclusive(startDate, targetDate);
    const dailyRows = dates.map((d) => ({
      user_goal_id: goalId,
      user_id: userId,
      target_date: d,
      calorie_target: round2(calorieTarget),
      protein_target_g: round2(macros.protein_g),
      carb_target_g: round2(macros.carb_g),
      fat_target_g: round2(macros.fat_g),
      sugar_limit_g: cfg.default_sugar_limit_g,
      sodium_limit_mg: cfg.default_sodium_limit_mg,
      water_target_ml: cfg.default_water_ml,
      step_target: act.steps,
      exercise_duration_target_min: act.exerciseMin,
      workout_plan_id: null,
    }));
    await goalRepo.insertDailyTargetsBatchWithConnection(conn, dailyRows);

    const totalDays = Math.max(1, daysBetween(startDate, targetDate));
    const w0 = startWeight;
    const w1 = targetWeight;
    const milestoneRows = [];
    let weekOffset = 7;
    while (true) {
      const md = addDays(startDate, weekOffset);
      if (md >= targetDate) break;
      const t = weekOffset / totalDays;
      const expectedW = w0 + (w1 - w0) * Math.min(1, t);
      milestoneRows.push({
        user_goal_id: goalId,
        milestone_date: md,
        expected_weight_kg: round2(expectedW),
        expected_body_fat_percent: null,
        expected_workout_count: act.workoutWeek,
        expected_avg_calorie: round2(calorieTarget),
        status: "pending",
      });
      weekOffset += 7;
    }
    await goalRepo.insertMilestonesBatchWithConnection(conn, milestoneRows);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const row = await goalRepo.findGoalByIdForUser(goalId, userId);
  return mapUserGoalRow(row);
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

export async function activateGoal(userId, goalId) {
  const row = await goalRepo.findGoalByIdForUser(goalId, userId);
  if (!row) throw new NotFoundError("Goal tidak ditemukan.");
  if (row.status === "cancelled" || row.status === "completed") {
    throw new ValidationError("Goal ini tidak bisa diaktifkan.");
  }
  await goalRepo.pauseOtherActiveGoals(userId, goalId);
  await goalRepo.setGoalStatus(goalId, userId, "active");
  const updated = await goalRepo.findGoalByIdForUser(goalId, userId);
  return mapUserGoalRow(updated);
}

export async function getGoalSummary(userId, goalId) {
  const row = await goalRepo.findGoalByIdForUser(goalId, userId);
  if (!row) throw new NotFoundError("Goal tidak ditemukan.");
  const sample = await goalRepo.findDailyTarget(goalId, formatDateOnly(row.start_date));
  const milestones = await goalRepo.listMilestones(goalId);
  return {
    goal: mapUserGoalRow(row),
    sample_daily_target: sample
      ? {
          calorie_target: Number(sample.calorie_target),
          protein_target_g: Number(sample.protein_target_g),
          carb_target_g: Number(sample.carb_target_g),
          fat_target_g: Number(sample.fat_target_g),
          water_target_ml: Number(sample.water_target_ml),
          step_target: Number(sample.step_target),
          exercise_duration_target_min: Number(sample.exercise_duration_target_min),
        }
      : null,
    milestones: milestones.map((m) => ({
      milestone_date: formatDateOnly(m.milestone_date),
      expected_weight_kg: Number(m.expected_weight_kg),
      status: m.status,
    })),
  };
}

/**
 * @returns {Promise<object>}
 */
export async function getDashboard(userId, dateStr) {
  const active = await goalRepo.findActiveGoalByUserId(userId);
  if (!active) {
    return { active_goal: null, date: dateStr, daily_target: null, actuals: null, score: null, recommendations: [] };
  }
  const gid = String(active.id);
  const daily = await goalRepo.findDailyTarget(gid, dateStr);
  const food = await goalRepo.aggregateFoodForUserDate(userId, dateStr);
  const workouts = await goalRepo.listWorkoutsForUserDate(userId, dateStr);
  let exerciseMin = 0;
  let burnKcal = 0;
  for (const w of workouts) {
    exerciseMin += parseWorkoutTimeStringToMinutes(w.workout_time);
    if (w.calories_kcal != null) burnKcal += Number(w.calories_kcal);
  }

  const actuals = {
    calorie: food ? Number(food.calories) : 0,
    protein_g: food ? Number(food.protein_g) : 0,
    carb_g: food ? Number(food.carbs_g) : 0,
    fat_g: food ? Number(food.fats_g) : 0,
    fiber_g: food ? Number(food.fiber_g) : 0,
    water_ml: food ? Number(food.water_ml) : 0,
    meal_count: food ? Number(food.meal_count) : 0,
    exercise_min: exerciseMin,
    workout_count: workouts.length,
    burn_kcal_estimate: burnKcal,
  };

  const score = await computeAndPersistScore(userId, gid, dateStr, daily, actuals);
  const recs = await buildRecommendations(userId, gid, dateStr, daily, actuals, score);
  return {
    active_goal: mapUserGoalRow(active),
    date: dateStr,
    daily_target: daily
      ? {
          calorie_target: Number(daily.calorie_target),
          protein_target_g: Number(daily.protein_target_g),
          carb_target_g: Number(daily.carb_target_g),
          fat_target_g: Number(daily.fat_target_g),
          water_target_ml: Number(daily.water_target_ml),
          step_target: Number(daily.step_target),
          exercise_duration_target_min: Number(daily.exercise_duration_target_min),
          sugar_limit_g: Number(daily.sugar_limit_g),
          sodium_limit_mg: Number(daily.sodium_limit_mg),
        }
      : null,
    actuals,
    score,
    recommendations: recs,
  };
}

/**
 * @param {object | null} daily
 * @param {object} actuals
 */
async function computeAndPersistScore(userId, userGoalId, dateStr, daily, actuals) {
  if (!daily) {
    return null;
  }
  const calT = Number(daily.calorie_target);
  const protT = Number(daily.protein_target_g);
  const carbT = Number(daily.carb_target_g);
  const fatT = Number(daily.fat_target_g);
  const exT = Number(daily.exercise_duration_target_min);
  const waterT = Number(daily.water_target_ml);

  const calorie_score = proximityScore(actuals.calorie, calT, 0.2);
  const protein_score = ratioCapScore(actuals.protein_g, protT, 100);
  const macro_score = (ratioCapScore(actuals.carb_g, carbT, 100) + ratioCapScore(actuals.fat_g, fatT, 100)) / 2;
  const exercise_score = ratioCapScore(actuals.exercise_min, exT, 100);

  const weekStart = addDays(dateStr, -6);
  const logDays = await goalRepo.countFoodLogDaysInRange(userId, weekStart, dateStr);
  const consistency_score = (logDays / 7) * 100;

  const habit_score =
    waterT > 0 ? Math.min(100, (Number(actuals.water_ml || 0) / waterT) * 100) : 70;

  const total =
    calorie_score * 0.25 +
    protein_score * 0.2 +
    macro_score * 0.15 +
    exercise_score * 0.2 +
    consistency_score * 0.1 +
    habit_score * 0.1;

  const category = totalHealthCategory(total);

  await goalRepo.upsertDailyHealthScore({
    user_goal_id: userGoalId,
    user_id: userId,
    score_date: dateStr,
    calorie_score: round2(calorie_score),
    protein_score: round2(protein_score),
    macro_score: round2(macro_score),
    exercise_score: round2(exercise_score),
    consistency_score: round2(consistency_score),
    habit_score: round2(habit_score),
    total_score: round2(total),
    category,
    calorie_actual: actuals.calorie,
    protein_actual_g: actuals.protein_g,
    carb_actual_g: actuals.carb_g,
    fat_actual_g: actuals.fat_g,
    exercise_actual_min: actuals.exercise_min,
    steps_actual: null,
    water_actual_ml: actuals.water_ml,
  });

  const row = await goalRepo.findDailyHealthScore(userGoalId, dateStr);
  return row
    ? {
        calorie_score: Number(row.calorie_score),
        protein_score: Number(row.protein_score),
        macro_score: Number(row.macro_score),
        exercise_score: Number(row.exercise_score),
        consistency_score: Number(row.consistency_score),
        habit_score: Number(row.habit_score),
        total_score: Number(row.total_score),
        category: row.category,
      }
    : null;
}

/**
 * @param {object | null} daily
 */
async function buildRecommendations(userId, userGoalId, dateStr, daily, actuals, score) {
  await goalRepo.deleteRecommendationsForGoalOnDate(userGoalId, dateStr);
  if (!daily) return [];

  const calT = Number(daily.calorie_target);
  const protT = Number(daily.protein_target_g);
  const exT = Number(daily.exercise_duration_target_min);
  const list = [];

  if (actuals.calorie > calT * 1.05) {
    list.push({
      user_goal_id: userGoalId,
      user_id: userId,
      recommendation_date: dateStr,
      category: "food",
      code: "calorie_over",
      title: "Kalori melebihi target",
      body: "Sisa hari ini pilih makanan lebih ringan: sayur, protein tanpa goreng, kurangi minuman manis.",
      payload_json: { calorie_actual: actuals.calorie, calorie_target: calT },
      status: "unread",
    });
  }
  if (actuals.calorie < calT * 0.65 && actuals.meal_count > 0) {
    list.push({
      user_goal_id: userGoalId,
      user_id: userId,
      recommendation_date: dateStr,
      category: "food",
      code: "calorie_low",
      title: "Asupan kalori rendah",
      body: "Jika masih lapar, tambahkan camilan sehat bergizi (yogurt, buah, kacang secukupnya).",
      payload_json: { calorie_actual: actuals.calorie, calorie_target: calT },
      status: "unread",
    });
  }
  if (actuals.protein_g < protT * 0.85) {
    list.push({
      user_goal_id: userGoalId,
      user_id: userId,
      recommendation_date: dateStr,
      category: "food",
      code: "protein_low",
      title: "Protein belum cukup",
      body: "Tambahkan sumber protein: telur, ayam, ikan, tempe, atau susu rendah lemak.",
      payload_json: { protein_actual: actuals.protein_g, protein_target: protT },
      status: "unread",
    });
  }
  if (actuals.exercise_min < exT * 0.8) {
    list.push({
      user_goal_id: userGoalId,
      user_id: userId,
      recommendation_date: dateStr,
      category: "exercise",
      code: "exercise_low",
      title: "Durasi olahraga bisa ditingkatkan",
      body: "Jalan cepat 15–20 menit atau latihan ringan di rumah untuk mendekati target menit hari ini.",
      payload_json: { exercise_actual: actuals.exercise_min, exercise_target: exT },
      status: "unread",
    });
  }

  const yesterday = addDays(dateStr, -1);
  const foodY = await goalRepo.aggregateFoodForUserDate(userId, yesterday);
  if (!foodY || Number(foodY.meal_count) === 0) {
    list.push({
      user_goal_id: userGoalId,
      user_id: userId,
      recommendation_date: dateStr,
      category: "food",
      code: "log_reminder",
      title: "Reminder log makanan",
      body: "Kemarin belum ada log makanan. Upload foto makanan membantu skor & rekomendasi lebih akurat.",
      payload_json: { date: yesterday },
      status: "unread",
    });
  }

  let lowStreak = 0;
  for (let i = 0; i < 14; i++) {
    const d = addDays(dateStr, -i);
    const s = await goalRepo.findDailyHealthScore(userGoalId, d);
    if (!s) break;
    if (Number(s.total_score) < 50) lowStreak += 1;
    else break;
  }
  if (lowStreak >= 3) {
    list.push({
      user_goal_id: userGoalId,
      user_id: userId,
      recommendation_date: dateStr,
      category: "adjustment",
      code: "goal_adjust",
      title: "Pertimbangkan penyesuaian goal",
      body: "Skor 3 hari terakhir di bawah 50. Anda bisa menurunkan intensitas atau memperpanjang target tanggal di pengaturan goal.",
      payload_json: { low_streak: lowStreak },
      status: "unread",
    });
  }

  if (score?.category === "poor" || score?.category === "need_improvement") {
    list.push({
      user_goal_id: userGoalId,
      user_id: userId,
      recommendation_date: dateStr,
      category: "recovery",
      code: "recovery_rest",
      title: "Pemulihan & konsistensi",
      body: "Tidur cukup, minum air, dan bagi porsi kecil sepanjang hari agar lebih konsisten besok.",
      payload_json: { category: score.category },
      status: "unread",
    });
  }

  for (const r of list) {
    await goalRepo.insertRecommendation(r);
  }

  const stored = await goalRepo.listRecommendationsForDate(userGoalId, dateStr);
  return stored.map((x) => ({
    id: String(x.id),
    category: x.category,
    code: x.code,
    title: x.title,
    body: x.body,
    status: x.status,
  }));
}

export async function getProgress(userId, days = 30) {
  const active = await goalRepo.findActiveGoalByUserId(userId);
  if (!active) {
    return { active_goal: null, scores: [], milestones: [], completion_percent: 0 };
  }
  const end = new Date().toISOString().slice(0, 10);
  const start = addDays(end, -(days - 1));
  const scores = await goalRepo.listDailyHealthScoresRange(String(active.id), start, end);
  const milestones = await goalRepo.listMilestones(String(active.id));
  const startD = formatDateOnly(active.start_date);
  const targetD = formatDateOnly(active.target_date);
  const total = Math.max(1, daysBetween(startD, targetD));
  const elapsed = Math.min(total, daysBetween(startD, end));
  const completion_percent = Math.round((elapsed / total) * 100);
  return {
    active_goal: mapUserGoalRow(active),
    scores: scores.map((s) => ({
      date: formatDateOnly(s.score_date),
      total_score: Number(s.total_score),
      category: s.category,
      calorie_actual: s.calorie_actual != null ? Number(s.calorie_actual) : null,
      protein_actual_g: s.protein_actual_g != null ? Number(s.protein_actual_g) : null,
      exercise_actual_min: Number(s.exercise_actual_min),
    })),
    milestones: milestones.map((m) => ({
      milestone_date: formatDateOnly(m.milestone_date),
      expected_weight_kg: Number(m.expected_weight_kg),
      status: m.status,
    })),
    completion_percent,
  };
}
