import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchStravaActivities,
  fetchStravaStatus,
  formatDistanceKm,
  formatDuration,
} from "../../lib/stravaApi";

function formatWhen(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Halaman Lari — data dari Strava (bukan preset dummy). */
export default function ActivityRunDetailContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preset = searchParams.get("preset");
  const [status, setStatus] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const st = await fetchStravaStatus();
        if (cancelled) return;
        setStatus(st);
        if (st.connected) {
          const { activities: list } = await fetchStravaActivities({ limit: 30 });
          if (!cancelled) setActivities(list || []);
        } else if (!cancelled) {
          setActivities([]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Gagal memuat aktivitas.");
          setStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runs = activities.filter((a) => {
    const t = String(a.sport_type || a.type || "").toLowerCase();
    if (preset === "lari" || !preset) {
      return t.includes("run") || t.includes("walk") || t.includes("hike") || !t;
    }
    return true;
  });

  return (
    <div className="bg-surface text-on-surface antialiased mx-auto min-h-dvh max-w-md relative pb-8">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-100 bg-emerald-50/80 px-4 py-3 backdrop-blur-xl pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          to="/home"
          className="flex size-10 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-100/50"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-lg font-black tracking-tight text-emerald-800">Lari / Aktivitas</span>
        <button
          type="button"
          onClick={() => navigate("/strava")}
          className="flex size-10 items-center justify-center rounded-full text-orange-600 hover:bg-orange-50"
          aria-label="Strava"
        >
          <span className="material-symbols-outlined">sync</span>
        </button>
      </header>

      <main className="space-y-4 px-4 py-4">
        {error ? (
          <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Memuat…</p>
        ) : !status?.connected ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
            <span className="material-symbols-outlined text-5xl text-orange-300">directions_run</span>
            <p className="mt-3 text-sm font-bold text-slate-800">Hubungkan Strava</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Aktivitas lari dan olahraga dari Strava akan muncul di sini.
            </p>
            <button
              type="button"
              onClick={() => navigate("/strava")}
              className="mt-4 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white"
            >
              Buka Strava
            </button>
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
            <p className="text-sm text-slate-500">Belum ada aktivitas. Sync dari halaman Strava.</p>
            <button
              type="button"
              onClick={() => navigate("/strava")}
              className="mt-3 text-[13px] font-semibold text-orange-600"
            >
              Sync sekarang
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] text-slate-500">
              Data dari Strava · {runs.length} aktivitas terbaru
            </p>
            {runs.map((a) => (
              <Link
                key={a.id}
                to={`/strava/activities/${a.id}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <span className="material-symbols-outlined">directions_run</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{a.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatWhen(a.start_date)} · {a.sport_type || a.type}
                  </p>
                  <p className="text-[12px] font-semibold text-primary">
                    {formatDistanceKm(a.distance_m)} · {formatDuration(a.moving_time_s)}
                    {a.calories != null ? ` · ${Math.round(a.calories)} kkal` : ""}
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-300">chevron_right</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
