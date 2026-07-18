import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FALLBACK_CATALOG,
  fetchFoodCatalog,
  getStoredMealType,
  logFoodItem,
  setStoredMealType,
} from "../../lib/foodLogApi";
import { showError, showToast as swalToast, showWarning } from "../../lib/appAlert";
import { fetchTodayHealthAlerts, hasHealthAlerts, healthAlertSeverity } from "../../lib/healthAlertApi";
import HealthAlertBanner from "../health/HealthAlertBanner";

const HISTORY_KEY = "health_upload_history_v1";

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const TABS = [
  { key: "all", label: "All" },
  { key: "meals", label: "My Meals" },
  { key: "recipes", label: "My Recipes" },
  { key: "foods", label: "My Foods" },
];

const DAY_FILTERS = [
  { key: "today", label: "Hari ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "week", label: "7 hari" },
  { key: "all", label: "Semua" },
];

const ACCENT = "#2563eb";

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdFromTs(ts) {
  if (ts == null) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return localYmd(d);
}

function addDaysYmd(ymd, delta) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return localYmd(d);
}

function loadFoodHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && it.type === "food")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

function FoodRow({ name, sub, verified, onAdd, busy }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-100">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
          <span className="truncate">{name}</span>
          {verified ? (
            <span className="material-symbols-outlined shrink-0 text-[16px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{sub}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onAdd}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50"
        style={{ backgroundColor: ACCENT }}
        aria-label="Tambah"
      >
        <span className="material-symbols-outlined text-[22px]">add</span>
      </button>
    </div>
  );
}

export default function FoodLogHubContent() {
  const navigate = useNavigate();
  const [meal, setMeal] = useState(getStoredMealType);
  const [mealOpen, setMealOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [dayFilter, setDayFilter] = useState("today");
  const [historyTick, setHistoryTick] = useState(0);
  const [healthAlert, setHealthAlert] = useState(null);

  const mealLabel = MEALS.find((m) => m.key === meal)?.label || "Lunch";

  const showToast = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  };

  const refreshHealthAlert = useCallback(async () => {
    try {
      const alert = await fetchTodayHealthAlerts();
      setHealthAlert(hasHealthAlerts(alert) ? alert : null);
    } catch {
      setHealthAlert(null);
    }
  }, []);

  useEffect(() => {
    refreshHealthAlert();
  }, [refreshHealthAlert, historyTick]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const cat = await fetchFoodCatalog(query.trim() ? { q: query.trim() } : { popular: true });
      setCatalog(cat.items?.length ? cat.items : FALLBACK_CATALOG);
    } catch (e) {
      setCatalog(FALLBACK_CATALOG);
      setError(e?.message || "Mode offline — katalog demo.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = window.setTimeout(load, query ? 280 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  useEffect(() => {
    setStoredMealType(meal);
  }, [meal]);

  useEffect(() => {
    const refresh = () => setHistoryTick((n) => n + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const foodHistory = useMemo(() => {
    void historyTick;
    return loadFoodHistory();
  }, [historyTick]);

  const filteredHistory = useMemo(() => {
    const today = localYmd();
    const yesterday = addDaysYmd(today, -1);
    const weekStart = addDaysYmd(today, -6);
    const q = query.trim().toLowerCase();

    return foodHistory.filter((it) => {
      const day = ymdFromTs(it.createdAt);
      if (dayFilter === "today" && day !== today) return false;
      if (dayFilter === "yesterday" && day !== yesterday) return false;
      if (dayFilter === "week" && (day < weekStart || day > today)) return false;
      if (!q) return true;
      const itemParts = Array.isArray(it.foodItems) ? it.foodItems.flatMap((f) => [f?.name, f?.detail]) : [];
      const haystack = [it.foodName, it.nutritionNotes, ...itemParts]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [foodHistory, dayFilter, query]);

  const onAddCatalog = async (item) => {
    setBusyId(String(item.id));
    try {
      const res = await logFoodItem({
        food_name: item.name,
        calories: Number(item.calories) || 0,
        protein_g: item.protein_g,
        fats_g: item.fats_g,
        carbs_g: item.carbs_g,
        serving_label: item.serving_label,
        meal_type: meal,
        source_type: "manual",
      });
      swalToast(`Ditambahkan ke ${mealLabel}`);
      const alert = res?.healthAlert;
      if (hasHealthAlerts(alert)) {
        setHealthAlert(alert);
        const sev = healthAlertSeverity(alert);
        if (sev === "high" || sev === "warning") {
          showWarning(
            alert.primary?.title || "Peringatan MCU",
            alert.primary?.message || ""
          );
        }
      } else {
        refreshHealthAlert();
      }
      setHistoryTick((n) => n + 1);
    } catch (e) {
      showError("Gagal menambah", e?.message || "");
    } finally {
      setBusyId("");
    }
  };

  const goMealScan = () => {
    setStoredMealType(meal);
    navigate("/food/scan");
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#f3f4f6] font-['Public_Sans',sans-serif] text-slate-900">
      <header className="shrink-0 bg-[#f3f4f6] px-3 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="absolute left-0 flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <button
            type="button"
            onClick={() => setMealOpen((v) => !v)}
            className="flex items-center gap-1 text-[17px] font-bold"
            style={{ color: ACCENT }}
          >
            {mealLabel}
            <span className="material-symbols-outlined text-[20px]">expand_more</span>
          </button>
        </div>
        {mealOpen ? (
          <div className="absolute left-1/2 z-30 mt-1 w-44 -translate-x-1/2 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-100">
            {MEALS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setMeal(m.key);
                  setStoredMealType(m.key);
                  setMealOpen(false);
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm font-semibold ${
                  meal === m.key ? "bg-blue-50 text-blue-700" : "text-slate-700"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative mt-3">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[22px] text-slate-400">
            search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods, brands, flavors..."
            className="w-full rounded-2xl border-0 bg-white py-3 pl-11 pr-4 text-[14px] outline-none shadow-sm placeholder:text-slate-400"
          />
        </div>

        <div className="mt-3 flex gap-5 overflow-x-auto border-b border-slate-200 px-1 [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 pb-2 text-[14px] font-semibold ${
                tab === t.key ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        {toast ? (
          <p className="mb-2 rounded-xl bg-slate-900/90 px-3 py-2 text-center text-[12px] text-white">
            {toast}
          </p>
        ) : null}
        {error ? (
          <p className="mb-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {error}
          </p>
        ) : null}
        {hasHealthAlerts(healthAlert) ? (
          <HealthAlertBanner healthAlert={healthAlert} compact className="mb-3" />
        ) : null}

        {tab !== "all" ? (
          <div className="rounded-2xl bg-white px-4 py-12 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-800">{TABS.find((t) => t.key === tab)?.label}</p>
            <p className="mt-1 text-[12px] text-slate-500">Segera hadir di versi berikutnya.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: "barcode", label: "Barcode scan", icon: "barcode_reader", to: "/food/barcode" },
                { key: "voice", label: "Voice log", icon: "mic", action: "voice" },
                { key: "scan", label: "Meal scan", icon: "photo_camera", action: "scan" },
                { key: "quick", label: "Quick add", icon: "add_circle", to: `/food/manual?meal=${meal}` },
              ].map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    if (a.action === "voice") showToast("Voice log segera hadir");
                    else if (a.action === "scan") goMealScan();
                    else if (a.to) navigate(a.to);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 shadow-sm ring-1 ring-slate-100 active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[26px]" style={{ color: ACCENT }}>
                    {a.icon}
                  </span>
                  <span className="text-center text-[11px] font-semibold leading-tight" style={{ color: ACCENT }}>
                    {a.label}
                  </span>
                </button>
              ))}
            </div>

            <section className="mt-5">
              <div className="mb-3 flex items-end justify-between px-0.5">
                <div>
                  <h2 className="text-[17px] font-bold">History Upload</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">Upload makanan seperti di History</p>
                </div>
                <Link to="/history" className="text-[12px] font-semibold" style={{ color: ACCENT }}>
                  Lihat semua
                </Link>
              </div>

              <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                {DAY_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setDayFilter(f.key)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                      dayFilter === f.key
                        ? "text-white shadow-sm"
                        : "bg-white text-slate-600 ring-1 ring-slate-100"
                    }`}
                    style={dayFilter === f.key ? { backgroundColor: ACCENT } : undefined}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="mb-2 flex items-center justify-between px-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {DAY_FILTERS.find((f) => f.key === dayFilter)?.label}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                  {filteredHistory.length} item
                </span>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-sm ring-1 ring-slate-100">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <span className="material-symbols-outlined text-[26px]">restaurant</span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-800">Belum ada history</p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Upload foto makanan dari Home atau Meal scan, nanti muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((it) => {
                    const title = (it.foodName || "").trim() || "Upload makanan";
                    const notes =
                      (it.nutritionNotes || "").trim() ||
                      "Foto konsumsi makanan untuk tracking nutrisi.";
                    const calStr =
                      it.calories != null && it.calories !== "" ? `${it.calories} kkal` : "—";
                    return (
                      <Link
                        key={it.id}
                        to={`/history/${it.id}`}
                        className="group flex gap-3 rounded-[1.25rem] bg-white p-3.5 shadow-sm ring-1 ring-slate-100 transition-transform active:scale-[0.99]"
                      >
                        <div className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                          {it.image && String(it.image).trim() ? (
                            <img
                              src={it.image}
                              alt=""
                              className="size-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling;
                                if (fallback) fallback.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <span
                            className={`material-symbols-outlined text-3xl text-slate-400 ${
                              it.image && String(it.image).trim() ? "hidden" : ""
                            }`}
                          >
                            restaurant
                          </span>
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                              Makanan
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                              {new Date(it.createdAt).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <p className="mt-1.5 truncate text-[14px] font-bold leading-tight text-slate-900">
                            {title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-500">{notes}</p>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Lihat detail</span>
                            <span className="text-[12px] font-bold" style={{ color: ACCENT }}>
                              {calStr}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-5">
              <h2 className="mb-2 px-0.5 text-[17px] font-bold">Most popular</h2>
              {loading && catalog.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-slate-400">Memuat…</p>
              ) : (
                <div className="space-y-2">
                  {catalog.map((c) => (
                    <FoodRow
                      key={c.id}
                      name={c.name}
                      sub={`${Math.round(c.calories)} cal, ${c.serving_label}${c.source_label ? `, ${c.source_label}` : ""}`}
                      verified={Boolean(c.source_label && /verified|fatsecret/i.test(c.source_label))}
                      busy={busyId === String(c.id)}
                      onAdd={() => onAddCatalog(c)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
