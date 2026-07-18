import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const HISTORY_KEY = "health_upload_history_v1";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "food", label: "Makanan" },
  { key: "activity", label: "Olahraga" },
];

function hasUsableImage(src) {
  const s = typeof src === "string" ? src.trim() : "";
  return Boolean(s) && s !== "undefined" && s !== "null";
}

function calorieOf(it) {
  const n = Number(it?.energyKkal ?? it?.totalCalories ?? it?.calories);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function titleOf(it) {
  if (it?.type === "food") return it.foodName || "Makanan";
  return it?.activityType || it?.foodName || "Olahraga";
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDayLabel(ts) {
  try {
    const d = new Date(ts);
    const today = new Date();
    const yday = new Date();
    yday.setDate(today.getDate() - 1);
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return "Hari ini";
    if (sameDay(d, yday)) return "Kemarin";
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Lainnya";
  }
}

function dayKey(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function HistoryContent() {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return [...parsed].sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
    } catch {
      return [];
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (!it || !it.type) return false;
      if (filter !== "all" && it.type !== filter) return false;
      if (!q) return true;
      const itemParts = Array.isArray(it.foodItems)
        ? it.foodItems.flatMap((f) => [f?.name, f?.detail])
        : [];
      const haystack = [
        it.type === "food" ? "makanan" : "olahraga",
        it.foodName,
        it.activityType,
        it.workoutSummary,
        it.nutritionNotes,
        ...itemParts,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, filter, query]);

  const grouped = useMemo(() => {
    /** @type {Record<string, { label: string, items: typeof filtered }>} */
    const map = {};
    const order = [];
    for (const it of filtered) {
      const key = dayKey(it.createdAt);
      if (!map[key]) {
        map[key] = { label: formatDayLabel(it.createdAt), items: [] };
        order.push(key);
      }
      map[key].items.push(it);
    }
    return order.map((key) => map[key]);
  }, [filtered]);

  const foodCount = items.filter((i) => i?.type === "food").length;
  const activityCount = items.filter((i) => i?.type === "activity").length;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f8faf9] text-slate-900 antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-100/80 bg-white/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <Link
            to="/home"
            className="flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
            aria-label="Kembali"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Riwayat</h1>
          <span className="w-10" aria-hidden />
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-slate-400">
            search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border-0 bg-slate-100 py-3 pl-11 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-0 focus:bg-white focus:ring-2 focus:ring-[#006a3f]/30"
            placeholder="Cari makanan atau olahraga…"
            type="search"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              aria-label="Hapus pencarian"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                  active
                    ? "bg-[#006a3f] text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label}
                {f.key === "food" && foodCount > 0 ? (
                  <span className={`ml-1.5 tabular-nums ${active ? "text-white/80" : "text-slate-400"}`}>
                    {foodCount}
                  </span>
                ) : null}
                {f.key === "activity" && activityCount > 0 ? (
                  <span className={`ml-1.5 tabular-nums ${active ? "text-white/80" : "text-slate-400"}`}>
                    {activityCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300">
              {query ? "search_off" : "history"}
            </span>
            <p className="mt-3 text-sm font-bold text-slate-800">
              {query ? "Tidak ada hasil" : "Belum ada riwayat"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              {query
                ? "Coba kata kunci lain atau ubah filter."
                : "Catat makanan atau olahraga dari Home, lalu muncul di sini."}
            </p>
            {!query ? (
              <Link
                to="/home"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-[#006a3f] px-4 text-sm font-bold text-white"
              >
                Ke Home
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <p className="px-0.5 text-[12px] font-medium text-slate-500">
              {filtered.length} item
              {query ? ` · “${query.trim()}”` : ""}
            </p>

            {grouped.map((group) => (
              <section key={group.label}>
                <h2 className="mb-2 px-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-400">
                  {group.label}
                </h2>
                <ul className="space-y-2">
                  {group.items.map((it) => {
                    const isFood = it.type === "food";
                    const cal = calorieOf(it);
                    const img = hasUsableImage(it.image);
                    return (
                      <li key={it.id}>
                        <Link
                          to={`/history/${it.id}`}
                          className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition active:scale-[0.99]"
                        >
                          <div
                            className={`relative size-[68px] shrink-0 overflow-hidden rounded-xl ${
                              isFood ? "bg-amber-50" : "bg-sky-50"
                            }`}
                          >
                            {img ? (
                              <img
                                src={it.image}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fb = e.currentTarget.nextElementSibling;
                                  if (fb) fb.classList.remove("hidden");
                                }}
                              />
                            ) : null}
                            <span
                              className={`absolute inset-0 flex items-center justify-center material-symbols-outlined text-3xl ${
                                isFood ? "text-amber-400" : "text-sky-400"
                              } ${img ? "hidden" : ""}`}
                            >
                              {isFood ? "restaurant" : "exercise"}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1 py-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      isFood
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-sky-50 text-sky-700"
                                    }`}
                                  >
                                    {isFood ? "Makanan" : "Olahraga"}
                                  </span>
                                  <span className="text-[11px] font-medium text-slate-400">
                                    {formatTime(it.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-1 truncate text-[14px] font-bold leading-snug text-slate-900">
                                  {titleOf(it)}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[13px] font-extrabold tabular-nums text-[#006a3f]">
                                  {cal != null ? cal.toLocaleString("id-ID") : "—"}
                                </p>
                                <p className="text-[10px] font-semibold text-slate-400">kkal</p>
                              </div>
                            </div>
                            <p className="mt-1 line-clamp-1 text-[12px] text-slate-500">
                              {isFood
                                ? it.nutritionNotes || "Ketuk untuk lihat detail nutrisi"
                                : it.workoutSummary?.split("\n")[0] ||
                                  it.nutritionNotes ||
                                  "Ketuk untuk lihat detail olahraga"}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-md items-center justify-between border-t border-slate-100 bg-white px-6 py-3">
        <Link className="flex flex-col items-center gap-1 text-primary" to="/home">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            grid_view
          </span>
          <span className="text-[10px] font-bold">Dashboard</span>
        </Link>
        <Link className="flex flex-col items-center gap-1 text-slate-400" to="/nutrition/insight">
          <span className="material-symbols-outlined">restaurant</span>
          <span className="text-[10px] font-medium">Makanan</span>
        </Link>
        <div className="relative -top-8">
          <Link
            to="/activity/capture"
            className="flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30"
          >
            <span className="material-symbols-outlined text-3xl">add</span>
          </Link>
        </div>
        <Link className="flex flex-col items-center gap-1 text-slate-400" to="/workout/insight">
          <span className="material-symbols-outlined">exercise</span>
          <span className="text-[10px] font-medium">Workout</span>
        </Link>
        <Link className="flex flex-col items-center gap-1 text-slate-400" to="/profile">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-medium">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
