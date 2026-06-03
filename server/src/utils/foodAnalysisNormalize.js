/** Sama dengan `src/lib/foodAnalysisGemini.js` — normalisasi respons JSON analisis makanan. */

export function normalizeFoodAnalysis(parsed) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const numOrNull = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const rawItems = parsed.items ?? parsed.foodItems ?? [];
  const foodItems = Array.isArray(rawItems)
    ? rawItems
        .map((it) => {
          const name = String(it?.name ?? it?.label ?? "").trim();
          let detail = String(it?.detail ?? it?.portionAndCalories ?? "").trim();
          if (!detail && (it?.portion != null || it?.calories != null)) {
            const p = it?.portion != null ? String(it.portion) : "";
            const c = it?.calories != null ? `${it.calories} kkal` : "";
            detail = [p, c].filter(Boolean).join(" • ");
          }
          return { name, detail };
        })
        .filter((it) => it.name || it.detail)
    : [];

  const totalCalories = num(parsed.totalCalories ?? parsed.energyKkal ?? parsed.totalCal ?? parsed.calories);

  return {
    foodName: String(parsed.foodName || "").trim() || "Makanan tidak diketahui",
    calories: totalCalories,
    totalCalories,
    energyKkal: totalCalories,
    proteinG: numOrNull(parsed.proteinG ?? parsed.protein),
    fatsG: numOrNull(parsed.fatsG ?? parsed.fatG ?? parsed.fats ?? parsed.lemakG),
    carbsG: numOrNull(parsed.carbsG ?? parsed.carbohydratesG ?? parsed.carbs ?? parsed.karbohidratG),
    fiberG: numOrNull(parsed.fiberG ?? parsed.fiber ?? parsed.seratG),
    waterMl: numOrNull(parsed.waterMl ?? parsed.airMl ?? parsed.air),
    vitA_RE: numOrNull(parsed.vitA_RE ?? parsed.vitA),
    vitD_mcg: numOrNull(parsed.vitD_mcg ?? parsed.vitD),
    vitE_mg: numOrNull(parsed.vitE_mg ?? parsed.vitE),
    vitK_mcg: numOrNull(parsed.vitK_mcg ?? parsed.vitK),
    vitC_mg: numOrNull(parsed.vitC_mg ?? parsed.vitC),
    nutritionNotes: String(parsed.nutritionNotes || "").trim(),
    foodItems,
  };
}
