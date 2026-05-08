import { parseBigIntId } from "./sqlBigInt.js";

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Record<string, unknown>} p
 */
export function isFoodHistoryPayload(p) {
  if (!p || typeof p !== "object") return false;
  if (p.type === "activity") return false;
  if (p.type === "food") return true;
  return Boolean(p.foodName || (Array.isArray(p.foodItems) && p.foodItems.length > 0));
}

/**
 * @param {Record<string, unknown>} payload
 */
function rawJsonWithoutImage(payload) {
  try {
    const { image: _img, ...rest } = payload;
    return JSON.stringify(rest);
  } catch {
    return null;
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection | import('mysql2/promise').Pool} conn
 * @param {string} userId
 * @param {string} clientItemId
 */
export async function deleteFoodAnalysisByClientItem(conn, userId, clientItemId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;
  await conn.execute(
    `DELETE FROM food_analyses WHERE user_id = :userId AND client_item_id = :clientItemId`,
    { userId: uid, clientItemId: String(clientItemId) }
  );
}

/**
 * Upsert baris food_analyses + komponen dari payload history (type food).
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} userId
 * @param {string} clientItemId
 * @param {Record<string, unknown>} payload
 */
export async function syncFoodAnalysisFromHistoryPayload(conn, userId, clientItemId, payload) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;

  if (!isFoodHistoryPayload(payload)) {
    await deleteFoodAnalysisByClientItem(conn, userId, clientItemId);
    return;
  }

  const p = payload;
  const foodName = String(p.foodName || "").trim().slice(0, 512);
  const nutritionNotes =
    p.nutritionNotes != null ? String(p.nutritionNotes) : null;
  const totalCalories = numOrNull(
    p.totalCalories ?? p.energyKkal ?? p.calories
  );
  const proteinG = numOrNull(p.proteinG);
  const fatsG = numOrNull(p.fatsG);
  const carbsG = numOrNull(p.carbsG);
  const fiberG = numOrNull(p.fiberG);
  const waterMl = numOrNull(p.waterMl);
  const vitA_RE = numOrNull(p.vitA_RE);
  const vitD_mcg = numOrNull(p.vitD_mcg);
  const vitE_mg = numOrNull(p.vitE_mg);
  const vitK_mcg = numOrNull(p.vitK_mcg);
  const vitC_mg = numOrNull(p.vitC_mg);
  const rawJson = rawJsonWithoutImage(p);

  const [existing] = await conn.execute(
    `SELECT id FROM food_analyses WHERE user_id = :userId AND client_item_id = :clientItemId LIMIT 1`,
    { userId: uid, clientItemId: String(clientItemId) }
  );
  const rows = Array.isArray(existing) ? existing : [];
  let analysisId = rows[0]?.id != null ? Number(rows[0].id) : null;

  if (analysisId != null) {
    await conn.execute(
      `UPDATE food_analyses SET
        food_name = :foodName,
        nutrition_notes = :nutritionNotes,
        total_calories = :totalCalories,
        protein_g = :proteinG,
        fats_g = :fatsG,
        carbs_g = :carbsG,
        fiber_g = :fiberG,
        water_ml = :waterMl,
        vit_a_re = :vitA_RE,
        vit_d_mcg = :vitD_mcg,
        vit_e_mg = :vitE_mg,
        vit_k_mcg = :vitK_mcg,
        vit_c_mg = :vitC_mg,
        raw_ai_json = CAST(:rawJson AS JSON),
        updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = :analysisId`,
      {
        foodName,
        nutritionNotes,
        totalCalories,
        proteinG,
        fatsG,
        carbsG,
        fiberG,
        waterMl,
        vitA_RE,
        vitD_mcg,
        vitE_mg,
        vitK_mcg,
        vitC_mg,
        rawJson,
        analysisId,
      }
    );
    await conn.execute(
      `DELETE FROM food_analysis_components WHERE analysis_id = :analysisId`,
      { analysisId }
    );
  } else {
    const [ins] = await conn.execute(
      `INSERT INTO food_analyses (
        user_id, client_item_id, food_name, nutrition_notes,
        total_calories, protein_g, fats_g, carbs_g, fiber_g, water_ml,
        vit_a_re, vit_d_mcg, vit_e_mg, vit_k_mcg, vit_c_mg,
        raw_ai_json
      ) VALUES (
        :userId, :clientItemId, :foodName, :nutritionNotes,
        :totalCalories, :proteinG, :fatsG, :carbsG, :fiberG, :waterMl,
        :vitA_RE, :vitD_mcg, :vitE_mg, :vitK_mcg, :vitC_mg,
        CAST(:rawJson AS JSON)
      )`,
      {
        userId: uid,
        clientItemId: String(clientItemId),
        foodName,
        nutritionNotes,
        totalCalories,
        proteinG,
        fatsG,
        carbsG,
        fiberG,
        waterMl,
        vitA_RE,
        vitD_mcg,
        vitE_mg,
        vitK_mcg,
        vitC_mg,
        rawJson,
      }
    );
    analysisId = Number(ins.insertId);
  }

  const rawItems = Array.isArray(p.foodItems) ? p.foodItems : [];
  let order = 0;
  for (const row of rawItems) {
    if (!row || typeof row !== "object") continue;
    const name = String(row.name || "").trim().slice(0, 255);
    const detail = String(row.detail || "").trim().slice(0, 768);
    if (!name && !detail) continue;
    await conn.execute(
      `INSERT INTO food_analysis_components (analysis_id, sort_order, component_name, component_detail)
       VALUES (:analysisId, :sortOrder, :componentName, :componentDetail)`,
      {
        analysisId,
        sortOrder: order,
        componentName: name || "Item",
        componentDetail: detail,
      }
    );
    order += 1;
  }
}
