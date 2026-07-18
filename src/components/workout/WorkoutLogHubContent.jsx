import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";
import {
  FALLBACK_WORKOUT_CATALOG,
  fetchWorkoutCatalog,
  fetchWorkoutRecent,
  logWorkoutItem,
} from "../../lib/workoutLogApi";
import {
  fetchStravaActivities,
  fetchStravaStatus,
  formatDistanceKm,
  formatDuration,
  syncStrava,
} from "../../lib/stravaApi";
import { showError, showSuccess, showToast as swalToast } from "../../lib/appAlert";
import { getSessionUser } from "../../auth/auth";
import WorkoutManualSheet from "./WorkoutManualSheet";

const ACCENT = "#006a3f";

function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWhen(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WorkoutRow({ name, sub, icon = "exercise", onAdd, busy, href }) {
  const body = (
    <>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-slate-900">{name}</p>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{sub}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-100"
      >
        {body}
        <span className="material-symbols-outlined text-slate-300">chevron_right</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-100">
      {body}
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

export default function WorkoutLogHubContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUser = getSessionUser();
  const myUserId = sessionUser?.id != null ? String(sessionUser.id) : "";

  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState(FALLBACK_WORKOUT_CATALOG);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [todayStats, setTodayStats] = useState(null);
  const [stravaStatus, setStravaStatus] = useState(null);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [stravaBusy, setStravaBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cat, rec] = await Promise.all([
        fetchWorkoutCatalog(query.trim() ? { q: query.trim() } : {}),
        fetchWorkoutRecent(),
      ]);
      setCatalog(cat.items?.length ? cat.items : FALLBACK_WORKOUT_CATALOG);
      setRecent(rec.items || []);
    } catch (e) {
      setCatalog(FALLBACK_WORKOUT_CATALOG);
      setRecent([]);
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
    if (!location.state?.openManual) return;
    setManualOpen(true);
    navigate("/workout", { replace: true, state: {} });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!isApiBackendEnabled() || !myUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const date = localTodayYmd();
        const data = await apiRequest(
          `/me/workouts/weekly-summary?date=${encodeURIComponent(date)}`
        );
        if (cancelled) return;
        if (data?.user_id != null && String(data.user_id) !== myUserId) {
          setTodayStats(null);
          return;
        }
        const today = Array.isArray(data?.days) ? data.days.find((d) => d.date === date) : null;
        setTodayStats(today || null);
      } catch {
        if (!cancelled) setTodayStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUserId, recent]);

  useEffect(() => {
    if (!isApiBackendEnabled() || !myUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchStravaStatus();
        if (cancelled) return;
        setStravaStatus(status);
        if (status?.connected) {
          const { activities } = await fetchStravaActivities({ limit: 8 });
          const mine = (Array.isArray(activities) ? activities : []).filter(
            (a) => !a?.user_id || String(a.user_id) === myUserId
          );
          if (!cancelled) setStravaActivities(mine);
        } else {
          setStravaActivities([]);
        }
      } catch {
        if (!cancelled) {
          setStravaStatus(null);
          setStravaActivities([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUserId]);

  const filteredRecent = useMemo(() => {
    if (!query.trim()) return recent;
    const q = query.trim().toLowerCase();
    return recent.filter((r) => String(r.activity_type || "").toLowerCase().includes(q));
  }, [recent, query]);

  const onAddCatalog = async (item) => {
    setBusyId(String(item.id));
    try {
      await logWorkoutItem({
        activity_type: item.name,
        calories: Number(item.calories) || 0,
        duration_min: Number(item.duration_min) || null,
      });
      swalToast(`${item.name} ditambahkan`);
      const rec = await fetchWorkoutRecent();
      setRecent(rec.items || []);
    } catch (e) {
      showError("Gagal menambah", e?.message || "");
    } finally {
      setBusyId("");
    }
  };

  const onAddRecent = async (item) => {
    setBusyId(`r-${item.id}`);
    try {
      await logWorkoutItem({
        activity_type: item.activity_type,
        calories: Number(item.calories) || 0,
        workout_time: item.workout_time || null,
        distance: item.distance || null,
      });
      swalToast(`${item.activity_type} ditambahkan`);
      const rec = await fetchWorkoutRecent();
      setRecent(rec.items || []);
    } catch (e) {
      showError("Gagal menambah", e?.message || "");
    } finally {
      setBusyId("");
    }
  };

  const onSyncStrava = async () => {
    setStravaBusy(true);
    try {
      const r = await syncStrava();
      showSuccess("Sync selesai", `${r.imported ?? 0} aktivitas diimpor/diperbarui.`);
      const { activities } = await fetchStravaActivities({ limit: 8 });
      const mine = (Array.isArray(activities) ? activities : []).filter(
        (a) => !a?.user_id || String(a.user_id) === myUserId
      );
      setStravaActivities(mine);
      const st = await fetchStravaStatus();
      setStravaStatus(st);
    } catch (e) {
      showError("Gagal sync Strava", e?.message || "");
    } finally {
      setStravaBusy(false);
    }
  };

  const todaySessions = Number(todayStats?.sessions) || 0;
  const todayMinutes = Math.round(Number(todayStats?.duration_min) || 0);
  const todayCalories = Math.round(Number(todayStats?.calories_kcal) || 0);
  const todayDistanceKm = ((Number(todayStats?.distance_m) || 0) / 1000).toFixed(
    Number(todayStats?.distance_m) >= 10000 ? 1 : 2
  );

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
          <h1 className="text-[17px] font-bold" style={{ color: ACCENT }}>
            Log Olahraga
          </h1>
          <Link
            to="/workout/insight"
            className="absolute right-0 flex size-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
            aria-label="Insight"
          >
            <span className="material-symbols-outlined">insights</span>
          </Link>
        </div>

        <div className="relative mt-3">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[22px] text-slate-400">
            search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari olahraga…"
            className="w-full rounded-2xl border-0 bg-white py-3 pl-11 pr-4 text-[14px] outline-none shadow-sm placeholder:text-slate-400"
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        {error ? (
          <p className="mb-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {error}
          </p>
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Statistik hari ini</p>
              <p className="text-[11px] text-slate-500">Workout manual + Strava</p>
            </div>
            <span className="text-[10px] font-medium tabular-nums text-slate-400">{localTodayYmd()}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 px-2 py-2">
              <p className="text-lg font-black tabular-nums text-emerald-700">{todaySessions}</p>
              <p className="text-[9px] text-slate-500">Sesi</p>
            </div>
            <div className="rounded-xl bg-sky-50 px-2 py-2">
              <p className="text-lg font-black tabular-nums text-sky-700">{todayMinutes}</p>
              <p className="text-[9px] text-slate-500">Menit</p>
            </div>
            <div className="rounded-xl bg-orange-50 px-2 py-2">
              <p className="text-lg font-black tabular-nums text-orange-700">{todayCalories}</p>
              <p className="text-[9px] text-slate-500">Kkal</p>
            </div>
            <div className="rounded-xl bg-violet-50 px-2 py-2">
              <p className="text-lg font-black tabular-nums text-violet-700">{todayDistanceKm}</p>
              <p className="text-[9px] text-slate-500">Km</p>
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { key: "scan", label: "Scan foto", icon: "photo_camera", to: "/workout/scan" },
            { key: "manual", label: "Manual", icon: "edit_note", action: "manual" },
            { key: "strava", label: "Strava", icon: "directions_run", to: "/strava" },
            { key: "list", label: "Latihan", icon: "list_alt", to: "/workout/exercises" },
          ].map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => {
                if (a.action === "manual") setManualOpen(true);
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
          <div className="mb-2 flex items-center justify-between px-0.5">
            <h2 className="text-[17px] font-bold">Dari Strava</h2>
            {stravaStatus?.connected ? (
              <button
                type="button"
                disabled={stravaBusy}
                onClick={onSyncStrava}
                className="rounded-full bg-[#fc4c02] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-60"
              >
                {stravaBusy ? "Sync…" : "Sync"}
              </button>
            ) : (
              <Link to="/strava" className="text-[12px] font-semibold text-[#fc4c02]">
                Hubungkan
              </Link>
            )}
          </div>

          {!stravaStatus?.connected ? (
            <div className="rounded-2xl bg-white px-4 py-6 text-center shadow-sm ring-1 ring-slate-100">
              <p className="text-sm font-bold text-slate-800">Strava belum terhubung</p>
              <p className="mt-1 text-[12px] text-slate-500">
                Hubungkan agar aktivitas otomatis masuk ke statistik.
              </p>
              <Link
                to="/strava"
                className="mt-3 inline-flex rounded-full bg-[#fc4c02] px-4 py-2 text-sm font-bold text-white"
              >
                Connect Strava
              </Link>
            </div>
          ) : stravaActivities.length === 0 ? (
            <p className="rounded-2xl bg-white px-3 py-6 text-center text-[12px] text-slate-400 shadow-sm">
              Belum ada aktivitas. Tekan Sync untuk menarik data.
            </p>
          ) : (
            <div className="space-y-2">
              {stravaActivities.slice(0, 5).map((a) => (
                <WorkoutRow
                  key={a.id}
                  name={a.name || a.sport_type || "Aktivitas Strava"}
                  sub={`${formatWhen(a.start_date)} · ${formatDistanceKm(a.distance_m)} · ${formatDuration(
                    a.moving_time_s || a.elapsed_time_s
                  )}`}
                  icon={String(a.sport_type || a.type || "")
                    .toLowerCase()
                    .includes("ride")
                    ? "directions_bike"
                    : String(a.sport_type || a.type || "")
                          .toLowerCase()
                          .includes("run")
                      ? "directions_run"
                      : "exercise"}
                  href={`/strava/activities/${a.id}`}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-5">
          <h2 className="mb-2 px-0.5 text-[17px] font-bold">Baru dicatat</h2>
          {loading && filteredRecent.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-slate-400">Memuat…</p>
          ) : filteredRecent.length === 0 ? (
            <p className="rounded-2xl bg-white px-3 py-6 text-center text-[12px] text-slate-400 shadow-sm">
              Belum ada log. Tambah manual, scan foto, atau sync Strava.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredRecent.slice(0, 8).map((r) => (
                <WorkoutRow
                  key={r.id}
                  name={r.activity_type}
                  sub={`${Math.round(r.calories)} kkal${r.workout_time ? ` · ${r.workout_time}` : ""}${r.distance ? ` · ${r.distance}` : ""} · ${formatWhen(r.created_at)}`}
                  busy={busyId === `r-${r.id}`}
                  onAdd={() => onAddRecent(r)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-5">
          <h2 className="mb-2 px-0.5 text-[17px] font-bold">Olahraga populer</h2>
          <div className="space-y-2">
            {catalog.map((c) => (
              <WorkoutRow
                key={c.id}
                name={c.name}
                sub={`${Math.round(c.calories)} kkal · ${c.duration_label || `${c.duration_min} menit`}`}
                icon={c.icon || "exercise"}
                busy={busyId === String(c.id)}
                onAdd={() => onAddCatalog(c)}
              />
            ))}
          </div>
        </section>
      </main>

      <WorkoutManualSheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSaved={async () => {
          try {
            const rec = await fetchWorkoutRecent();
            setRecent(rec.items || []);
          } catch {
            /* ignore */
          }
        }}
      />
    </div>
  );
}
