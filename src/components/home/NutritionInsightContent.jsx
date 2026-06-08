import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";

function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FALLBACK_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCNeGKVRJgIPImTURVGAslzSS3ZGPZ1xwjwxmvnBO6MgCf_BcNjV1Jb4dQVUUhe2eezIrwoSJlx8y4bf3tE4mzYZ7Ob5GUGFekJ8dYQKoLn6pO04wFbneUeuijPEKJvnZIoJGeL-M2ktUWVwsSZJVp0p6H9hEYTuSXFd30ToMP9i6HpnGMb3hPgU95cjKY1BqdQXKMKQz7xSUcpPh5dxD-VMYhec9PJLins0xpetqOgFxP2RK1LxYvs18mJOZUQXWm9j8hAZlhXO0Q";
const HISTORY_KEY = "health_upload_history_v1";
/** Gambar daftar jika tidak ada thumbnail (sinkron dari DB). */
const FOOD_LIST_FALLBACK_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80";
const DAILY_CALORIE_TARGET = 2250;
/** Target harian untuk bar makro (≈ 20% protein / 30% lemak / 50% karb dari 2350 kkal; serat 30g). */
const MACRO_G_TARGETS = {
  proteinG: Math.round((DAILY_CALORIE_TARGET * 0.2) / 4),
  fatsG: Math.round((DAILY_CALORIE_TARGET * 0.3) / 9),
  carbsG: Math.round((DAILY_CALORIE_TARGET * 0.5) / 4),
  fiberG: 30,
};

