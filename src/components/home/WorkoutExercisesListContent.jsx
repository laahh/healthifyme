import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";
import AppBottomNav from "../layout/AppBottomNav";

const PAGE = 40;

function metaLine(ex) {
  const muscles = (ex.targetMuscles || []).map((m) => m.name).filter(Boolean);
  const parts = (ex.bodyParts || []).map((p) => p.name).filter(Boolean);
  const bits = [...muscles.slice(0, 2), ...parts.slice(0, 1)];
  return bits.length ? bits.join(" · ") : "—";
}

export default function WorkoutExercisesListContent() {
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
    <div className="relative mx-auto min-h-screen max-w-md bg-surface pb-28 text-on-surface antialiased">
      <header className="sticky top-0 z-50 flex items-center justify-between bg-emerald-50/80 px-6 py-4 backdrop-blur-xl">
        <Link
          to="/workout/insight"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 hover:bg-emerald-100/50 active:scale-95"
        >
          <span className="material-symbols-outlined text-emerald-700">arrow_back</span>
        </Link>
        <h1 className="text-2xl font-black tracking-tighter text-emerald-800">Katalog</h1>
        <span className="flex h-10 w-10 items-center justify-center rounded-full">
          <span className="material-symbols-outlined text-emerald-700">fitness_center</span>
        </span>
      </header>

      <main className="px-6 pt-2">
        {loading && (
          <div className="divide-y divide-slate-100">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 py-4">
                <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-slate-200" />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <div className="h-4 w-[75%] animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-[50%] animate-pulse rounded bg-slate-100" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="py-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              {error}
            </div>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="py-12 text-center text-sm text-on-surface-variant">Belum ada latihan di katalog.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {items.map((ex) => {
              const chips = (ex.bodyParts || []).slice(0, 2);
              return (
                <li key={ex.id}>
                  <Link
                    to={`/workout/exercise/${ex.id}`}
                    className="flex gap-4 py-4 transition-opacity active:opacity-70"
                  >
                    {ex.gifUrl ? (
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black">
                        <img src={ex.gifUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-700 text-white">
                        <span className="material-symbols-outlined text-3xl">fitness_center</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-extrabold leading-snug tracking-tight text-on-surface">
                        {ex.name}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[12px] text-on-surface-variant">{metaLine(ex)}</p>
                      {chips.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {chips.map((p) => (
                            <span
                              key={p.id}
                              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary"
                            >
                              {p.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="material-symbols-outlined mt-1 shrink-0 self-center text-slate-300">
                      chevron_right
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && hasMore && items.length > 0 && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              load(offset, true);
            }}
            className="mb-4 mt-2 flex h-12 w-full items-center justify-center rounded-full bg-surface-container-low text-sm font-bold text-on-surface disabled:opacity-50"
          >
            {loadingMore ? "Memuat…" : "Muat lagi"}
          </button>
        )}
      </main>

      <AppBottomNav />
    </div>
  );
}
