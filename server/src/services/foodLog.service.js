import { NotFoundError, ValidationError } from "../domain/errors/AppError.js";
import * as historyService from "./history.service.js";
import * as repo from "../repositories/foodLog.repository.js";

export async function getCatalog(query = {}) {
  const hasQ = Boolean(String(query.q || "").trim());
  return repo.listCatalog({
    q: query.q,
    popular: hasQ ? false : query.popular !== "0" && query.popular !== "false",
    limit: query.limit ? Number(query.limit) : 40,
  });
}

export async function getRecent(userId, query = {}) {
  return repo.listRecent(userId, query.limit ? Number(query.limit) : 20);
}

/**
 * Proxy Open Food Facts → bentuk seragam untuk FE.
 */
export async function lookupBarcode(code) {
  const barcode = String(code || "").trim();
  if (!/^\d{8,14}$/.test(barcode)) {
    throw new ValidationError("Barcode tidak valid (8–14 digit).");
  }
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "WELL-Health-App/1.0 (food-log)" },
    });
  } catch {
    throw new ValidationError("Gagal menghubungi Open Food Facts.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 1 || !data.product) {
    throw new NotFoundError("Produk barcode tidak ditemukan di Open Food Facts.");
  }
  const p = data.product;
  const n = p.nutriments || {};
  const name =
    p.product_name_id ||
    p.product_name ||
    p.generic_name ||
    p.brands ||
    "Produk tanpa nama";
  const serving =
    p.serving_size ||
    (n["energy-kcal_serving"] != null ? "1 serving" : "100 g");
  const cal100 = n["energy-kcal_100g"] ?? n.energy_kcal_100g ?? n["energy-kcal"] ?? null;
  const calServing = n["energy-kcal_serving"] ?? null;
  const rawImage =
    p.image_front_url ||
    p.image_url ||
    p.image_front_small_url ||
    p.image_small_url ||
    "";
  const imageUrl = String(rawImage || "")
    .trim()
    .replace(/^\/\//, "https://");
  return {
    barcode,
    food_name: String(name).trim(),
    brand: p.brands || "",
    serving_label: String(serving).trim(),
    calories: Number(calServing ?? cal100 ?? 0) || 0,
    calories_per_100g: cal100 != null ? Number(cal100) : null,
    protein_g: n.proteins_100g != null ? Number(n.proteins_100g) : null,
    fats_g: n.fat_100g != null ? Number(n.fat_100g) : null,
    carbs_g: n.carbohydrates_100g != null ? Number(n.carbohydrates_100g) : null,
    image_url: imageUrl.startsWith("http") ? imageUrl : "",
    source_label: "Open Food Facts",
  };
}

/**
 * Log manual / barcode / catalog quick-add via history pipeline.
 */
export async function logFood(userId, body) {
  const foodName = String(body?.food_name || "").trim();
  if (!foodName) throw new ValidationError("Nama makanan wajib.");
  const sourceType = body?.source_type === "barcode" ? "barcode" : "manual";
  const mealType = ["breakfast", "lunch", "dinner", "snack"].includes(body?.meal_type)
    ? body.meal_type
    : "lunch";
  const calories = Number(body?.calories);
  if (!Number.isFinite(calories) || calories < 0) {
    throw new ValidationError("Kalori tidak valid.");
  }

  const clientItemId =
    String(body?.client_item_id || "").trim() ||
    `food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const payload = {
    type: "food",
    foodName,
    calories,
    totalCalories: calories,
    energyKkal: calories,
    proteinG: body?.protein_g != null ? Number(body.protein_g) : null,
    fatsG: body?.fats_g != null ? Number(body.fats_g) : null,
    carbsG: body?.carbs_g != null ? Number(body.carbs_g) : null,
    meal_type: mealType,
    mealType,
    source_type: sourceType,
    sourceType,
    barcode: body?.barcode ? String(body.barcode) : null,
    serving_label: body?.serving_label ? String(body.serving_label) : null,
    servingLabel: body?.serving_label ? String(body.serving_label) : null,
    nutritionNotes: body?.notes ? String(body.notes) : null,
    image: body?.image_url ? String(body.image_url).trim().replace(/^\/\//, "https://") : "",
    loggedAt: new Date().toISOString(),
  };

  await historyService.upsertHistory(
    userId,
    userId,
    clientItemId,
    payload,
    new Date().toISOString()
  );

  return {
    client_item_id: clientItemId,
    food_name: foodName,
    calories,
    meal_type: mealType,
    source_type: sourceType,
  };
}