export default function NutritionInsightContent() {
  const location = useLocation();
  const currentPath = location.pathname;
  const isNavActive = (path) => currentPath === path;
  const navItemClass = (path) =>
    `flex flex-col items-center gap-1 ${isNavActive(path) ? "text-primary" : "text-slate-400"}`;
  const navLabelClass = (path) => `text-[10px] ${isNavActive(path) ? "font-bold" : "font-medium"}`;
  const sessionUser = getSessionUser();
  const rawName = String(sessionUser?.nama || sessionUser?.name || "").trim();
  const sidValue = String(sessionUser?.sid || sessionUser?.username || "").trim().toLowerCase();
  const greetingName =
    rawName && rawName.toLowerCase() !== sidValue
      ? rawName
      : "Pengguna";
  const avatarPhoto = sessionUser?.photo || FALLBACK_AVATAR;

  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(() => isApiBackendEnabled());
  const [weeklyError, setWeeklyError] = useState("");
  const [dailySummary, setDailySummary] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(() => isApiBackendEnabled());
  const [dailyError, setDailyError] = useState("");

  useEffect(() => {
    if (!isApiBackendEnabled()) {
      setWeeklyLoading(false);
      setWeeklyError("");
      setWeeklySummary(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setWeeklyLoading(true);
      setWeeklyError("");
      try {
        const date = localTodayYmd();
        const data = await apiRequest(`/me/food/weekly-summary?date=${encodeURIComponent(date)}`);
        if (!cancelled) setWeeklySummary(data);
      } catch (e) {
        if (!cancelled) {
          setWeeklySummary(null);
          setWeeklyError(e instanceof Error ? e.message : "Gagal memuat ringkasan mingguan.");
        }
      } finally {
        if (!cancelled) setWeeklyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isApiBackendEnabled()) {
      setDailyLoading(false);
      setDailyError("");
      setDailySummary(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDailyLoading(true);
      setDailyError("");
      try {
        const date = localTodayYmd();
        const data = await apiRequest(`/me/food/daily-summary?date=${encodeURIComponent(date)}`);
        if (!cancelled) setDailySummary(data);
      } catch (e) {
        if (!cancelled) {
          setDailySummary(null);
          setDailyError(e instanceof Error ? e.message : "Gagal memuat data makanan hari ini.");
        }
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const glucosePoints = [
    { t: "12 AM", x: 0, y: 72 },
    { t: "03 AM", x: 40, y: 66 },
    { t: "06 AM", x: 85, y: 42 },
    { t: "09 AM", x: 130, y: 30 },
    { t: "12 PM", x: 175, y: 40 },
    { t: "03 PM", x: 220, y: 35 },
    { t: "06 PM", x: 265, y: 58 },
    { t: "09 PM", x: 310, y: 52 },
  ];
  const glucosePath = glucosePoints.map((p) => `${p.x},${p.y}`).join(" ");

  const parseCalories = (value) => {
    if (value == null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };
  const parseNullableNumber = (value) => {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
      if (!normalized) return null;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const weeklyChartPoints = useMemo(() => {
    const days = weeklySummary?.days;
    if (!Array.isArray(days) || days.length !== 7) return [];
    const maxCal = Math.max(1, ...days.map((d) => Number(d.calories_kcal) || 0));
    return days.map((d, idx) => {
      const cal = Number(d.calories_kcal) || 0;
      const x = (310 / 6) * idx;
      const y = cal === 0 ? 72 : 72 - (Math.min(cal, maxCal) / maxCal) * 54;
      return {
        ...d,
        key: d.date,
        x,
        y,
      };
    });
  }, [weeklySummary]);

  const weeklyPath = useMemo(() => weeklyChartPoints.map((p) => `${p.x},${p.y}`).join(" "), [weeklyChartPoints]);
  const weeklyHighlightPoint = useMemo(() => {
    if (!weeklyChartPoints.length) return null;
    const today = localTodayYmd();
    const onToday = weeklyChartPoints.find((p) => p.date === today);
    return onToday || weeklyChartPoints[weeklyChartPoints.length - 1];
  }, [weeklyChartPoints]);
  const hasWeeklyOverCalorieTarget = useMemo(
    () => weeklyChartPoints.some((it) => Number(it.calories_kcal) > DAILY_CALORIE_TARGET),
    [weeklyChartPoints]
  );
  const weeklyAvgCalories = weeklySummary?.avg_calories_per_day != null ? Math.round(Number(weeklySummary.avg_calories_per_day)) : 0;
  const weeklyProgressPct = weeklySummary?.progress_pct != null ? Number(weeklySummary.progress_pct) : 0;
  const weeklyProgressText = `${weeklyProgressPct}%`;
  const weeklyLastSyncLabel = new Date().toLocaleString("id-ID", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const weekRangeLabel =
    weeklySummary?.week_start && weeklySummary?.week_end
      ? `${weeklySummary.week_start} – ${weeklySummary.week_end}`
      : "";

  const todayNutritionTotals = useMemo(() => {
    const fromApi = isApiBackendEnabled() && dailySummary?.totals != null && !dailyError;
    if (fromApi && dailySummary?.totals) {
      const t = dailySummary.totals;
      return {
        energyKkal: Number(t.energy_kkal) || 0,
        proteinG: Number(t.protein_g) || 0,
        fatsG: Number(t.fats_g) || 0,
        carbsG: Number(t.carbs_g) || 0,
        fiberG: Number(t.fiber_g) || 0,
        waterMl: Number(t.water_ml) || 0,
        vitA_RE: t.vit_a_re,
        vitD_mcg: t.vit_d_mcg,
        vitE_mg: t.vit_e_mg,
        vitK_mcg: t.vit_k_mcg,
        vitC_mg: t.vit_c_mg,
      };
    }

    const init = {
      energyKkal: 0,
      proteinG: 0,
      fatsG: 0,
      carbsG: 0,
      fiberG: 0,
      waterMl: 0,
      vitA_RE: 0,
      vitD_mcg: 0,
      vitE_mg: 0,
      vitK_mcg: 0,
      vitC_mg: 0,
    };
    const hasValue = {
      vitA_RE: false,
      vitD_mcg: false,
      vitE_mg: false,
      vitK_mcg: false,
      vitC_mg: false,
    };

    try {
      const now = new Date();
      const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return { ...init, vitA_RE: null, vitD_mcg: null, vitE_mg: null, vitK_mcg: null, vitC_mg: null };

      parsed.forEach((it) => {
        if (!it || it.type !== "food" || it.createdAt == null) return;
        const d = new Date(it.createdAt);
        const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        if (key !== todayKey) return;

        init.energyKkal += parseCalories(it.totalCalories ?? it.energyKkal ?? it.calories);
        init.proteinG += parseCalories(it.proteinG);
        init.fatsG += parseCalories(it.fatsG ?? it.fatG);
        init.carbsG += parseCalories(it.carbsG ?? it.carbohydratesG);
        init.fiberG += parseCalories(it.fiberG);
        init.waterMl += parseCalories(it.waterMl);

        const vitA = parseNullableNumber(it.vitA_RE);
        if (vitA != null) {
          init.vitA_RE += vitA;
          hasValue.vitA_RE = true;
        }
        const vitD = parseNullableNumber(it.vitD_mcg);
        if (vitD != null) {
          init.vitD_mcg += vitD;
          hasValue.vitD_mcg = true;
        }
        const vitE = parseNullableNumber(it.vitE_mg);
        if (vitE != null) {
          init.vitE_mg += vitE;
          hasValue.vitE_mg = true;
        }
        const vitK = parseNullableNumber(it.vitK_mcg);
        if (vitK != null) {
          init.vitK_mcg += vitK;
          hasValue.vitK_mcg = true;
        }
        const vitC = parseNullableNumber(it.vitC_mg);
        if (vitC != null) {
          init.vitC_mg += vitC;
          hasValue.vitC_mg = true;
        }
      });

      return {
        ...init,
        vitA_RE: hasValue.vitA_RE ? init.vitA_RE : null,
        vitD_mcg: hasValue.vitD_mcg ? init.vitD_mcg : null,
        vitE_mg: hasValue.vitE_mg ? init.vitE_mg : null,
        vitK_mcg: hasValue.vitK_mcg ? init.vitK_mcg : null,
        vitC_mg: hasValue.vitC_mg ? init.vitC_mg : null,
      };
    } catch {
      return { ...init, vitA_RE: null, vitD_mcg: null, vitE_mg: null, vitK_mcg: null, vitC_mg: null };
    }
  }, [dailySummary, dailyError, location.key, location.pathname]);

  const todayFoodListItems = useMemo(() => {
    const fromApi = isApiBackendEnabled() && dailySummary?.totals != null && !dailyError;
    if (fromApi && Array.isArray(dailySummary?.items)) {
      return dailySummary.items.map((it) => ({
        key: `db-${it.id}`,
        title: it.food_name || "Makanan",
        subtitle: it.nutrition_notes?.trim() || "Tercatat di server",
        calories: it.calories_kcal,
        createdAt: it.created_at,
        historyHref: it.client_item_id ? `/history/${it.client_item_id}` : null,
        thumb: it.image_url?.trim() || FOOD_LIST_FALLBACK_IMG,
      }));
    }

    try {
      const now = new Date();
      const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((it) => {
          if (!it || it.type !== "food" || it.createdAt == null) return false;
          const d = new Date(it.createdAt);
          const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          return key === todayKey;
        })
        .map((it) => ({
          key: `local-${it.id}`,
          title: it.foodName || "Upload makanan",
          subtitle: it.nutritionNotes || "Foto konsumsi makanan untuk tracking nutrisi.",
          calories: it.calories,
          createdAt: it.createdAt,
          historyHref: `/history/${it.id}`,
          thumb: it.image || FOOD_LIST_FALLBACK_IMG,
        }));
    } catch {
      return [];
    }
  }, [dailySummary, dailyError, location.key, location.pathname]);

  const todayFoodCaloriesRounded = Math.max(0, Math.round(todayNutritionTotals.energyKkal));
  const todayCalorieProgressPct = Math.max(0, Math.round((todayFoodCaloriesRounded / DAILY_CALORIE_TARGET) * 100));
  const energyForSummary = Math.round(todayNutritionTotals.energyKkal);
  const macroPcts = {
    protein: Math.round(
      MACRO_G_TARGETS.proteinG > 0 ? (todayNutritionTotals.proteinG / MACRO_G_TARGETS.proteinG) * 100 : 0
    ),
    fat: Math.round(MACRO_G_TARGETS.fatsG > 0 ? (todayNutritionTotals.fatsG / MACRO_G_TARGETS.fatsG) * 100 : 0),
    carb: Math.round(MACRO_G_TARGETS.carbsG > 0 ? (todayNutritionTotals.carbsG / MACRO_G_TARGETS.carbsG) * 100 : 0),
    fiber: Math.round(
      MACRO_G_TARGETS.fiberG > 0 ? (todayNutritionTotals.fiberG / MACRO_G_TARGETS.fiberG) * 100 : 0
    ),
  };

  return (
    <div className="font-['Public_Sans'] bg-background-light text-slate-900 min-h-screen dark:bg-background-dark dark:text-slate-100">
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto">
        <div className="flex items-center bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 justify-between">
          <Link to="/home" className="flex size-12 shrink-0 items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">arrow_back</span>
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Your Activity</h2>
          <div className="flex w-12 items-center justify-end">
            <button className="flex items-center justify-center rounded-xl h-10 w-10 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">share</span>
            </button>
          </div>
        </div>

        <div className="flex p-6">
          <div className="flex w-full flex-col gap-6 items-center">
            <div className="flex gap-4 flex-col items-center">
              <div className="relative">
                <div className="aspect-square rounded-full min-h-32 w-32 border-4 border-primary shadow-lg overflow-hidden bg-slate-100">
                  <img src={avatarPhoto} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-primary text-white rounded-full p-2 border-2 border-white">
                  <span className="material-symbols-outlined text-sm">emoji_events</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <p className="text-[24px] font-bold leading-tight tracking-tight text-center">Great job, {greetingName}!</p>
                <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-normal text-center mt-1">Maksimal kalori hari ini adalah 2550 kka</p>
                <div className="flex gap-3 mt-3 items-center">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">local_fire_department</span>
                    {todayFoodCaloriesRounded.toLocaleString("id-ID")} kkal
                  </span>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">percent</span>
                    {todayCalorieProgressPct}% dari Maksimal
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">Kalori Makananmu</h3>
            <span className="text-primary text-sm font-semibold cursor-pointer">View All</span>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Ringkasan Kalori Mingguan</h3>
              {/* <span className="text-[10px] text-slate-400 font-medium tabular-nums">{weekRangeLabel}</span> */}
            </div>
            {weeklyError && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{weeklyError}</p>
            )}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              {weeklyLoading ? (
                <div className="h-24 flex items-center justify-center text-sm text-slate-500">Memuat grafik…</div>
              ) : !isApiBackendEnabled() ? (
                <div className="h-24 flex items-center justify-center text-xs text-slate-500 text-center px-2">
                  Set VITE_API_URL untuk ringkasan kalori dari database.
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 310 88" className="w-full h-24">
                    <defs>
                      <linearGradient id={hasWeeklyOverCalorieTarget ? "weeklyCalorieDangerLine" : "weeklyCalorieSafeLine"} x1="0%" x2="100%" y1="0%" y2="0%">
                        {hasWeeklyOverCalorieTarget ? (
                          <>
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#ef4444" />
                          </>
                        ) : (
                          <>
                            <stop offset="0%" stopColor="#22c55e" />
                            <stop offset="100%" stopColor="#22c55e" />
                          </>
                        )}
                      </linearGradient>
                    </defs>
                    <polyline fill="none" stroke="#e5e7eb" strokeWidth="1.5" points="0,76 310,76" />
                    {weeklyChartPoints.length > 0 && (
                      <polyline
                        fill="none"
                        stroke={`url(#${hasWeeklyOverCalorieTarget ? "weeklyCalorieDangerLine" : "weeklyCalorieSafeLine"})`}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={weeklyPath}
                      />
                    )}
                    {weeklyHighlightPoint && (
                      <circle
                        cx={weeklyHighlightPoint.x}
                        cy={weeklyHighlightPoint.y}
                        r="4.5"
                        fill={hasWeeklyOverCalorieTarget ? "#ef4444" : "#22c55e"}
                      />
                    )}
                  </svg>
                  <div className="grid grid-cols-7 text-[10px] text-slate-400 mt-1 gap-0.5">
                    {weeklyChartPoints.map((day) => (
                      <span key={day.date} className="text-center truncate" title={`${day.date}: ${day.calories_kcal} kkal`}>
                        {day.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-bold leading-none tabular-nums">{weeklyLoading ? "…" : weeklyAvgCalories.toLocaleString("id-ID")}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                  kkal / hari (rata-rata)
                  <span className={`${weeklyProgressPct > 100 ? "text-red-500" : "text-green-500"} font-semibold`}>{weeklyProgressText}</span>
                </p>
              </div>
              <Link
                to="/history"
                className="h-9 px-4 rounded-full bg-black text-white text-sm font-semibold inline-flex items-center justify-center dark:bg-white dark:text-black"
              >
                Detail
              </Link>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Sumber: food_analyses • {weeklyLastSyncLabel}
            </p>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Ringkasan nutrisi hari ini</h3>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex items-center gap-3">
                <div className="relative size-[72px] shrink-0">
                  <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200 dark:text-slate-600"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray="100, 100"
                      strokeWidth="3"
                    />
                    <path
                      className="text-amber-500"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray={`${Math.min(todayCalorieProgressPct, 100)}, 100`}
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center [transform:rotate(0deg)]">
                    <span className="material-symbols-outlined text-amber-600 text-[26px]">restaurant</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">
                    {energyForSummary.toLocaleString("id-ID")} dari {DAILY_CALORIE_TARGET.toLocaleString("id-ID")}
                  </p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">kcal terpenuhi</p>
                </div>
               
              </div>
              <div className="my-4 h-px bg-slate-200/80 dark:bg-slate-600/50" />
              <div className="grid grid-cols-2 gap-3 text-[10px] font-bold">
                {[
                  { label: "Protein", pct: macroPcts.protein, color: "bg-amber-400" },
                  { label: "Lemak", pct: macroPcts.fat, color: "bg-rose-500" },
                  { label: "Karb", pct: macroPcts.carb, color: "bg-emerald-500" },
                  { label: "Serat", pct: macroPcts.fiber, color: "bg-amber-600" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1.5">
                      <span>
                        {item.label}: {item.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
                      <div
                        className={`${item.color} h-full rounded-full min-w-[4px] transition-all`}
                        style={{ width: `${Math.min(item.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <details className="mt-3 group">
              <summary className="text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer list-none flex items-center justify-between py-1">
                <span>Detail nutrisi lengkap</span>
                <span className="material-symbols-outlined text-sm group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <div className="mt-2 space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-700">
                {[
                  { label: "Energi (Kkal)", value: `${Math.round(todayNutritionTotals.energyKkal).toLocaleString("id-ID")}` },
                  { label: "Protein (gram)", value: `${Math.round(todayNutritionTotals.proteinG).toLocaleString("id-ID")} g` },
                  { label: "Lemak (gram)", value: `${Math.round(todayNutritionTotals.fatsG).toLocaleString("id-ID")} g` },
                  { label: "Karbohidrat (gram)", value: `${Math.round(todayNutritionTotals.carbsG).toLocaleString("id-ID")} g` },
                  { label: "Serat (g)", value: `${Math.round(todayNutritionTotals.fiberG).toLocaleString("id-ID")} g` },
                  { label: "Air (mL)", value: `${Math.round(todayNutritionTotals.waterMl).toLocaleString("id-ID")} mL` },
                  { label: "VIT A (RE)", value: todayNutritionTotals.vitA_RE == null ? "—" : Math.round(todayNutritionTotals.vitA_RE).toLocaleString("id-ID") },
                  { label: "VIT D (mcg)", value: todayNutritionTotals.vitD_mcg == null ? "—" : Math.round(todayNutritionTotals.vitD_mcg).toLocaleString("id-ID") },
                  { label: "VIT E (mg)", value: todayNutritionTotals.vitE_mg == null ? "—" : Math.round(todayNutritionTotals.vitE_mg).toLocaleString("id-ID") },
                  { label: "VIT K (mcg)", value: todayNutritionTotals.vitK_mcg == null ? "—" : Math.round(todayNutritionTotals.vitK_mcg).toLocaleString("id-ID") },
                  { label: "VIT C (mg)", value: todayNutritionTotals.vitC_mg == null ? "—" : Math.round(todayNutritionTotals.vitC_mg).toLocaleString("id-ID") },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5"
                  >
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">{row.label}</span>
                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{row.value}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">Riwayat makanan hari ini</h3>
            <Link to="/history" className="text-primary text-sm font-semibold">
              Lihat semua
            </Link>
          </div>
          {dailyError && isApiBackendEnabled() && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2 px-1">{dailyError}</p>
          )}
          {dailyLoading && isApiBackendEnabled() ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 border border-slate-100 dark:border-slate-800">
              Memuat riwayat…
            </div>
          ) : todayFoodListItems.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 text-center border border-slate-100 dark:border-slate-800">
              <p className="text-slate-700 dark:text-slate-200 font-bold text-sm">Belum ada makanan hari ini</p>
              <p className="text-slate-500 text-xs mt-1">Sinkronkan dari aplikasi atau tambah analisis makanan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayFoodListItems.map((it) => {
                const row = (
                  <>
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                      <img src={it.thumb} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Makanan
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {it.createdAt ? new Date(it.createdAt).toLocaleString("id-ID") : "—"}
                        </span>
                      </div>
                      <p className="text-slate-900 dark:text-slate-100 font-bold mt-2 leading-tight">{it.title}</p>
                      <p className="text-slate-500 text-sm mt-1 line-clamp-2">{it.subtitle}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{it.historyHref ? "Lihat detail" : "Detail di History setelah sinkron"}</span>
                        <span className="text-xs font-bold text-primary">
                          {it.calories != null && it.calories !== ""
                            ? `${typeof it.calories === "number" ? Math.round(it.calories) : it.calories} kkal`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </>
                );
                const cardClass =
                  "group flex gap-4 p-4 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-[0.99] transition-all";
                return it.historyHref ? (
                  <Link key={it.key} to={it.historyHref} className={cardClass}>
                    {row}
                  </Link>
                ) : (
                  <div key={it.key} className={`${cardClass} cursor-default`}>
                    {row}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">Rekomendasi Makanan</h3>
            <span className="text-primary text-sm font-semibold cursor-pointer">View All</span>
          </div>
          <div className="flex items-stretch justify-between gap-4 rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex flex-[2_2_0px] flex-col gap-4">
              <div className="flex flex-col gap-1">
              <p className="text-slate-900 dark:text-slate-100 text-base font-bold leading-tight">Makanan Tinggi Protein</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal">Keseimbangan sempurna antara 35g protein dan karbohidrat sedang untuk memulihkan cadangan glikogen tubuh Anda.</p>
              </div>
              <button className="flex min-w-[120px] items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-primary text-white gap-2 text-sm font-semibold w-fit">
                <span className="truncate">liat resep</span>
                <span className="material-symbols-outlined text-base">restaurant</span>
              </button>
            </div>
            <div
              className="w-full bg-center bg-no-repeat aspect-square bg-cover rounded-xl flex-1"
              data-alt="A healthy quinoa bowl with vegetables and protein"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAlcDH2JIlz1DzvKwKNdeO5W-zpytrntZ-6qwOvCtsDxwnG1KCnwsO0PAcTiI1cOfMUpZYIaibXGkOXmS-CClXdo-eqjL8019GSl9M9cHyrCdPcikKys8xekMAA84TyZxsBfCv-DkITTPwKpvoKnwsBpz4Bt2jriGbrC9sA89Wlnv3pOXXvXwWpFMSA5u8JHWnrfMDmVFnP4O8EzMgFemKsBlQ2S0JuDVG_lFuTx03jWk49EJVC9mcEAFAnEgYbMEMeG_gbotxNi3Y")',
              }}
            />
          </div>
        </div>

    
        <div className="px-4 py-4">
          <h3 className="text-lg font-bold leading-tight tracking-[-0.015em] mb-3 px-1">Rekomendasi</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-600">water_drop</span>
              </div>
              <p className="font-bold text-sm">Hydration</p>
              <p className="text-xs text-slate-500">Minum 500ml air + elektrolit setelah sesi intensitas tinggi.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-600">self_improvement</span>
              </div>
              <p className="font-bold text-sm">Stretching</p>
              <p className="text-xs text-slate-500">10 menit lower-body stretching untuk mencegah pegal berlebih.</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 mb-24">
          <h3 className="text-lg font-bold leading-tight tracking-[-0.015em] mb-3 px-1">Next Workout Suggestion</h3>
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-primary rounded-xl p-3 text-white">
              <span className="material-symbols-outlined">directions_walk</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-900 dark:text-slate-100">Active Recovery Walk</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Light 20-min walk tomorrow to keep joints moving.</p>
            </div>
            <button className="bg-white dark:bg-slate-800 p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="material-symbols-outlined text-primary">add</span>
            </button>
          </div>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-20">
          <Link to="/home" className={navItemClass("/home")} href="#">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${isNavActive("/home") ? 1 : 0}` }}
            >
              grid_view
            </span>
            <span className={navLabelClass("/home")}>Dashboard</span>
          </Link>
          <Link className={navItemClass("/nutrition/insight")} to="/nutrition/insight">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${isNavActive("/nutrition/insight") ? 1 : 0}` }}
            >
              restaurant
            </span>
            <span className={navLabelClass("/nutrition/insight")}>Makanan</span>
          </Link>
          <div className="relative -top-8">
            <Link to="/activity/capture" className="size-14 bg-primary rounded-full text-white shadow-xl shadow-primary/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">add</span>
            </Link>
          </div>
          <Link className={navItemClass("/workout/insight")} to="/workout/insight">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${isNavActive("/workout/insight") ? 1 : 0}` }}
            >
              exercise
            </span>
            <span className={navLabelClass("/workout/insight")}>Olahraga</span>
          </Link>
          <Link className={navItemClass("/profile")} to="/profile">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${isNavActive("/profile") ? 1 : 0}` }}
            >
              person
            </span>
            <span className={navLabelClass("/profile")}>Profil</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
