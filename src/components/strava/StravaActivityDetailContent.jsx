import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchStravaActivity,
  formatDistanceKm,
  formatDuration,
  formatHr,
  formatPace,
  formatSpeedKmh,
  pickPhotoUrl,
} from "../../lib/stravaApi";
import StravaRouteMap from "./StravaRouteMap";
import StravaHrChart from "./StravaHrChart";

function formatWhen(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-[15px] font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

export default function StravaActivityDetailContent() {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEnriching(true);
    fetchStravaActivity(activityId)
      .then((d) => {
        if (!cancelled) {
          setPayload(d);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setPayload(null);
          setError(e?.message || "Aktivitas tidak ditemukan.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setEnriching(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const activity = payload?.activity;
  const streams = payload?.streams || {};
  const laps = payload?.laps || [];
  const splitsMetric = payload?.splits?.metric || [];
  const photos = payload?.photos || [];
  const hasHrStream = Array.isArray(streams.heartrate) && streams.heartrate.length > 1;

  return (
    <div className="bg-surface font-['Public_Sans',sans-serif] text-on-surface h-dvh min-h-dvh overflow-hidden">
      <div className="mx-auto flex h-full max-w-md flex-col overflow-hidden bg-surface-container-lowest shadow-xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white/90 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
          <button
            type="button"
            onClick={() => navigate("/strava")}
            className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary/10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">Detail Aktivitas</h1>
            <p className="text-[11px] text-slate-500">Strava</p>
          </div>
          {activity?.id ? (
            <a
              href={`https://www.strava.com/activities/${activity.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white"
              style={{ backgroundColor: "#fc4c02" }}
            >
              Buka
            </a>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-8">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              {enriching ? "Memuat & memperkaya data…" : "Memuat…"}
            </p>
          ) : error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <Link to="/strava" className="text-sm font-semibold text-primary">
                Kembali ke Strava
              </Link>
            </div>
          ) : activity ? (
            <div className="space-y-4">
              <div>
                <span
                  className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                  style={{ backgroundColor: "#fc4c02" }}
                >
                  {activity.sport_type || activity.type || "Activity"}
                </span>
                <h2 className="mt-2 text-xl font-extrabold text-slate-900">{activity.name}</h2>
                <p className="mt-1 text-[13px] text-slate-500">{formatWhen(activity.start_date)}</p>
                {activity.location_city || activity.location_country ? (
                  <p className="mt-0.5 text-[12px] text-slate-400">
                    {[activity.location_city, activity.location_state, activity.location_country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                ) : null}
              </div>

              <StravaRouteMap activity={activity} />

              <div className="grid grid-cols-2 gap-2">
                <Metric label="Jarak" value={formatDistanceKm(activity.distance_m)} />
                <Metric label="Moving" value={formatDuration(activity.moving_time_s)} />
                <Metric label="Elapsed" value={formatDuration(activity.elapsed_time_s)} />
                <Metric
                  label="Pace"
                  value={formatPace(activity.distance_m, activity.moving_time_s)}
                />
                <Metric
                  label="Kalori"
                  value={activity.calories != null ? `${Math.round(activity.calories)} kkal` : "—"}
                />
                <Metric
                  label="Elevasi"
                  value={
                    activity.total_elevation_gain != null
                      ? `${Math.round(activity.total_elevation_gain)} m`
                      : "—"
                  }
                />
                <Metric label="Avg HR" value={formatHr(activity.average_heartrate)} />
                <Metric label="Max HR" value={formatHr(activity.max_heartrate)} />
                <Metric label="Avg speed" value={formatSpeedKmh(activity.average_speed)} />
                {activity.average_watts != null || activity.weighted_average_watts != null ? (
                  <Metric
                    label="Power"
                    value={`${Math.round(activity.weighted_average_watts || activity.average_watts)} W`}
                  />
                ) : (
                  <Metric label="Max speed" value={formatSpeedKmh(activity.max_speed)} />
                )}
              </div>

              {hasHrStream ? (
                <StravaHrChart heartrate={streams.heartrate} time={streams.time} />
              ) : enriching ? (
                <p className="text-center text-[12px] text-slate-400">Memuat stream HR…</p>
              ) : (
                <StravaHrChart heartrate={null} time={null} />
              )}

              {laps.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-[13px] font-bold text-slate-800">Laps</h3>
                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-400">
                        <tr>
                          <th className="px-2 py-2 font-semibold">#</th>
                          <th className="px-2 py-2 font-semibold">Jarak</th>
                          <th className="px-2 py-2 font-semibold">Waktu</th>
                          <th className="px-2 py-2 font-semibold">HR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {laps.map((lap) => (
                          <tr key={lap.lap_index} className="border-t border-slate-50">
                            <td className="px-2 py-2 font-semibold text-slate-700">{lap.lap_index + 1}</td>
                            <td className="px-2 py-2 text-slate-600">
                              {formatDistanceKm(lap.distance_m)}
                            </td>
                            <td className="px-2 py-2 text-slate-600">
                              {formatDuration(lap.moving_time_s || lap.elapsed_time_s)}
                            </td>
                            <td className="px-2 py-2 text-slate-600">
                              {formatHr(lap.average_heartrate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {splitsMetric.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-[13px] font-bold text-slate-800">Splits (km)</h3>
                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-400">
                        <tr>
                          <th className="px-2 py-2 font-semibold">Km</th>
                          <th className="px-2 py-2 font-semibold">Waktu</th>
                          <th className="px-2 py-2 font-semibold">Pace</th>
                          <th className="px-2 py-2 font-semibold">HR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {splitsMetric.map((s) => (
                          <tr key={s.split_index} className="border-t border-slate-50">
                            <td className="px-2 py-2 font-semibold text-slate-700">{s.split_index}</td>
                            <td className="px-2 py-2 text-slate-600">
                              {formatDuration(s.moving_time_s || s.elapsed_time_s)}
                            </td>
                            <td className="px-2 py-2 text-slate-600">
                              {formatPace(s.distance_m || 1000, s.moving_time_s || s.elapsed_time_s)}
                            </td>
                            <td className="px-2 py-2 text-slate-600">
                              {formatHr(s.average_heartrate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {photos.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-[13px] font-bold text-slate-800">Foto</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map((p) => {
                      const url = pickPhotoUrl(p.urls);
                      if (!url) return null;
                      return (
                        <a
                          key={p.id}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-xl border border-slate-100"
                        >
                          <img src={url} alt={p.caption || "Foto aktivitas"} className="h-28 w-full object-cover" />
                        </a>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <a
                href={`https://www.strava.com/activities/${activity.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
                style={{ backgroundColor: "#fc4c02" }}
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                Buka di Strava
              </a>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
