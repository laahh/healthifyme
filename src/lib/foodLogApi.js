import { apiRequest, isApiBackendEnabled } from "./apiClient";

async function foodRequest(path, options) {
  if (!isApiBackendEnabled()) {
    const err = new Error("API belum dikonfigurasi (VITE_API_URL).");
    err.code = "API_DISABLED";
    throw err;
  }
  return apiRequest(path, options);
}

export const FALLBACK_CATALOG = [
  { id: "1", name: "Tahu", calories: 78, serving_label: "100 gr", source_label: "Fatsecret", protein_g: 8, fats_g: 4.5, carbs_g: 2 },
  { id: "2", name: "Ayam Goreng (Paha)", calories: 173, serving_label: "50 g", source_label: "Generic", protein_g: 18, fats_g: 10, carbs_g: 2 },
  { id: "3", name: "Tempe Goreng", calories: 225, serving_label: "100 gram", source_label: "Tempe Goreng", protein_g: 14, fats_g: 15, carbs_g: 10 },
  { id: "4", name: "Dada Ayam", calories: 165, serving_label: "100 gr", source_label: "General", protein_g: 31, fats_g: 3.6, carbs_g: 0 },
  { id: "5", name: "Tempe Goreng", calories: 82, serving_label: "1 potong/slice", source_label: "Home Made", protein_g: 5, fats_g: 5, carbs_g: 4 },
  { id: "6", name: "Nasi Putih", calories: 175, serving_label: "100 gr", source_label: "Generic", protein_g: 3.5, fats_g: 0.3, carbs_g: 39 },
  { id: "7", name: "Corn Fritter", calories: 424, serving_label: "3 fritter", source_label: "Verified", protein_g: 8, fats_g: 22, carbs_g: 48 },
];

export function fetchFoodCatalog(params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.popular != null) q.set("popular", String(params.popular));
  const qs = q.toString();
  return foodRequest(`/food/catalog${qs ? `?${qs}` : ""}`);
}

export function fetchFoodRecent() {
  return foodRequest("/food/recent");
}

export function lookupFoodBarcode(code) {
  return foodRequest(`/food/barcode/${encodeURIComponent(code)}`);
}

export function logFoodItem(body) {
  return foodRequest("/food/log", { method: "POST", json: body });
}

export const MEAL_STORAGE_KEY = "food_log_meal_type_v1";

export function getStoredMealType() {
  try {
    const v = sessionStorage.getItem(MEAL_STORAGE_KEY);
    if (["breakfast", "lunch", "dinner", "snack"].includes(v)) return v;
  } catch {
    /* ignore */
  }
  return "lunch";
}

export function setStoredMealType(meal) {
  try {
    sessionStorage.setItem(MEAL_STORAGE_KEY, meal);
  } catch {
    /* ignore */
  }
}
