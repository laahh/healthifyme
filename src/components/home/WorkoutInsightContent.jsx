import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getSessionUser } from "../../auth/auth";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";

function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FALLBACK_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCNeGKVRJgIPImTURVGAslzSS3ZGPZ1xwjwxmvnBO6MgCf_BcNjV1Jb4dQVUUhe2eezIrwoSJlx8y4bf3tE4mzYZ7Ob5GUGFekJ8dYQKoLn6pO04wFbneUeuijPEKJvnZIoJGeL-M2ktUWVwsSZJVp0p6H9hEYTuSXFd30ToMP9i6HpnGMb3hPgU95cjKY1BqdQXKMKQz7xSUcpPh5dxD-VMYhec9PJLins0xpetqOgFxP2RK1LxYvs18mJOZUQXWm9j8hAZlhXO0Q";

export default function WorkoutInsightContent() {
  const location = useLocation();
  const currentPath = location.pathname;
  const isNavActive = (path) => currentPath === path;
  const navItemClass = (path) =>
    `flex flex-col items-center gap-1 ${isNavActive(path) ? "text-primary" : "text-slate-400"}`;
  const navLabelClass = (path) => `text-[10px] ${isNavActive(path) ? "font-bold" : "font-medium"}`;
  const sessionUser = getSessionUser();
  const greetingName = sessionUser?.name?.trim().split(/\s+/)[0] || "Pengguna";
  const avatarPhoto = sessionUser?.photo || FALLBACK_AVATAR;

  const [exercises, setExercises] = useState([]);
  const [exercisesLoading, setExercisesLoading] = useState(() => isApiBackendEnabled());
  const [exercisesError, setExercisesError] = useState("");
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(() => isApiBackendEnabled());
  const [weeklyError, setWeeklyError] = useState("");

  useEffect(() => {
    if (!isApiBackendEnabled()) {
      setExercisesLoading(false);
      setExercisesError("Hubungkan app ke API (VITE_API_URL) dan pastikan tabel latihan sudah dimigrasi.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/exercises?limit=12&offset=0");
        if (cancelled) return;
        setExercises(Array.isArray(data?.exercises) ? data.exercises : []);
        setExercisesError("");
      } catch (e) {
        if (!cancelled) {
          setExercisesError(e instanceof Error ? e.message : "Gagal memuat latihan.");
        }
      } finally {
        if (!cancelled) setExercisesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        const date = localTodayYmd();
        const data = await apiRequest(`/me/workouts/weekly-summary?date=${encodeURIComponent(date)}`);
        if (!cancelled) {
          setWeeklySummary(data);
        }
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
  }, []);

  const chartPoints = useMemo(() => {
    const days = weeklySummary?.days;
    if (!Array.isArray(days) || days.length !== 7) return [];
    const maxDur = Math.max(1, ...days.map((d) => Number(d.duration_min) || 0));
    return days.map((d, i) => {
      const dur = Number(d.duration_min) || 0;
      const x = (i / 6) * 310;
      const y = 76 - (dur / maxDur) * 48;
      const yClamped = Math.max(28, Math.min(76, y));
      return {
        ...d,
        x,
        y: dur === 0 ? 76 : yClamped,
      };
    });
  }, [weeklySummary]);

  const performancePath = useMemo(() => chartPoints.map((p) => `${p.x},${p.y}`).join(" "), [chartPoints]);

  const highlightPoint = useMemo(() => {
    if (!chartPoints.length) return null;
    const today = localTodayYmd();
    const onToday = chartPoints.find((p) => p.date === today);
    if (onToday) return onToday;
    let best = chartPoints[0];
    for (const p of chartPoints) {
      if ((p.duration_min || 0) > (best.duration_min || 0)) best = p;
    }
    return best;
  }, [chartPoints]);

  const weekRangeLabel = weeklySummary
    ? `${weeklySummary.week_start} – ${weeklySummary.week_end}`
    : "";
  const totalKcal = weeklySummary?.totals?.calories_kcal ?? 0;
  const avgBpm = weeklySummary?.avg_heart_rate_week;
  const avgMinDay = weeklySummary?.avg_minutes_per_day ?? 0;

  const todayWorkout = useMemo(() => {
    const today = localTodayYmd();
    return weeklySummary?.days?.find((d) => d.date === today) ?? null;
  }, [weeklySummary]);

  const todayMinutes = Math.round(Number(todayWorkout?.duration_min) || 0);
  const todayHasActivity = todayMinutes > 0 || (Number(todayWorkout?.calories_kcal) || 0) > 0;

  const todayDetailItems = useMemo(() => {
    const weekSess = weeklySummary?.totals?.sessions ?? 0;
    const kcal = Math.round(Number(todayWorkout?.calories_kcal) || 0);
    const maxHr = todayWorkout?.max_heart_rate;
    const avgHr = todayWorkout?.avg_heart_rate;
    return [
      {
        label: "Total Kalori",
        value: kcal,
        pct: Math.min(100, Math.round((kcal / 600) * 100)),
        color: "bg-blue-500",
      },
      {
        label: "Maks Denyut Nadi",
        value: maxHr != null ? maxHr : "—",
        pct: maxHr != null ? Math.min(100, Math.round((maxHr / 200) * 100)) : 0,
        color: "bg-violet-500",
      },
      {
        label: "Freq dalam minggu",
        value: weekSess,
        pct: Math.min(100, Math.round((weekSess / 10) * 100)),
        color: "bg-amber-500",
      },
      {
        label: "Rata-rata Denyut Nadi",
        value: avgHr != null ? avgHr : "—",
        pct: avgHr != null ? Math.min(100, Math.round((avgHr / 200) * 100)) : 0,
        color: "bg-emerald-500",
      },
    ];
  }, [weeklySummary, todayWorkout]);

  return (
    <div className="font-['Public_Sans'] bg-background-light text-slate-900 min-h-screen dark:bg-background-dark dark:text-slate-100">
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto">
        <div className="flex items-center bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 justify-between">
          <Link to="/home" className="flex size-12 shrink-0 items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">arrow_back</span>
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Workout Insight</h2>
          <div className="flex w-12 items-center justify-end">
            <button className="flex items-center justify-center rounded-xl h-10 w-10 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">share</span>
            </button>
          </div>
        </div>

        <div className="flex p-6">
          <div className="flex w-full flex-col gap-6 items-center">
            <div className="flex gap-4 flex-col items-center">
              <div className="relative">
                <div className="aspect-square rounded-full min-h-32 w-32 border-4 border-primary shadow-lg overflow-hidden bg-slate-100">
                  <img src={avatarPhoto} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-primary text-white rounded-full p-2 border-2 border-white">
                  <span className="material-symbols-outlined text-sm">emoji_events</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <p className="text-[24px] font-bold leading-tight tracking-tight text-center">Keren, {greetingName}!</p>
                <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-normal text-center mt-1">
                  {weeklyLoading
                    ? "Memuat data minggu ini…"
                    : weeklySummary?.totals?.sessions
                      ? `${weeklySummary.totals.sessions} sesi olahraga tercatat minggu ini (Senin–Minggu).`
                      : "Belum ada sesi olahraga di minggu ini. Upload hasil latihan untuk melihat ringkasan."}
                </p>
                <div className="flex flex-wrap gap-3 mt-3 items-center justify-center">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 tabular-nums">
                    <span className="material-symbols-outlined text-base">local_fire_department</span>
                    {weeklyLoading ? "…" : `${Math.round(Number(totalKcal) || 0)} kkal`}
                  </span>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 tabular-nums">
                    <span className="material-symbols-outlined text-base">favorite</span>
                    {weeklyLoading ? "…" : avgBpm != null ? `${avgBpm} avg BPM` : "BPM —"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">Olahragamu</h3>
            <span className="text-primary text-sm font-semibold cursor-pointer">View All</span>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Ringkasan Olahraga Mingguan</h3>
              {/* <span className="text-[10px] text-slate-400 font-medium tabular-nums">{weekRangeLabel}</span> */}
            </div>
            {weeklyError && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{weeklyError}</p>
            )}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              {weeklyLoading ? (
                <div className="h-24 flex items-center justify-center text-sm text-slate-500">Memuat grafik…</div>
              ) : !isApiBackendEnabled() ? (
                <div className="h-24 flex items-center justify-center text-xs text-slate-500 text-center px-2">
                  Set VITE_API_URL untuk ringkasan dari database.
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 310 88" className="w-full h-24">
                    <defs>
                      <linearGradient id="workoutLine" x1="0%" x2="100%" y1="0%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="50%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <polyline fill="none" stroke="#e5e7eb" strokeWidth="1.5" points="0,76 310,76" />
                    {chartPoints.length > 0 && (
                      <polyline
                        fill="none"
                        stroke="url(#workoutLine)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={performancePath}
                      />
                    )}
                    {highlightPoint && (
                      <circle cx={highlightPoint.x} cy={highlightPoint.y} r="4.5" fill="#111827" className="dark:fill-white" />
                    )}
                  </svg>
                  <div className="grid grid-cols-7 text-[10px] text-slate-400 mt-1 gap-0.5">
                    {chartPoints.map((point) => (
                      <span key={point.date} className="text-center truncate" title={`${point.date}: ${point.duration_min} menit`}>
                        {point.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-bold leading-none tabular-nums">
                  {weeklyLoading ? "…" : avgMinDay}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Menit/hari (rata-rata, 7 hari)</p>
              </div>
              <Link
                to="/activity/capture"
                className="h-9 px-4 rounded-full bg-black text-white text-sm font-semibold inline-flex items-center justify-center dark:bg-white dark:text-black"
              >
                Goal
              </Link>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Sumber: workout_analyses • Minggu Senin–Minggu (WIB sesuai server)
            </p>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Ringkasan Olahraga Hari ini</h3>
              <span className="text-[10px] text-slate-400 font-medium tabular-nums">{localTodayYmd()}</span>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`size-11 rounded-full border-2 flex items-center justify-center ${
                      todayHasActivity ? "border-emerald-200 text-emerald-500" : "border-slate-200 text-slate-400"
                    }`}
                  >
                    <span className="material-symbols-outlined">
                      {todayHasActivity ? "check" : "fitness_center"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums">
                      {weeklyLoading ? "…" : `${todayMinutes} Menit`}
                    </p>
                    <p className="text-[11px] text-slate-500">Hari ini (workout_analyses)</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="size-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"
                    aria-label="Notifikasi"
                  >
                    <span className="material-symbols-outlined text-[16px]">notifications</span>
                  </button>
                  <Link
                    to="/activity/capture"
                    className="size-7 rounded-full bg-emerald-600 text-white flex items-center justify-center"
                    aria-label="Tambah goal"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </Link>
                </div>
              </div>
              {!isApiBackendEnabled() ? (
                <p className="mt-3 text-[10px] text-slate-500">Set VITE_API_URL untuk data harian dari database.</p>
              ) : weeklyError ? (
                <p className="mt-3 text-[10px] text-amber-600 dark:text-amber-400">{weeklyError}</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold">
                  {todayDetailItems.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between mb-1 gap-1">
                        <span className="leading-tight">
                          {item.label}: {item.value}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`${item.color} h-full`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">Pelatihan otot</h3>
            <Link to="/workout/exercises" className="text-primary text-sm font-semibold">
              Lihat semua
            </Link>
          </div>
          {exercisesLoading && (
            <p className="text-sm text-slate-500 px-1 py-2">Memuat daftar latihan…</p>
          )}
          {!exercisesLoading && exercisesError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {exercisesError}
            </div>
          )}
          {!exercisesLoading && !exercisesError && exercises.length === 0 && (
            <p className="text-sm text-slate-500 px-1">Belum ada data latihan di database.</p>
          )}
          {!exercisesLoading && !exercisesError && exercises.length > 0 && (
            <div className="flex flex-col gap-2">
              {exercises.map((ex) => (
                <Link
                  key={ex.id}
                  to={`/workout/exercise/${ex.id}`}
                  className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 active:opacity-95"
                >
                  <div className="min-w-0 flex-1 flex flex-col gap-2">
                    <p className="text-slate-900 dark:text-slate-100 text-sm font-bold leading-snug">{ex.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {(ex.targetMuscles || []).slice(0, 3).map((m) => (
                        <span
                          key={`${ex.id}-tm-${m.id}`}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                        >
                          {m.name}
                        </span>
                      ))}
                      {(ex.bodyParts || []).slice(0, 2).map((p) => (
                        <span
                          key={`${ex.id}-bp-${p.id}`}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                    <span className="text-primary text-xs font-semibold inline-flex items-center gap-0.5 w-fit">
                      Detail & langkah
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </span>
                  </div>
                  {ex.gifUrl ? (
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700">
                      <img src={ex.gifUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-2xl">fitness_center</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-4">
          <h3 className="text-lg font-bold leading-tight tracking-[-0.015em] mb-3 px-1">Rekomendasi</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-600">water_drop</span>
              </div>
              <p className="font-bold text-sm">Hydration</p>
              <p className="text-xs text-slate-500">Minum 500ml air + elektrolit setelah sesi intensitas tinggi.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-600">self_improvement</span>
              </div>
              <p className="font-bold text-sm">Stretching</p>
              <p className="text-xs text-slate-500">10 menit lower-body stretching untuk mencegah pegal berlebih.</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 mb-24">
          {/* <h3 className="text-lg font-bold leading-tight tracking-[-0.015em] mb-3 px-1">Next Session Suggestion</h3> */}
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-primary rounded-xl p-3 text-white">
              <span className="material-symbols-outlined">directions_walk</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-900 dark:text-slate-100">Jalan Santai</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Jalan santai 20 menit untuk menjaga mobilitas sendi.</p>
            </div>
            <button className="bg-white dark:bg-slate-800 p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="material-symbols-outlined text-primary">add</span>
            </button>
          </div>
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
