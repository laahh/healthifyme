import { Link, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";

const PAGE = 40;

export default function WorkoutExercisesListContent() {
  const location = useLocation();
  const currentPath = location.pathname;
  const isNavActive = (path) => currentPath === path;
  const navItemClass = (path) =>
    `flex flex-col items-center gap-1 ${isNavActive(path) ? "text-primary" : "text-slate-400"}`;
  const navLabelClass = (path) => `text-[10px] ${isNavActive(path) ? "font-bold" : "font-medium"}`;

  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (from, append) => {
    if (!isApiBackendEnabled()) {
      setError("Atur VITE_API_URL dan jalankan migrasi katalog latihan.");
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest(`/exercises?limit=${PAGE}&offset=${from}`);
      const next = Array.isArray(data?.exercises) ? data.exercises : [];
      setItems((prev) => (append ? [...prev, ...next] : next));
      setHasMore(next.length === PAGE);
      setOffset(from + next.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat daftar.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(0, false);
  }, [load]);

  return (
    <div className="font-['Public_Sans'] bg-background-light text-slate-900 min-h-screen dark:bg-background-dark dark:text-slate-100">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto pb-28">
        <div className="flex items-center bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 justify-between">
          <Link to="/workout/insight" className="flex size-12 shrink-0 items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">arrow_back</span>
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Katalog latihan</h2>
          <div className="w-12" />
        </div>

        <div className="px-4 py-3 flex flex-col gap-2">
          {loading && <p className="text-center text-sm text-slate-500 py-6">Memuat…</p>}
          {error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {error}
            </div>
          )}
          {!loading &&
            !error &&
            items.map((ex) => (
              <Link
                key={ex.id}
                to={`/workout/exercise/${ex.id}`}
                className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 active:opacity-90"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">{ex.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                    {(ex.targetMuscles || []).map((m) => m.name).join(" · ") || "—"}
                  </p>
                </div>
                {ex.gifUrl ? (
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700">
                    <img src={ex.gifUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="material-symbols-outlined">fitness_center</span>
                  </div>
                )}
              </Link>
            ))}

          {!loading && !error && hasMore && items.length > 0 && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                load(offset, true);
              }}
              className="mt-2 h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              {loadingMore ? "Memuat…" : "Muat lagi"}
            </button>
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-20 dark:bg-slate-900 dark:border-slate-800">
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
