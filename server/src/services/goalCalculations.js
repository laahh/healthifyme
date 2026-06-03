/**
 * Mifflin–St Jeor BMR (kcal/day)
 * @param {{ gender: string, weightKg: number, heightCm: number, ageYears: number }} p
 */
export function computeBmr(p) {
  const g = String(p.gender || "").toLowerCase();
  const s = g === "male" ? 5 : -161;
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears + s;
}

/**
 * @param {number} bmr
 * @param {number} activityMultiplier
 */
export function computeTdee(bmr, activityMultiplier) {
  return bmr * activityMultiplier;
}

/**
 * @param {'easy'|'normal'|'aggressive'} intensity
 * @param {{ intensity_easy_factor: number, intensity_normal_factor: number, intensity_aggressive_factor: number }} config
 */
export function intensityFactor(intensity, config) {
  const i = String(intensity || "normal").toLowerCase();
  if (i === "easy") return Number(config.intensity_easy_factor);
  if (i === "aggressive") return Number(config.intensity_aggressive_factor);
  return Number(config.intensity_normal_factor);
}

/**
 * @param {'DEFICIT'|'SURPLUS'|'MAINTAIN'|'SOFT_DEFICIT'} mode
 * @param {number} tdee
 * @param {number} adjustmentPercent base % (deficit or surplus)
 * @param {number} softDeficitPercent for HEALTHY
 * @param {number} intFactor intensity multiplier on adjustment magnitude
 */
export function computeCalorieTarget(mode, tdee, adjustmentPercent, softDeficitPercent, intFactor) {
  const m = String(mode || "MAINTAIN").toUpperCase();
  if (m === "MAINTAIN") return tdee;
  if (m === "SOFT_DEFICIT") {
    const p = Number(softDeficitPercent) || 0;
    return tdee * (1 - p / 100);
  }
  if (m === "DEFICIT") {
    const eff = (Number(adjustmentPercent) || 0) * intFactor;
    return tdee * (1 - eff / 100);
  }
  if (m === "SURPLUS") {
    const eff = (Number(adjustmentPercent) || 0) * intFactor;
    return tdee * (1 + eff / 100);
  }
  return tdee;
}

/**
 * @param {number} calorieTarget
 * @param {number} proteinG
 * @param {number} fatPercentOfCalories 0–100
 */
export function computeMacrosFromProteinAndFatPercent(calorieTarget, proteinG, fatPercentOfCalories) {
  const proteinCal = proteinG * 4;
  const fatCal = (calorieTarget * (Number(fatPercentOfCalories) || 25)) / 100;
  const fatG = fatCal / 9;
  const carbCal = Math.max(0, calorieTarget - proteinCal - fatCal);
  const carbG = carbCal / 4;
  return {
    protein_g: proteinG,
    fat_g: fatG,
    carb_g: carbG,
  };
}

/**
 * Skor 0–100: semakin dekat ke target semakin tinggi (symmetric band).
 * @param {number} actual
 * @param {number} target
 * @param {number} toleranceRatio mis. 0.15 = ±15% masih bagus
 */
export function proximityScore(actual, target, toleranceRatio = 0.15) {
  if (target == null || target <= 0) return 70;
  const a = Number(actual) || 0;
  const t = Number(target);
  const diff = Math.abs(a - t);
  const band = t * toleranceRatio;
  if (band <= 0) return a === t ? 100 : 0;
  const raw = 100 - (diff / band) * 40;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Capai target makro: actual/target * 100, capped.
 */
export function ratioCapScore(actual, target, cap = 100) {
  if (target == null || target <= 0) return 70;
  const r = ((Number(actual) || 0) / Number(target)) * 100;
  return Math.max(0, Math.min(cap, r));
}

export function totalHealthCategory(total) {
  const t = Number(total) || 0;
  if (t >= 85) return "excellent";
  if (t >= 70) return "good";
  if (t >= 50) return "need_improvement";
  return "poor";
}
