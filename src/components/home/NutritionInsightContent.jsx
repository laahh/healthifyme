import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";
import {
  LOOKBACK_DAYS,
  addDaysYmd,
  formatInsightDateLabel,
  localTodayYmd,
  resolveNutritionStoryFromDaily,
  DEFAULT_DAILY_CALORIE_TARGET,
} from "../../lib/nutritionStoryFallback";
import NutritionHealthStatusCard from "../nutrition/NutritionHealthStatusCard";
import NutritionDayAnalysisCharts from "../nutrition/NutritionDayAnalysisCharts";
import { showToast } from "../../lib/appAlert";

const HISTORY_KEY = "health_upload_history_v1";
const FOOD_LIST_FALLBACK_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80";

export default function NutritionInsightContent() {
  const location = useLocation();
  const currentPath = location.pathname;
  const isNavActive = (path) => currentPath === path;
  const navItemClass = (path) =>
    `flex flex-col items-center gap-1 ${isNavActive(path) ? "text-primary" : "text-slate-400"}`;
  const navLabelClass = (path) => `text-[10px] ${isNavActive(path) ? "font-bold" : "font-medium"}`;

  const todayYmd = localTodayYmd();
  const minYmd = addDaysYmd(todayYmd, -LOOKBACK_DAYS);
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const dateInputRef = useRef(null);

  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(() => isApiBackendEnabled());
  const [weeklyError, setWeeklyError] = useState("");
  const [dailySummary, setDailySummary] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(() => isApiBackendEnabled());
  const [dailyError, setDailyError] = useState("");

  const isToday = selectedDate === todayYmd;
  const canGoNext = selectedDate < todayYmd;
  const canGoPrev = selectedDate > minYmd;
  const dateLabel = formatInsightDateLabel(selectedDate, todayYmd);

  const goPrev = () => {
    if (!canGoPrev) {
      showToast("Maksimal 90 hari ke belakang", "info");
      return;
    }
    setSelectedDate((d) => addDaysYmd(d, -1));
  };
  const goNext = () => {
    if (!canGoNext) return;
    setSelectedDate((d) => addDaysYmd(d, 1));
  };

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
        const data = await apiRequest(
          `/me/food/weekly-summary?date=${encodeURIComponent(selectedDate)}`
        );
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
  }, [selectedDate]);

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
        const data = await apiRequest(
          `/me/food/daily-summary?date=${encodeURIComponent(selectedDate)}`
        );
        if (!cancelled) setDailySummary(data);
      } catch (e) {
        if (!cancelled) {
          setDailySummary(null);
          setDailyError(e instanceof Error ? e.message : "Gagal memuat data makanan.");
        }
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const story = useMemo(
    () => resolveNutritionStoryFromDaily(dailySummary, { isToday }),
    [dailySummary, isToday]
  );

  const targets = story?.targets || dailySummary?.targets || {
    calorie_kcal: DEFAULT_DAILY_CALORIE_TARGET,
    protein_g: Math.round((DEFAULT_DAILY_CALORIE_TARGET * 0.2) / 4),
    fat_g: Math.round((DEFAULT_DAILY_CALORIE_TARGET * 0.3) / 9),
    carb_g: Math.round((DEFAULT_DAILY_CALORIE_TARGET * 0.5) / 4),
    fiber_g: 30,
  };

  const calorieTarget =
    Number(weeklySummary?.daily_target_kcal) > 0
      ? Number(weeklySummary.daily_target_kcal)
      : Number(targets.calorie_kcal) || DEFAULT_DAILY_CALORIE_TARGET;

  const todayNutritionTotals = useMemo(() => {
    if (dailySummary?.totals) {
      return {
        energyKkal: Number(dailySummary.totals.energy_kkal) || 0,
        proteinG: Number(dailySummary.totals.protein_g) || 0,
        fatsG: Number(dailySummary.totals.fats_g) || 0,
        carbsG: Number(dailySummary.totals.carbs_g) || 0,
        fiberG: Number(dailySummary.totals.fiber_g) || 0,
        waterMl: Number(dailySummary.totals.water_ml) || 0,
        vitA_RE: dailySummary.totals.vit_a_re,
        vitD_mcg: dailySummary.totals.vit_d_mcg,
        vitE_mg: dailySummary.totals.vit_e_mg,
        vitK_mcg: dailySummary.totals.vit_k_mcg,
        vitC_mg: dailySummary.totals.vit_c_mg,
      };
    }
    if (!isToday) {
      return {
        energyKkal: 0,
        proteinG: 0,
        fatsG: 0,
        carbsG: 0,
        fiberG: 0,
        waterMl: 0,
        vitA_RE: null,
        vitD_mcg: null,
        vitE_mg: null,
        vitK_mcg: null,
        vitC_mg: null,
      };
    }
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return {
          energyKkal: 0,
          proteinG: 0,
          fatsG: 0,
          carbsG: 0,
          fiberG: 0,
          waterMl: 0,
          vitA_RE: null,
          vitD_mcg: null,
          vitE_mg: null,
          vitK_mcg: null,
          vitC_mg: null,
        };
      }
      const todayKey = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate()
      ).getTime();
      const init = {
        energyKkal: 0,
        proteinG: 0,
        fatsG: 0,
        carbsG: 0,
        fiberG: 0,
        waterMl: 0,
        vitA_RE: null,
        vitD_mcg: null,
        vitE_mg: null,
        vitK_mcg: null,
        vitC_mg: null,
      };
      for (const it of parsed) {
        if (!it || it.type !== "food" || it.createdAt == null) continue;
        const d = new Date(it.createdAt);
        const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        if (key !== todayKey) continue;
        init.energyKkal += Number(it.totalCalories ?? it.energyKkal ?? it.calories) || 0;
        init.proteinG += Number(it.proteinG) || 0;
        init.fatsG += Number(it.fatsG) || 0;
        init.carbsG += Number(it.carbsG) || 0;
        init.fiberG += Number(it.fiberG) || 0;
        init.waterMl += Number(it.waterMl) || 0;
      }
      return init;
    } catch {
      return {
        energyKkal: 0,
        proteinG: 0,
        fatsG: 0,
        carbsG: 0,
        fiberG: 0,
        waterMl: 0,
        vitA_RE: null,
        vitD_mcg: null,
        vitE_mg: null,
        vitK_mcg: null,
        vitC_mg: null,
      };
    }
  }, [dailySummary, isToday, location.key]);

  const weeklyChartPoints = useMemo(() => {
    const days = Array.isArray(weeklySummary?.days) ? weeklySummary.days : [];
    const n = days.length || 7;
    const padX = 18;
    const width = 310;
    const top = 18;
    const bottom = 92;
    const chartH = bottom - top;
    const maxCal = Math.max(
      1,
      ...days.map((d) => Number(d.calories_kcal) || 0),
      calorieTarget
    );
    return days.map((d, i) => {
      const cal = Number(d.calories_kcal) || 0;
      const x = n <= 1 ? width / 2 : padX + (i / (n - 1)) * (width - padX * 2);
      const y = bottom - (cal / maxCal) * chartH;
      return {
        ...d,
        calories_kcal: cal,
        x,
        y,
        overTarget: cal > calorieTarget,
        isSelected: d.date === selectedDate,
        maxCal,
      };
    });
  }, [weeklySummary, calorieTarget, selectedDate]);

  const weeklyTrendPaths = useMemo(() => {
    if (!weeklyChartPoints.length) {
      return { line: "", area: "", targetY: 92 };
    }
    const maxCal = weeklyChartPoints[0]?.maxCal || calorieTarget || 1;
    const top = 18;
    const bottom = 92;
    const chartH = bottom - top;
    const targetY = bottom - (calorieTarget / maxCal) * chartH;
    const line = weeklyChartPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const first = weeklyChartPoints[0];
    const last = weeklyChartPoints[weeklyChartPoints.length - 1];
    const area = `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
    return { line, area, targetY };
  }, [weeklyChartPoints, calorieTarget]);

  const weeklyAvgCalories =
    weeklySummary?.avg_calories_per_day != null
      ? Math.round(Number(weeklySummary.avg_calories_per_day))
      : 0;
  const weeklyProgressPct =
    weeklySummary?.progress_pct != null ? Math.round(Number(weeklySummary.progress_pct)) : 0;
  const hasWeeklyOverCalorieTarget = weeklyChartPoints.some((p) => p.overTarget);

  const todayFoodListItems = useMemo(() => {
    if (Array.isArray(dailySummary?.items) && dailySummary.items.length > 0) {
      return dailySummary.items.map((it) => ({
        key: `db-${it.id}`,
        title: it.food_name || "Makanan",
        subtitle: it.nutrition_notes || "Asupan tercatat",
        calories: it.calories_kcal,
        createdAt: it.created_at,
        historyHref: it.client_item_id ? `/history/${it.client_item_id}` : null,
        thumb: it.image_url || FOOD_LIST_FALLBACK_IMG,
      }));
    }
    if (!isToday) return [];
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const todayKey = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate()
      ).getTime();
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
  }, [dailySummary, isToday, location.key]);

  const energyForSummary = Math.round(todayNutritionTotals.energyKkal);
  const todayCalorieProgressPct = Math.max(
    0,
    Math.round((energyForSummary / Math.max(1, Number(targets.calorie_kcal) || calorieTarget)) * 100)
  );
  const macroPcts = {
    protein: Math.round(
      Number(targets.protein_g) > 0
        ? (todayNutritionTotals.proteinG / Number(targets.protein_g)) * 100
        : 0
    ),
    fat: Math.round(
      Number(targets.fat_g) > 0 ? (todayNutritionTotals.fatsG / Number(targets.fat_g)) * 100 : 0
    ),
    carb: Math.round(
      Number(targets.carb_g) > 0 ? (todayNutritionTotals.carbsG / Number(targets.carb_g)) * 100 : 0
    ),
    fiber: Math.round(
      Number(targets.fiber_g) > 0
        ? (todayNutritionTotals.fiberG / Number(targets.fiber_g)) * 100
        : 0
    ),
  };

  const riskyCount = dailySummary?.healthAlert?.riskyMealCount || 0;

  return (
    <div className="font-['Public_Sans'] bg-background-light text-slate-900 min-h-screen dark:bg-background-dark dark:text-slate-100">
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto">
        <div className="flex items-center bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 justify-between">
          <Link to="/home" className="flex size-12 shrink-0 items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">arrow_back</span>
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            Insight Nutrisi
          </h2>
          <div className="flex w-12 items-center justify-end">
            <Link
              to="/mcu"
              className="flex items-center justify-center rounded-xl h-10 w-10 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="MCU"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
                medical_information
              </span>
            </Link>
          </div>
        </div>

        {/* Date navigator */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-2 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-50 disabled:opacity-30"
              aria-label="Hari sebelumnya"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
              className="min-w-0 flex-1 text-center"
            >
              <p className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">{dateLabel}</p>
              <p className="text-[10px] font-medium text-slate-400">{selectedDate}</p>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="sr-only"
              min={minYmd}
              max={todayYmd}
              value={selectedDate}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                if (v < minYmd) {
                  showToast("Maksimal 90 hari ke belakang", "info");
                  setSelectedDate(minYmd);
                  return;
                }
                if (v > todayYmd) {
                  setSelectedDate(todayYmd);
                  return;
                }
                setSelectedDate(v);
              }}
            />
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-50 disabled:opacity-30"
              aria-label="Hari berikutnya"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          {dailyLoading && isApiBackendEnabled() ? (
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ) : (
            <NutritionHealthStatusCard story={story} dateLabel={dateLabel} />
          )}
          {dailyError ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{dailyError}</p>
          ) : null}
        </div>

        {/* Calories & macros */}
        <div className="px-4 py-2">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Kalori & makro · {dateLabel}
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">
                Target {Number(targets.calorie_kcal || calorieTarget).toLocaleString("id-ID")} kkal
              </span>
            </div>
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
                      className={todayCalorieProgressPct > 100 ? "text-red-500" : "text-primary"}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray={`${Math.min(todayCalorieProgressPct, 100)}, 100`}
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[26px]">restaurant</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">
                    {energyForSummary.toLocaleString("id-ID")} dari{" "}
                    {Number(targets.calorie_kcal || calorieTarget).toLocaleString("id-ID")}
                  </p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    kkal · {todayCalorieProgressPct}% target
                  </p>
                </div>
              </div>
              <div className="my-4 h-px bg-slate-200/80 dark:bg-slate-600/50" />
              <div className="grid grid-cols-2 gap-3 text-[10px] font-bold">
                {[
                  {
                    label: "Protein",
                    pct: macroPcts.protein,
                    grams: todayNutritionTotals.proteinG,
                    target: targets.protein_g,
                    color: "bg-amber-400",
                  },
                  {
                    label: "Lemak",
                    pct: macroPcts.fat,
                    grams: todayNutritionTotals.fatsG,
                    target: targets.fat_g,
                    color: "bg-rose-500",
                  },
                  {
                    label: "Karb",
                    pct: macroPcts.carb,
                    grams: todayNutritionTotals.carbsG,
                    target: targets.carb_g,
                    color: "bg-emerald-500",
                  },
                  {
                    label: "Serat",
                    pct: macroPcts.fiber,
                    grams: todayNutritionTotals.fiberG,
                    target: targets.fiber_g,
                    color: "bg-amber-600",
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1.5">
                      <span>
                        {item.label}: {Math.round(item.grams)}/{item.target}g
                      </span>
                      <span>{item.pct}%</span>
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
                <span className="material-symbols-outlined text-sm group-open:rotate-180 transition-transform">
                  expand_more
                </span>
              </summary>
              <div className="mt-2 space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-700">
                {[
                  {
                    label: "Energi (Kkal)",
                    value: `${Math.round(todayNutritionTotals.energyKkal).toLocaleString("id-ID")}`,
                  },
                  {
                    label: "Protein (gram)",
                    value: `${Math.round(todayNutritionTotals.proteinG).toLocaleString("id-ID")} g`,
                  },
                  {
                    label: "Lemak (gram)",
                    value: `${Math.round(todayNutritionTotals.fatsG).toLocaleString("id-ID")} g`,
                  },
                  {
                    label: "Karbohidrat (gram)",
                    value: `${Math.round(todayNutritionTotals.carbsG).toLocaleString("id-ID")} g`,
                  },
                  {
                    label: "Serat (g)",
                    value: `${Math.round(todayNutritionTotals.fiberG).toLocaleString("id-ID")} g`,
                  },
                  {
                    label: "Air (mL)",
                    value: `${Math.round(todayNutritionTotals.waterMl).toLocaleString("id-ID")} mL`,
                  },
                  {
                    label: "VIT A (RE)",
                    value:
                      todayNutritionTotals.vitA_RE == null
                        ? "—"
                        : Math.round(todayNutritionTotals.vitA_RE).toLocaleString("id-ID"),
                  },
                  {
                    label: "VIT D (mcg)",
                    value:
                      todayNutritionTotals.vitD_mcg == null
                        ? "—"
                        : Math.round(todayNutritionTotals.vitD_mcg).toLocaleString("id-ID"),
                  },
                  {
                    label: "VIT E (mg)",
                    value:
                      todayNutritionTotals.vitE_mg == null
                        ? "—"
                        : Math.round(todayNutritionTotals.vitE_mg).toLocaleString("id-ID"),
                  },
                  {
                    label: "VIT K (mcg)",
                    value:
                      todayNutritionTotals.vitK_mcg == null
                        ? "—"
                        : Math.round(todayNutritionTotals.vitK_mcg).toLocaleString("id-ID"),
                  },
                  {
                    label: "VIT C (mg)",
                    value:
                      todayNutritionTotals.vitC_mg == null
                        ? "—"
                        : Math.round(todayNutritionTotals.vitC_mg).toLocaleString("id-ID"),
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5"
                  >
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">{row.label}</span>
                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>

        {/* Weekly chart — line trend */}
        <div className="px-4 py-2">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">Tren kalori minggu</h3>
              <p className="mt-0.5 text-[11px] text-slate-400">Ketuk titik untuk lihat hari tersebut</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tabular-nums text-slate-600">
              Target {calorieTarget.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {weeklyError && (
              <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">{weeklyError}</p>
            )}
            {weeklyLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-500">
                Memuat grafik…
              </div>
            ) : !isApiBackendEnabled() ? (
              <div className="flex h-40 items-center justify-center px-2 text-center text-xs text-slate-500">
                Set VITE_API_URL untuk ringkasan kalori dari database.
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white px-1 pt-2 dark:from-slate-800/40 dark:to-slate-900">
                  <svg viewBox="0 0 310 110" className="w-full" role="img" aria-label="Tren kalori mingguan">
                    <defs>
                      <linearGradient id="weeklyTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={hasWeeklyOverCalorieTarget ? "#f59e0b" : "#10b981"}
                          stopOpacity="0.28"
                        />
                        <stop
                          offset="100%"
                          stopColor={hasWeeklyOverCalorieTarget ? "#f59e0b" : "#10b981"}
                          stopOpacity="0.02"
                        />
                      </linearGradient>
                      <linearGradient id="weeklyTrendStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={hasWeeklyOverCalorieTarget ? "#f59e0b" : "#059669"} />
                        <stop offset="100%" stopColor={hasWeeklyOverCalorieTarget ? "#ef4444" : "#006a3f"} />
                      </linearGradient>
                    </defs>

                    {/* baseline */}
                    <line x1="12" y1="92" x2="298" y2="92" stroke="#e2e8f0" strokeWidth="1.5" />

                    {/* target line */}
                    <line
                      x1="12"
                      y1={weeklyTrendPaths.targetY}
                      x2="268"
                      y2={weeklyTrendPaths.targetY}
                      stroke="#006a3f"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      opacity="0.55"
                    />
                    <rect
                      x="270"
                      y={weeklyTrendPaths.targetY - 8}
                      width="36"
                      height="14"
                      rx="4"
                      fill="#ecfdf5"
                      stroke="#a7f3d0"
                    />
                    <text
                      x="288"
                      y={weeklyTrendPaths.targetY + 2}
                      textAnchor="middle"
                      className="fill-[#006a3f]"
                      style={{ fontSize: 8, fontWeight: 700 }}
                    >
                      {calorieTarget >= 1000
                        ? `${(calorieTarget / 1000).toFixed(calorieTarget % 1000 === 0 ? 0 : 1)}k`
                        : String(calorieTarget)}
                    </text>

                    {weeklyTrendPaths.area ? (
                      <path d={weeklyTrendPaths.area} fill="url(#weeklyTrendFill)" />
                    ) : null}
                    {weeklyTrendPaths.line ? (
                      <path
                        d={weeklyTrendPaths.line}
                        fill="none"
                        stroke="url(#weeklyTrendStroke)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {weeklyChartPoints.map((day) => (
                      <g key={day.date}>
                        {day.calories_kcal > 0 ? (
                          <text
                            x={day.x}
                            y={day.y - 10}
                            textAnchor="middle"
                            className={day.isSelected ? "fill-[#006a3f]" : "fill-slate-500"}
                            style={{ fontSize: 8, fontWeight: 700 }}
                          >
                            {Math.round(day.calories_kcal) >= 1000
                              ? `${(day.calories_kcal / 1000).toFixed(1)}k`
                              : Math.round(day.calories_kcal)}
                          </text>
                        ) : null}
                        <circle
                          cx={day.x}
                          cy={day.y}
                          r={day.isSelected ? 6.5 : day.calories_kcal > 0 ? 4.5 : 3}
                          fill={
                            day.isSelected
                              ? "#006a3f"
                              : day.overTarget
                                ? "#f59e0b"
                                : day.calories_kcal > 0
                                  ? "#10b981"
                                  : "#cbd5e1"
                          }
                          stroke="#fff"
                          strokeWidth={day.isSelected ? 2.5 : 1.5}
                        />
                        {/* larger hit area */}
                        <circle
                          cx={day.x}
                          cy={day.y}
                          r="14"
                          fill="transparent"
                          className="cursor-pointer"
                          onClick={() => setSelectedDate(day.date)}
                        >
                          <title>{`${day.date}: ${Math.round(day.calories_kcal)} kkal`}</title>
                        </circle>
                      </g>
                    ))}
                  </svg>

                  <div className="mt-1 grid grid-cols-7 gap-1 pb-1">
                    {weeklyChartPoints.map((day) => (
                      <button
                        key={`lbl-${day.date}`}
                        type="button"
                        onClick={() => setSelectedDate(day.date)}
                        className={`truncate rounded-md py-1 text-center text-[10px] font-semibold transition-colors ${
                          day.isSelected
                            ? "bg-[#006a3f] text-white"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Rata-rata
                    </p>
                    <p className="mt-0.5 text-base font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {weeklyAvgCalories.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[10px] text-slate-400">kkal/hari</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      vs target
                    </p>
                    <p
                      className={`mt-0.5 text-base font-extrabold tabular-nums ${
                        weeklyProgressPct > 100 ? "text-amber-600" : "text-[#006a3f]"
                      }`}
                    >
                      {weeklyProgressPct > 100
                        ? `+${weeklyProgressPct - 100}%`
                        : `${weeklyProgressPct}%`}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {calorieTarget.toLocaleString("id-ID")}
                      {weeklySummary?.target_source === "goal" ? " · goal" : ""}
                    </p>
                  </div>
                  <Link
                    to="/history"
                    className="flex flex-col items-center justify-center rounded-xl bg-[#006a3f] px-2.5 py-2 text-center text-white active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[20px]">history</span>
                    <span className="mt-0.5 text-[11px] font-bold">Riwayat</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <NutritionDayAnalysisCharts
          totals={todayNutritionTotals}
          targets={targets}
          meals={todayFoodListItems}
          story={story}
          dateLabel={dateLabel}
        />

        {/* Meal history */}
        <div className="px-4 py-2 mb-24">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">
              Riwayat makanan · {dateLabel}
            </h3>
            <Link to="/history" className="text-primary text-sm font-semibold">
              Lihat semua
            </Link>
          </div>
          {riskyCount > 0 ? (
            <p className="mb-2 px-1 text-[11px] text-amber-800">
              {riskyCount} asupan pada tanggal ini ditandai tinggi gula/karbo (terkait MCU).
            </p>
          ) : null}
          {dailyLoading && isApiBackendEnabled() ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 border border-slate-100 dark:border-slate-800">
              Memuat riwayat…
            </div>
          ) : todayFoodListItems.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 text-center border border-slate-100 dark:border-slate-800">
              <p className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                Belum ada asupan pada tanggal ini
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {isToday
                  ? "Tambah makanan agar insight kesehatan bisa dihitung."
                  : "Coba tanggal lain atau pastikan data sudah tersimpan."}
              </p>
              {isToday ? (
                <Link
                  to="/food"
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white"
                >
                  Catat makanan
                </Link>
              ) : null}
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
                      <p className="text-slate-900 dark:text-slate-100 font-bold mt-2 leading-tight">
                        {it.title}
                      </p>
                      <p className="text-slate-500 text-sm mt-1 line-clamp-2">{it.subtitle}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          {it.historyHref ? "Lihat detail" : "Tersimpan di riwayat"}
                        </span>
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

        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-20">
          <Link to="/home" className={navItemClass("/home")}>
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
            <Link
              to="/activity/capture"
              className="size-14 bg-primary rounded-full text-white shadow-xl shadow-primary/30 flex items-center justify-center"
            >
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
