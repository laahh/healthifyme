import * as foodRepo from "../repositories/foodAnalysis.repository.js";
import { mondayOfWeekIso, addDaysIso } from "./workoutInsight.service.js";

const DAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

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
 */
function num(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function numNullable(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string} userId
 * @param {string} [refDateStr] YYYY-MM-DD
 */
export async function getWeeklyFoodSummary(userId, refDateStr) {
  const monday = mondayOfWeekIso(refDateStr || "");
  const sunday = addDaysIso(monday, 6);
  const rows = await foodRepo.aggregateFoodByDateInRange(userId, monday, sunday);

  /** @type {Record<string, { calories: number, meals: number }>} */
  const byDate = {};
  for (let i = 0; i < 7; i++) {
    byDate[addDaysIso(monday, i)] = { calories: 0, meals: 0 };
  }

  for (const r of rows) {
    const key = rowDateKey(r.d);
    if (!byDate[key]) continue;
    byDate[key].calories = num(r.calories_sum);
    byDate[key].meals = Math.round(num(r.meal_count));
  }

  const days = [];
  let totalCal = 0;
  let totalMeals = 0;

  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(monday, i);
    const b = byDate[date];
    totalCal += b.calories;
    totalMeals += b.meals;
    days.push({
      index: i,
      label: DAY_LABELS[i].slice(0, 3),
      date,
      calories_kcal: Math.round(b.calories * 10) / 10,
      meals: b.meals,
    });
  }

  const countedDays = days.filter((d) => d.calories_kcal > 0);
  const countedCalSum = countedDays.reduce((s, d) => s + d.calories_kcal, 0);
  const avgCaloriesPerDay =
    countedDays.length > 0 ? Math.round((countedCalSum / countedDays.length) * 10) / 10 : 0;
  const dailyTarget = 2250;
  const targetForProgress = dailyTarget * (countedDays.length || 1);
  const progressPct =
    countedDays.length > 0 ? Math.round((countedCalSum / targetForProgress) * 100) : 0;

  return {
    week_start: monday,
    week_end: sunday,
    days,
    totals: {
      calories_kcal: Math.round(totalCal * 10) / 10,
      meals: totalMeals,
    },
    avg_calories_per_day: avgCaloriesPerDay,
    progress_pct: progressPct,
    daily_target_kcal: dailyTarget,
  };
}

/**
 * @param {string} userId
 * @param {string} dateStr YYYY-MM-DD
 */
export async function getDailyFoodSummary(userId, dateStr) {
  const rows = await foodRepo.listFoodAnalysesForUserDate(userId, dateStr);

  const init = {
    energy_kkal: 0,
    protein_g: 0,
    fats_g: 0,
    carbs_g: 0,
    fiber_g: 0,
    water_ml: 0,
    vit_a_re: 0,
    vit_d_mcg: 0,
    vit_e_mg: 0,
    vit_k_mcg: 0,
    vit_c_mg: 0,
  };
  const hasVit = {
    vit_a_re: false,
    vit_d_mcg: false,
    vit_e_mg: false,
    vit_k_mcg: false,
    vit_c_mg: false,
  };

  for (const r of rows) {
    init.energy_kkal += num(r.total_calories);
    init.protein_g += num(r.protein_g);
    init.fats_g += num(r.fats_g);
    init.carbs_g += num(r.carbs_g);
    init.fiber_g += num(r.fiber_g);
    init.water_ml += num(r.water_ml);

    const va = numNullable(r.vit_a_re);
    if (va != null) {
      init.vit_a_re += va;
      hasVit.vit_a_re = true;
    }
    const vd = numNullable(r.vit_d_mcg);
    if (vd != null) {
      init.vit_d_mcg += vd;
      hasVit.vit_d_mcg = true;
    }
    const ve = numNullable(r.vit_e_mg);
    if (ve != null) {
      init.vit_e_mg += ve;
      hasVit.vit_e_mg = true;
    }
    const vk = numNullable(r.vit_k_mcg);
    if (vk != null) {
      init.vit_k_mcg += vk;
      hasVit.vit_k_mcg = true;
    }
    const vc = numNullable(r.vit_c_mg);
    if (vc != null) {
      init.vit_c_mg += vc;
      hasVit.vit_c_mg = true;
    }
  }

  const totals = {
    energy_kkal: Math.round(init.energy_kkal * 10) / 10,
    protein_g: Math.round(init.protein_g * 10) / 10,
    fats_g: Math.round(init.fats_g * 10) / 10,
    carbs_g: Math.round(init.carbs_g * 10) / 10,
    fiber_g: Math.round(init.fiber_g * 10) / 10,
    water_ml: Math.round(init.water_ml * 10) / 10,
    vit_a_re: hasVit.vit_a_re ? Math.round(init.vit_a_re * 10) / 10 : null,
    vit_d_mcg: hasVit.vit_d_mcg ? Math.round(init.vit_d_mcg * 10) / 10 : null,
    vit_e_mg: hasVit.vit_e_mg ? Math.round(init.vit_e_mg * 10) / 10 : null,
    vit_k_mcg: hasVit.vit_k_mcg ? Math.round(init.vit_k_mcg * 10) / 10 : null,
    vit_c_mg: hasVit.vit_c_mg ? Math.round(init.vit_c_mg * 10) / 10 : null,
  };

  const items = rows.map((r) => {
    const created = r.created_at;
    const createdIso =
      created instanceof Date ? created.toISOString() : created != null ? String(created) : "";
    const notes = r.nutrition_notes != null ? String(r.nutrition_notes).trim() : "";
    const imageUrl = r.image_url != null ? String(r.image_url).trim() : "";
    return {
      id: String(r.id),
      client_item_id: r.client_item_id != null ? String(r.client_item_id) : null,
      food_name: String(r.food_name || "").trim() || "Makanan",
      nutrition_notes: notes || null,
      image_url: imageUrl || null,
      calories_kcal: Math.round(num(r.total_calories) * 10) / 10,
      created_at: createdIso,
    };
  });

  return {
    date: dateStr,
    totals,
    items,
  };
}
