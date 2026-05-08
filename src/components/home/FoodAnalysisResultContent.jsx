import { Link, useNavigate } from "react-router-dom";
import { buildNutritionRows } from "../../utils/foodNutritionRows";
import { getSessionUser } from "../../auth/auth";
import { saveHistoryLocalWithCap, upsertHistoryItemToCloud } from "../../services/supabaseDataService";

const HISTORY_KEY = "health_upload_history_v1";
const TEMP_ANALYSIS_KEY = "health_food_analysis_temp_v1";

export default function FoodAnalysisResultContent() {
  const navigate = useNavigate();
  const raw = localStorage.getItem(TEMP_ANALYSIS_KEY);
  const data = raw ? JSON.parse(raw) : null;
  const sessionUser = getSessionUser();

  const totalCal = data ? (data.totalCalories ?? data.energyKkal ?? data.calories ?? 0) : 0;
  const items = Array.isArray(data?.foodItems) ? data.foodItems : [];
  const nutritionRows = data ? buildNutritionRows(data) : [];

  const parseLabNumber = (v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const normalized = String(v).replace(",", ".").replace(/[^0-9.]/g, "");
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };
  const nutrientFat = Number(data?.fatsG ?? 0);
  const nutrientCarbs = Number(data?.carbsG ?? 0);
  const nutrientFiber = Number(data?.fiberG ?? 0);
  const nutrientWater = Number(data?.waterMl ?? 0);
  const nutrientProtein = Number(data?.proteinG ?? 0);

  const getDayKey = (ts) => {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const todayKey = getDayKey(Date.now());
  const todayFoodHistory = (() => {
    try {
      const oldRaw = localStorage.getItem(HISTORY_KEY);
      const parsed = oldRaw ? JSON.parse(oldRaw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((it) => it && it.type === "food" && it.createdAt != null && getDayKey(it.createdAt) === todayKey);
    } catch {
      return [];
    }
  })();
  const todayTotals = todayFoodHistory.reduce(
    (acc, it) => {
      acc.calories += Number(it.totalCalories ?? it.energyKkal ?? it.calories ?? 0) || 0;
      acc.fatsG += Number(it.fatsG ?? 0) || 0;
      acc.carbsG += Number(it.carbsG ?? 0) || 0;
      acc.proteinG += Number(it.proteinG ?? 0) || 0;
      return acc;
    },
    { calories: 0, fatsG: 0, carbsG: 0, proteinG: 0 }
  );
  const projectedTotals = {
    calories: todayTotals.calories + (Number(totalCal) || 0),
    fatsG: todayTotals.fatsG + nutrientFat,
    carbsG: todayTotals.carbsG + nutrientCarbs,
    proteinG: todayTotals.proteinG + nutrientProtein,
  };

  const mcu = sessionUser?.mcu;
  const mcuText = `${mcu?.kolesterolTotal || ""} ${mcu?.gulaDarahPuasa || ""} ${mcu?.catatan || ""}`.toLowerCase();
  const cholesterolValue = parseLabNumber(mcu?.kolesterolTotal);
  const fastingGlucoseValue = parseLabNumber(mcu?.gulaDarahPuasa);
  const bmiValue = parseLabNumber(mcuText.match(/imt\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1]);

  const hasHighCholesterolHistory = (() => {
    if (!mcu) return false;
    const highByValue = cholesterolValue != null && cholesterolValue >= 200;
    const highByText =
      mcuText.includes("kolesterol tinggi") ||
      mcuText.includes("hiperkolesterol") ||
      mcuText.includes("sindrom metabolik");
    return highByValue || highByText;
  })();
  const hasPrediabetesBaseline =
    (fastingGlucoseValue != null && fastingGlucoseValue >= 100) ||
    mcuText.includes("gdp") ||
    mcuText.includes("prediabet") ||
    mcuText.includes("diabetes");
  const hasMetabolicSyndromeBaseline = mcuText.includes("sindrom metabolik");
  const hasHighBmiBaseline = bmiValue != null && bmiValue >= 25;

  const isFoodHighCholesterol = (() => {
    if (!data) return false;
    const componentText = Array.isArray(items)
      ? items.flatMap((it) => [it?.name, it?.detail]).filter(Boolean).join(" ")
      : "";
    const haystack = `${data.foodName || ""} ${data.nutritionNotes || ""} ${componentText}`.toLowerCase();
    const keywords = [
      "goreng",
      "jeroan",
      "kulit ayam",
      "otak",
      "santan kental",
      "lemak jenuh",
      "kolesterol",
      "daging merah",
      "kuning telur",
      "seafood",
      "udang",
      "cumi",
      "kerang",
      "fast food",
      "mentega",
      "keju",
    ];
    return keywords.some((kw) => haystack.includes(kw));
  })();

  const isFoodHighSugarOrCarb = (() => {
    if (!data) return false;
    const componentText = Array.isArray(items)
      ? items.flatMap((it) => [it?.name, it?.detail]).filter(Boolean).join(" ")
      : "";
    const haystack = `${data.foodName || ""} ${data.nutritionNotes || ""} ${componentText}`.toLowerCase();
    const sugarKeywords = ["manis", "gula", "sirup", "dessert", "cake", "teh manis", "soda", "boba"];
    return nutrientCarbs >= 70 || sugarKeywords.some((kw) => haystack.includes(kw));
  })();
  const isFoodHighCalorieLoad = totalCal >= 700 || nutrientFat >= 30;
  const mcuWarnings = [];
  if (hasHighCholesterolHistory && (isFoodHighCholesterol || projectedTotals.fatsG > 65)) {
    mcuWarnings.push(
      `Berdasarkan MCU, kolesterol Anda tinggi. Total lemak hari ini setelah makanan ini menjadi ${Math.round(
        projectedTotals.fatsG
      )} g (tinggi), sebaiknya kurangi gorengan, santan, dan lemak jenuh.`
    );
  }
  if (hasPrediabetesBaseline && (isFoodHighSugarOrCarb || projectedTotals.carbsG > 300)) {
    mcuWarnings.push(
      `Berdasarkan MCU, gula darah puasa cenderung tinggi. Total karbohidrat hari ini setelah makanan ini ${Math.round(
        projectedTotals.carbsG
      )} g, kurangi makanan/minuman manis dan karbo sederhana.`
    );
  }
  if ((hasMetabolicSyndromeBaseline || hasHighBmiBaseline) && (isFoodHighCalorieLoad || projectedTotals.calories > 2350)) {
    mcuWarnings.push(
      `Berdasarkan baseline MCU (IMT/sindrom metabolik), estimasi total kalori hari ini menjadi ${Math.round(
        projectedTotals.calories
      )} kkal. Atur porsi dan imbangi dengan aktivitas fisik.`
    );
  }
  const shouldShowMcuWarning = mcuWarnings.length > 0;

  const buildActionableAdvice = () => {
    if (!data) return "";
    const existing = String(data.nutritionNotes || "").trim();
    const looksGeneric =
      !existing ||
      existing.toLowerCase().includes("estimasi nutrisi berdasarkan komponen") ||
      existing.toLowerCase().includes("dapat bervariasi");
    if (!looksGeneric) return existing;

    const tips = [];
    const foodName = String(data.foodName || "").toLowerCase();
    const itemText = items
      .flatMap((it) => [it?.name, it?.detail])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const fullText = `${foodName} ${itemText}`;

    if (totalCal >= 700) tips.push("Kalori cukup tinggi, atur porsi makan agar tidak berlebihan.");
    if (nutrientFat >= 30 || /goreng|santan|kulit|jeroan|mentega/.test(fullText)) {
      tips.push("Kurangi makanan berminyak atau bersantan, pilih olahan rebus/kukus/panggang.");
    }
    if (nutrientFiber < 8) tips.push("Tambahkan sayur atau buah agar asupan serat lebih baik.");
    if (nutrientWater < 250) tips.push("Lengkapi dengan air putih agar hidrasi harian tetap terjaga.");
    if (shouldShowMcuWarning) {
      tips.push("Perhatikan baseline MCU Anda, pilih menu lebih ringan agar risiko metabolik tetap terkontrol.");
    }
    if (tips.length === 0) tips.push("Komposisi sudah cukup baik, tetap jaga porsi dan variasi menu harian.");
    return tips.join(" ");
  };

  const shortDescription = data
    ? buildActionableAdvice()
    : "";

  const handleSave = () => {
    if (!data) return navigate("/home");
    if (shouldShowMcuWarning) {
      window.alert(`Peringatan berdasarkan baseline MCU:\n- ${mcuWarnings.join("\n- ")}`);
    }
    try {
      const oldRaw = localStorage.getItem(HISTORY_KEY);
      const itemsHist = oldRaw ? JSON.parse(oldRaw) : [];
      const next = [
        {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          type: data.type || "food",
          image: data.image || "",
          foodName: data.foodName || "Makanan tidak diketahui",
          calories: totalCal,
          totalCalories: totalCal,
          energyKkal: data.energyKkal ?? totalCal,
          proteinG: data.proteinG ?? null,
          fatsG: data.fatsG ?? null,
          carbsG: data.carbsG ?? null,
          fiberG: data.fiberG ?? null,
          waterMl: data.waterMl ?? null,
          vitA_RE: data.vitA_RE ?? null,
          vitD_mcg: data.vitD_mcg ?? null,
          vitE_mg: data.vitE_mg ?? null,
          vitK_mcg: data.vitK_mcg ?? null,
          vitC_mg: data.vitC_mcg ?? null,
          nutritionNotes: data.nutritionNotes || "",
          foodItems: items,
          createdAt: data.createdAt || Date.now(),
        },
        ...itemsHist,
      ].slice(0, 100);
      const savedItem = next[0];
      saveHistoryLocalWithCap(savedItem, 100);
      if (sessionUser?.id) {
        upsertHistoryItemToCloud(sessionUser.id, savedItem).catch(() => {});
      }
      localStorage.removeItem(TEMP_ANALYSIS_KEY);
      navigate("/history");
    } catch {
      navigate("/home");
    }
  };

  const handleRetake = () => {
    localStorage.removeItem(TEMP_ANALYSIS_KEY);
    navigate("/home?capture=food");
  };

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="text-center">
          <p className="mb-4 text-sm text-on-surface-variant">Belum ada hasil analisis.</p>
          <Link to="/home" className="rounded-full bg-primary px-5 py-2 font-semibold text-white">
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-[375px] min-h-screen bg-surface pb-36 text-on-surface antialiased">
      <header className="fixed left-0 right-0 top-0 z-50 mx-auto flex max-w-[375px] items-center justify-between bg-emerald-50/80 px-6 py-4 backdrop-blur-xl">
        <Link to="/home" className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-emerald-100/50">
          <span className="material-symbols-outlined text-emerald-700">arrow_back</span>
        </Link>
        <span className="text-2xl font-black tracking-tighter text-emerald-800">Hasil AI</span>
        <span className="w-10" aria-hidden />
      </header>

      <main className="pt-20">
        <div className="relative h-[260px] w-full overflow-hidden">
          <img alt="Makanan" className="h-full w-full object-cover" src={data.image} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        <section className="relative z-10 -mt-8 rounded-t-[32px] bg-surface px-6 pt-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <h1 className="max-w-[80%] text-2xl font-extrabold leading-tight tracking-tight text-on-surface">{data.foodName || "Makanan terdeteksi"}</h1>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">AI Analysis</span>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Ringkasan nutrisi</p>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {nutritionRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <span className="text-[13px] font-medium text-slate-600">{row.label}</span>
                  <span className="shrink-0 font-bold text-slate-900">{row.text}</span>
                </div>
              ))}
            </div>
          </div>

          {shouldShowMcuWarning ? (
            <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <p className="text-xs font-bold uppercase tracking-wide">Peringatan MCU</p>
              <ul className="mt-1 space-y-1 text-sm leading-relaxed list-disc pl-5">
                {mcuWarnings.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="mb-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Komponen</p>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {items.map((row, idx) => (
                  <li key={`${row.name}-${idx}`} className="px-4 py-3.5">
                    <p className="font-bold text-slate-900">{row.name || "Item"}</p>
                    {row.detail ? <p className="mt-0.5 text-sm text-slate-600">{row.detail}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mb-8 text-sm text-on-surface-variant">Tidak ada daftar komponen — coba foto lebih jelas atau ulang analisis.</p>
          )}

          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">History makanan hari ini + upload ini</p>
            {todayFoodHistory.length > 0 ? (
              <ul className="mb-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50">
                {todayFoodHistory.map((row) => (
                  <li key={row.id} className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-sm text-slate-700">{row.foodName || "Makanan"}</span>
                    <span className="text-xs font-bold text-slate-900">{Math.round(Number(row.totalCalories ?? row.energyKkal ?? row.calories ?? 0) || 0)} kkal</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-slate-500">Belum ada history makanan hari ini.</p>
            )}
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
              <p className="text-sm font-semibold text-slate-800">
                + Upload ini: {Math.round(totalCal)} kkal ({data.foodName || "Makanan"})
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Total harian setelah ditambahkan: <span className="font-bold text-slate-900">{Math.round(projectedTotals.calories)} kkal</span>
              </p>
            </div>
          </div>

          <div className="mb-8 rounded-2xl bg-surface-container-low p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Catatan</p>
            <p className="text-sm leading-relaxed text-on-surface-variant">{shortDescription}</p>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[375px] border-t border-zinc-100/10 bg-white/90 px-6 pb-8 pt-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleRetake} className="flex h-14 items-center justify-center gap-2 rounded-full bg-surface-container-low px-5 font-bold text-on-surface">
            <span className="material-symbols-outlined">refresh</span>
            Upload Ulang
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-primary-container to-primary text-lg font-bold text-white shadow-[0_8px_24px_rgba(0,106,63,0.3)]"
          >
            <span className="material-symbols-outlined">save</span>
            Simpan
          </button>
        </div>
      </footer>
    </div>
  );
}
