import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { buildNutritionRows, dispNutrient } from "../../utils/foodNutritionRows";
import { getSessionUser } from "../../auth/auth";
import { deleteHistoryItemFromCloud } from "../../services/supabaseDataService";
import { showConfirm, showSuccess } from "../../lib/appAlert";

const HISTORY_KEY = "health_upload_history_v1";

function hasUsableImage(src) {
  const s = typeof src === "string" ? src.trim() : "";
  return Boolean(s) && s !== "undefined" && s !== "null";
}

function formatWhen(ts) {
  try {
    return new Date(ts).toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function HistoryItemDetailContent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sessionUser = getSessionUser();
  const [imageFailed, setImageFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  let item = null;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      item = parsed.find((it) => String(it.id) === String(id)) || null;
    }
  } catch {
    item = null;
  }

  const handleDelete = async () => {
    const ok = await showConfirm(
      "Hapus dari riwayat?",
      "Data ini akan dihapus dari perangkat dan cloud (jika tersinkron).",
      "Hapus"
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(parsed) ? parsed.filter((it) => String(it.id) !== String(id)) : [];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    if (sessionUser?.id) {
      try {
        await deleteHistoryItemFromCloud(sessionUser.id, id);
      } catch {
        /* ignore */
      }
    }
    showSuccess("Dihapus", "Item riwayat berhasil dihapus.");
    navigate("/history");
  };

  if (!item) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8faf9] p-6">
        <div className="max-w-sm text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300">search_off</span>
          <p className="mt-3 text-base font-bold text-slate-800">Item tidak ditemukan</p>
          <p className="mt-1 text-sm text-slate-500">Mungkin sudah dihapus atau belum tersinkron di perangkat ini.</p>
          <Link
            to="/history"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#006a3f] px-5 text-sm font-bold text-white"
          >
            Kembali ke riwayat
          </Link>
        </div>
      </div>
    );
  }

  const isFood = item.type === "food";
  const isActivity = item.type === "activity";
  const title =
    (isActivity ? item.activityType || item.foodName : item.foodName) ||
    (isFood ? "Makanan" : "Olahraga");
  const notes = String(
    (isActivity ? item.workoutSummary || item.nutritionNotes : item.nutritionNotes) || ""
  ).trim();
  const showImage = hasUsableImage(item.image) && !imageFailed;

  const energy = numOrNull(item.energyKkal ?? item.totalCalories ?? item.calories);
  const protein = numOrNull(item.proteinG);
  const fats = numOrNull(item.fatsG);
  const carbs = numOrNull(item.carbsG);
  const fiber = numOrNull(item.fiberG);

  const macroCards = isFood
    ? [
        { label: "Protein", value: dispNutrient(protein, " g"), icon: "egg", tone: "bg-amber-50 text-amber-800" },
        { label: "Lemak", value: dispNutrient(fats, " g"), icon: "water_drop", tone: "bg-rose-50 text-rose-800" },
        { label: "Karbo", value: dispNutrient(carbs, " g"), icon: "grain", tone: "bg-emerald-50 text-emerald-800" },
        { label: "Serat", value: dispNutrient(fiber, " g"), icon: "eco", tone: "bg-lime-50 text-lime-800" },
      ]
    : [];

  const vitaminRows = isFood
    ? buildNutritionRows(item).filter((r) => r.label.startsWith("VIT"))
    : [];

  const foodItems = Array.isArray(item.foodItems) ? item.foodItems.filter((r) => r?.name || r?.detail) : [];

  const workoutLines =
    isActivity && item.workoutSummary
      ? String(item.workoutSummary)
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      : [];

  const mealTypeLabel = {
    breakfast: "Sarapan",
    lunch: "Makan siang",
    dinner: "Makan malam",
    snack: "Cemilan",
  }[item.meal_type || item.mealType];

  const sourceLabel = {
    photo: "Scan foto",
    manual: "Input manual",
    barcode: "Barcode",
  }[item.source_type || item.sourceType];

  return (
    <div className="relative mx-auto min-h-screen max-w-md bg-[#f8faf9] pb-28 text-slate-900 antialiased">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-100/80 bg-white/90 px-4 py-3 backdrop-blur-xl">
        <Link
          to="/history"
          className="flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
          aria-label="Kembali"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="min-w-0 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {isFood ? "Detail makanan" : "Detail olahraga"}
          </p>
          <p className="truncate text-sm font-bold text-slate-800">{formatWhen(item.createdAt)}</p>
        </div>
        <span className="w-10" aria-hidden />
      </header>

      <main>
        {/* Hero media */}
        <div
          className={`relative h-52 w-full overflow-hidden ${
            showImage ? "bg-slate-900" : isFood ? "bg-amber-50" : "bg-sky-50"
          }`}
        >
          {showImage ? (
            <img
              src={item.image}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
              <span className="material-symbols-outlined text-5xl">
                {isFood ? "restaurant" : "exercise"}
              </span>
              <p className="px-8 text-center text-sm font-medium text-slate-500">Tidak ada foto</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          {energy != null ? (
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold leading-tight text-white drop-shadow">{title}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isFood ? "bg-emerald-400/90 text-emerald-950" : "bg-sky-400/90 text-sky-950"
                    }`}
                  >
                    {isFood ? "Makanan" : "Olahraga"}
                  </span>
                  {mealTypeLabel ? (
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                      {mealTypeLabel}
                    </span>
                  ) : null}
                  {sourceLabel ? (
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                      {sourceLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 rounded-2xl bg-white/95 px-3 py-2 text-right shadow-lg backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {isFood ? "Energi" : "Kalori"}
                </p>
                <p className="text-xl font-black tabular-nums leading-none text-[#006a3f]">
                  {Math.round(energy).toLocaleString("id-ID")}
                  <span className="ml-0.5 text-xs font-bold text-slate-500">kkal</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-4 left-4 right-4">
              <p className="truncate text-lg font-extrabold text-white drop-shadow">{title}</p>
              <span
                className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  isFood ? "bg-emerald-400/90 text-emerald-950" : "bg-sky-400/90 text-sky-950"
                }`}
              >
                {isFood ? "Makanan" : "Olahraga"}
              </span>
            </div>
          )}
        </div>

        <section className="space-y-3 px-4 py-4">
          {/* Macro grid — food */}
          {isFood ? (
            <div className="grid grid-cols-2 gap-2.5">
              {macroCards.map((m) => (
                <div
                  key={m.label}
                  className={`flex items-center gap-2.5 rounded-2xl border border-white px-3 py-3 shadow-sm ${m.tone}`}
                >
                  <span className="material-symbols-outlined text-[22px] opacity-80">{m.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{m.label}</p>
                    <p className="truncate text-base font-extrabold tabular-nums">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Activity key stats */}
          {isActivity ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kalori</p>
                <p className="mt-0.5 text-lg font-extrabold tabular-nums text-slate-900">
                  {energy != null ? `${Math.round(energy).toLocaleString("id-ID")} kkal` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Durasi</p>
                <p className="mt-0.5 text-lg font-extrabold text-slate-900">
                  {item.workoutTime || item.duration || "—"}
                </p>
              </div>
              {item.distance ? (
                <div className="col-span-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jarak</p>
                  <p className="mt-0.5 text-lg font-extrabold text-slate-900">{item.distance}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Notes / advice */}
          {notes && !(isActivity && workoutLines.length > 0) ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#006a3f]">tips_and_updates</span>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Catatan</p>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-700">{notes}</p>
            </div>
          ) : null}

          {/* Food components */}
          {isFood && foodItems.length > 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Komponen ({foodItems.length})
              </p>
              <ul className="space-y-2">
                {foodItems.map((row, idx) => (
                  <li
                    key={`${row.name}-${idx}`}
                    className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-900">{row.name || "Item"}</p>
                      {row.detail ? (
                        <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{row.detail}</p>
                      ) : null}
                    </div>
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-400 ring-1 ring-slate-100">
                      {idx + 1}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Activity summary lines */}
          {isActivity && workoutLines.length > 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Ringkasan</p>
              <ul className="space-y-2">
                {workoutLines.map((line, idx) => (
                  <li
                    key={`${line}-${idx}`}
                    className="rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] font-medium leading-snug text-slate-800"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Extra nutrition details */}
          {isFood ? (
            <details className="group rounded-2xl border border-slate-100 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Detail tambahan
                </span>
                <span className="material-symbols-outlined text-slate-400 transition-transform group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <div className="space-y-1.5 border-t border-slate-100 px-4 pb-4 pt-3">
                {vitaminRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <span className="text-[12px] text-slate-600">{row.label}</span>
                      <span className="text-[12px] font-bold text-slate-900">{row.text}</span>
                    </div>
                  ))}
                {item.barcode ? (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-[12px] text-slate-600">Barcode</span>
                    <span className="text-[12px] font-bold text-slate-900">{item.barcode}</span>
                  </div>
                ) : null}
                {item.serving_label || item.servingLabel ? (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-[12px] text-slate-600">Porsi</span>
                    <span className="text-[12px] font-bold text-slate-900">
                      {item.serving_label || item.servingLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}

          <p className="px-1 pb-2 text-center text-[11px] text-slate-400">
            Dicatat {formatWhen(item.createdAt)}
          </p>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-slate-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link
            to="/history"
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-100 text-sm font-bold text-slate-800"
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            Riwayat
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-red-50 text-sm font-bold text-red-700 ring-1 ring-red-100 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
            {deleting ? "Menghapus…" : "Hapus"}
          </button>
        </div>
      </footer>
    </div>
  );
}
