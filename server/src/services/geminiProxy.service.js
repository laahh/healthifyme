import { AppError } from "../domain/errors/AppError.js";
import { env } from "../config/env.js";
import { normalizeFoodAnalysis } from "../utils/foodAnalysisNormalize.js";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const FOOD_PROMPT = `Analisis gambar makanan ini secara detail. Estimasi nutrisi untuk SELURUH piring dan daftar tiap komponen.

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

const WORKOUT_PROMPT = `Ini screenshot ringkasan olahraga dari aplikasi fitness (mis. Apple Fitness, Strava, Garmin, dll).
Baca semua teks dan angka yang terlihat di gambar (tanggal, jenis aktivitas, rentang waktu, lokasi, dan blok "Workout Details" / metrik).

Balas HANYA JSON valid (tanpa markdown), dengan struktur persis:
{
  "activityType": "string",
  "dateLine": "string",
  "timeRange": "string",
  "location": "string",
  "workoutTime": "string",
  "distance": "string",
  "activeKilocalories": "string",
  "totalKilocalories": "string",
  "elevationGain": "string",
  "avgPower": "string",
  "avgCadence": "string",
  "avgPace": "string",
  "avgHeartRate": "string",
  "summaryText": "string multiline: salin/gabungkan informasi penting seperti contoh berikut (gunakan \\n untuk baris baru):\\nSat, 14 Feb\\nOutdoor Run\\n06.34-08.03\\n📍 Kabupaten Berau\\nWorkout Details\\nWorkout Time: 1:28:47\\nDistance: 10,06KM\\n..."
}
Gunakan string kosong "" jika field tidak terbaca. summaryText wajib berisi ringkasan lengkap yang bisa dibaca manusia.`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireGeminiKey() {
  const key = String(env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new AppError(503, "Fitur AI belum dikonfigurasi di server (GEMINI_API_KEY).");
  }
  return key;
}

/**
 * @param {string} promptText
 * @param {string} mimeType
 * @param {string} base64Data
 * @param {{ responseMimeType?: string }} [gen]
 */
async function generateWithImage(promptText, mimeType, base64Data, gen = {}) {
  const key = requireGeminiKey();
  const responseMimeType = gen.responseMimeType ?? "application/json";
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: promptText.trim() },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType,
    },
  });

  let response = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (response.ok) break;
    if (response.status === 429 && attempt < 2) {
      await wait(800 * (attempt + 1));
      continue;
    }

    const detail = await response.text().catch(() => "");
    throw new AppError(
      response.status === 429 ? 429 : 502,
      `Gemini gagal (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`
    );
  }

  if (!response || !response.ok) {
    throw new AppError(502, "Gemini tidak merespons.");
  }

  const data = await response.json();
  const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    return JSON.parse(textResult);
  } catch {
    throw new AppError(502, "Respons AI bukan JSON valid.");
  }
}

/**
 * @param {string} mimeType
 * @param {string} base64Data
 */
export async function proxyFoodAnalysis(mimeType, base64Data) {
  const parsed = await generateWithImage(FOOD_PROMPT, mimeType, base64Data, {
    responseMimeType: "application/json",
  });
  return normalizeFoodAnalysis(parsed);
}

/**
 * @param {string} mimeType
 * @param {string} base64Data
 */
export async function proxyWorkoutAnalysis(mimeType, base64Data) {
  return generateWithImage(WORKOUT_PROMPT, mimeType, base64Data, {
    responseMimeType: "application/json",
  });
}
