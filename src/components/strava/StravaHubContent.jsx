import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  disconnectStrava,
  fetchStravaActivities,
  fetchStravaAuthUrl,
  fetchStravaStatus,
  formatDistanceKm,
  formatDuration,
  formatHr,
  sportIcon,
  syncStrava,
} from "../../lib/stravaApi";
import { showConfirm, showError, showSuccess } from "../../lib/appAlert";

const STRAVA = "#fc4c02";

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

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return localYmd(dt);
}

function activityYmd(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return localYmd(d);
  } catch {
    return String(iso).slice(0, 10);
  }
}

export default function StravaHubContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  const currentPath = location.pathname;
  const isNavActive = (path) => currentPath === path || currentPath.startsWith(`${path}/`);
  const navItemClass = (path) =>
    `flex flex-col items-center gap-1 ${isNavActive(path) ? "text-primary" : "text-slate-400"}`;
  const navLabelClass = (path) =>
    `text-[10px] ${isNavActive(path) ? "font-bold" : "font-medium"}`;

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const st = await fetchStravaStatus();
      setStatus(st);
      if (st.connected) {
        const { activities: list } = await fetchStravaActivities({ limit: 50 });
        setActivities(list || []);
      } else {
        setActivities([]);
      }
    } catch (e) {
      setError(e?.message || "Gagal memuat status Strava.");
      setStatus(null);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setBanner("Strava berhasil terhubung. Aktivitas sedang disinkronkan.");
      const next = new URLSearchParams(searchParams);
      next.delete("connected");
      setSearchParams(next, { replace: true });
      reload();
    }
    const err = searchParams.get("error");
    if (err) {
      setError(decodeURIComponent(err));
      const next = new URLSearchParams(searchParams);
      next.delete("error");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, reload]);

  const weekSummary = useMemo(() => {
    const today = localYmd();
    const from = addDaysYmd(today, -6);
    let count = 0;
    let distance = 0;
    let moving = 0;
    for (const a of activities) {
      const ymd = activityYmd(a.start_date);
      if (ymd < from || ymd > today) continue;
      count += 1;
      distance += Number(a.distance_m) || 0;
      moving += Number(a.moving_time_s) || 0;
    }
    return { count, distance, moving };
  }, [activities]);

  const onConnect = async () => {
    setBusy(true);
    setError("");
    try {
      const { url } = await fetchStravaAuthUrl();
      window.location.href = url;
    } catch (e) {
      setError(e?.message || "Gagal memulai Connect Strava.");
      showError("Gagal Connect Strava", e?.message || "");
      setBusy(false);
    }
  };

  const onSync = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await syncStrava();
      const msg = `Sync selesai — ${r.imported ?? 0} diimpor, ${r.enriched ?? 0} detail diperkaya.`;
      setBanner(msg);
      showSuccess("Sync selesai", msg);
      await reload();
    } catch (e) {
      setError(e?.message || "Gagal sync.");
      showError("Gagal sync Strava", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    const ok = await showConfirm(
      "Putuskan koneksi Strava?",
      "Riwayat aktivitas yang sudah tersimpan tetap ada.",
      "Ya, putuskan"
    );
    if (!ok) return;
    setBusy(true);
    try {
      await disconnectStrava();
      setBanner("Koneksi Strava diputus.");
      showSuccess("Koneksi diputus", "Koneksi Strava berhasil diputus.");
      await reload();
    } catch (e) {
      setError(e?.message || "Gagal disconnect.");
      showError("Gagal disconnect", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const athleteName = status?.athlete
    ? [status.athlete.firstname, status.athlete.lastname].filter(Boolean).join(" ")
    : "";

  return (
    <div className="bg-surface font-['Public_Sans',sans-serif] text-on-surface h-dvh min-h-dvh overflow-hidden">
      <div className="mx-auto flex h-full max-w-md flex-col overflow-hidden bg-surface-container-lowest shadow-xl">
        <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white/90 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary/10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">Strava</h1>
            <p className="truncate text-[11px] text-slate-500">Sinkron aktivitas olahraga</p>
          </div>
          {status?.connected ? (
            <button
              type="button"
              disabled={busy}
              onClick={onSync}
              className="rounded-xl px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: STRAVA }}
            >
              {busy ? "…" : "Sync"}
            </button>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-28">
          {banner ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
              {banner}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Memuat…</p>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {status?.athlete?.profile_url ? (
                    <img
                      src={status.athlete.profile_url}
                      alt=""
                      className="size-12 rounded-full object-cover ring-2 ring-orange-100"
                    />
                  ) : (
                    <div
                      className="flex size-12 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: STRAVA }}
                    >
                      <span className="material-symbols-outlined">directions_run</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      {status?.connected ? athleteName || "Terhubung" : "Belum terhubung"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {!status?.configured
                        ? "Server belum set STRAVA_CLIENT_ID"
                        : status?.connected
                          ? `Last sync: ${
                              status.last_synced_at
                                ? new Date(status.last_synced_at).toLocaleString("id-ID")
                                : "—"
                            }`
                          : "Hubungkan akun Strava untuk tarik aktivitas"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!status?.connected ? (
                    <button
                      type="button"
                      disabled={busy || !status?.configured}
                      onClick={onConnect}
                      className="rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      style={{ backgroundColor: STRAVA }}
                    >
                      Connect Strava
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onDisconnect}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                    >
                      Disconnect
                    </button>
                  )}
                  <Link
                    to="/workout/insight"
                    className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary"
                  >
                    Insight olahraga
                  </Link>
                </div>
              </section>

              {status?.connected && activities.length > 0 ? (
                <section className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-primary/5 px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Minggu</p>
                    <p className="mt-0.5 text-lg font-extrabold text-primary">{weekSummary.count}</p>
                    <p className="text-[10px] text-slate-400">sesi</p>
                  </div>
                  <div className="rounded-2xl bg-primary/5 px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Jarak</p>
                    <p className="mt-0.5 text-lg font-extrabold text-primary">
                      {(weekSummary.distance / 1000).toFixed(1)}
                    </p>
                    <p className="text-[10px] text-slate-400">km</p>
                  </div>
                  <div className="rounded-2xl bg-primary/5 px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Waktu</p>
                    <p className="mt-0.5 text-lg font-extrabold text-primary">
                      {Math.round(weekSummary.moving / 60)}
                    </p>
                    <p className="text-[10px] text-slate-400">menit</p>
                  </div>
                </section>
              ) : null}

              <section>
                <h2 className="mb-2 text-[15px] font-bold text-slate-900">Aktivitas</h2>
                {!status?.connected ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
                    <p className="text-sm text-slate-500">Connect Strava dulu untuk melihat aktivitas.</p>
                  </div>
                ) : activities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
                    <p className="text-sm text-slate-500">Belum ada aktivitas. Tekan Sync.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activities.map((a) => (
                      <Link
                        key={a.id}
                        to={`/strava/activities/${a.id}`}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm active:scale-[0.99]"
                      >
                        <div
                          className="flex size-11 items-center justify-center rounded-xl text-white"
                          style={{ backgroundColor: `${STRAVA}18`, color: STRAVA }}
                        >
                          <span className="material-symbols-outlined text-[22px]" style={{ color: STRAVA }}>
                            {sportIcon(a.sport_type || a.type)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">{a.name || "Aktivitas"}</p>
                          <p className="text-[11px] text-slate-500">
                            {a.sport_type || a.type} · {formatWhen(a.start_date)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {formatDistanceKm(a.distance_m)} · {formatDuration(a.moving_time_s)}
                            {a.calories != null ? ` · ${Math.round(a.calories)} kkal` : ""}
                            {a.average_heartrate != null ? ` · ${formatHr(a.average_heartrate)}` : ""}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-md items-center justify-between border-t border-slate-100 bg-white px-6 py-3">
          <Link to="/home" className={navItemClass("/home")}>
            <span className="material-symbols-outlined">grid_view</span>
            <span className={navLabelClass("/home")}>Dashboard</span>
          </Link>
          <Link className={navItemClass("/nutrition/insight")} to="/nutrition/insight">
            <span className="material-symbols-outlined">restaurant</span>
            <span className={navLabelClass("/nutrition/insight")}>Makanan</span>
          </Link>
          <div className="relative -top-8">
            <Link
              to="/activity/capture"
              className="flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30"
            >
              <span className="material-symbols-outlined text-3xl">add</span>
            </Link>
          </div>
          <Link className={navItemClass("/workout/insight")} to="/workout/insight">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' 1` }}
            >
              exercise
            </span>
            <span className={navLabelClass("/workout/insight")}>Olahraga</span>
          </Link>
          <Link className={navItemClass("/profile")} to="/profile">
            <span className="material-symbols-outlined">person</span>
            <span className={navLabelClass("/profile")}>Profil</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
