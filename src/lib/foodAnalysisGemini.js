/** Prompt analisis makanan (sama dengan alur HomeContent). */
export const GEMINI_FOOD_ANALYSIS_PROMPT = `Analisis gambar makanan ini secara detail. Estimasi nutrisi untuk SELURUH piring dan daftar tiap komponen.

Balas HANYA JSON valid (tanpa markdown), dengan struktur:
{
  "foodName": "judul singkat hidangan (boleh Bahasa Indonesia)",
  "totalCalories": 1442,
  "proteinG": 45,
  "fatsG": 60,
  "carbsG": 180,
  "fiberG": 23,
  "waterMl": 350,
  "vitA_RE": 400,
  "vitD_mcg": 2.5,
  "vitE_mg": 5,
  "vitK_mcg": 15,
  "vitC_mg": 30,
  "nutritionNotes": "1-2 kalimat saran konsumsi yang actionable dalam Bahasa Indonesia (contoh: kurangi gorengan/berminyak, tambah sayur, atur porsi, batasi santan/gula/garam sesuai konteks makanan)",
  "items": [
    { "name": "Nasi putih", "detail": "1 mangkuk • 200 kkal" },
    { "name": "Ikan goreng", "detail": "1 porsi • 310 kkal" }
  ]
}

Aturan:
- totalCalories = estimasi TOTAL energi (kilokalori) seluruh makanan.
- proteinG, fatsG, carbsG = gram; fiberG = gram; waterMl = mililiter air perkiraan dari makanan/minuman dalam gambar.
- vitA_RE = Retinol Ekuivalen (RE); vitD_mcg, vitK_mcg, vitC_mcg, vitE_mg sesuai satuan di kunci (perkirakan jika tidak ada data pasti).
- Gunakan null untuk angka yang benar-benar tidak bisa diperkirakan (bukan 0 sembarangan).
- nutritionNotes WAJIB berupa saran praktis konsumsi, bukan disclaimer umum.
- items: WAJIB gunakan Bahasa Indonesia untuk "name" dan "detail". Contoh detail: "1 sendok makan • 45 kkal" (pisahkan porsi dan kkal dengan " • ").
- Jika komponen tidak jelas, perkirakan porsi wajar dari tampilan foto.`;

/** Normalisasi respons JSON analisis makanan (makro + mikro + daftar item). */
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Panggil Gemini untuk analisis makanan (retry 429). Mengembalikan objek ter-normalisasi.
 * @param {string} apiKey
 * @param {{ mimeType: string, base64Data: string }} parsedImage
 */
export async function fetchGeminiFoodAnalysis(apiKey, parsedImage) {
  const prompt = GEMINI_FOOD_ANALYSIS_PROMPT.trim();
  let response = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: parsedImage.mimeType,
                    data: parsedImage.base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (response.ok) break;
    if (response.status === 429 && attempt < 2) {
      await wait(800 * (attempt + 1));
      continue;
    }

    const detail = await response.text().catch(() => "");
    const requestError = new Error(
      `Gemini request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
    requestError.status = response.status;
    throw requestError;
  }

  if (!response || !response.ok) {
    const fallbackError = new Error("Gemini request failed (unknown)");
    fallbackError.status = 0;
    throw fallbackError;
  }

  const data = await response.json();
  const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(textResult);
  return normalizeFoodAnalysis(parsed);
}
