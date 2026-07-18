import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSessionUser, logout } from "../../auth/auth";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";
import {
  fetchStravaStatus,
  formatDistanceKm,
  formatHr,
  formatPace,
  formatSpeedKmh,
  sportIcon,
} from "../../lib/stravaApi";
import {
  LOOKBACK_DAYS,
  addDaysYmd,
  formatInsightDateLabel,
  localTodayYmd,
  resolveWorkoutStoryFromDaily,
  DEFAULT_DURATION_TARGET_MIN,
  defaultWorkoutTargets,
} from "../../lib/workoutStoryFallback";
import WorkoutHealthStatusCard from "../workout/WorkoutHealthStatusCard";
import WorkoutDayAnalysisCharts from "../workout/WorkoutDayAnalysisCharts";
import { showToast } from "../../lib/appAlert";

function formatSessionTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function WorkoutInsightContent() {
  const location = useLocation();
  const currentPath = location.pathname;
  const isNavActive = (path) => currentPath === path;
  const navItemClass = (path) =>
    `flex flex-col items-center gap-1 ${isNavActive(path) ? "text-primary" : "text-slate-400"}`;
  const navLabelClass = (path) =>
    `text-[10px] ${isNavActive(path) ? "font-bold" : "font-medium"}`;

  const sessionUser = getSessionUser();
  const myUserId = sessionUser?.id != null ? String(sessionUser.id) : "";

  const todayYmd = localTodayYmd();
  const minYmd = addDaysYmd(todayYmd, -LOOKBACK_DAYS);
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const dateInputRef = useRef(null);

  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(() => isApiBackendEnabled());
  const [weeklyError, setWeeklyError] = useState("");
  const [dailySummary, setDailySummary] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(() => isApiBackendEnabled());
  const [dailyError, setDailyError] = useState("");
  const [stravaStatus, setStravaStatus] = useState(null);
  const [stravaLoading, setStravaLoading] = useState(() => isApiBackendEnabled());
  const [verifiedUserId, setVerifiedUserId] = useState("");

  const isToday = selectedDate === todayYmd;
  const canGoNext = selectedDate < todayYmd;
  const canGoPrev = selectedDate > minYmd;
  const dateLabel = formatInsightDateLabel(selectedDate, todayYmd);

  const goPrev = () => {
    if (!canGoPrev) {
      showToast("Maksimal 90 hari ke belakang", "info");
      return;
    }
    setSelectedDate((d) => addDaysYmd(d, -1));
  };
  const goNext = () => {
    if (!canGoNext) return;
    setSelectedDate((d) => addDaysYmd(d, 1));
  };

  useEffect(() => {
    if (!isApiBackendEnabled() || !myUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/auth/me");
        if (cancelled) return;
        const apiUserId = data?.user?.id != null ? String(data.user.id) : "";
        if (!apiUserId || apiUserId !== myUserId) {
          logout();
          window.location.replace("/login");
          return;
        }
        setVerifiedUserId(apiUserId);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Gagal memverifikasi sesi.";
        setWeeklyLoading(false);
        setDailyLoading(false);
        setStravaLoading(false);
        setWeeklyError(message);
        setDailyError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUserId]);

  useEffect(() => {
    if (!isApiBackendEnabled() || !verifiedUserId) {
      if (!isApiBackendEnabled()) {
        setWeeklyLoading(false);
        setWeeklySummary(null);
        setWeeklyError("");
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setWeeklyLoading(true);
      setWeeklyError("");
      try {
        const data = await apiRequest(
          `/me/workouts/weekly-summary?date=${encodeURIComponent(selectedDate)}`
        );
        if (!cancelled) setWeeklySummary(data);
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
  }, [selectedDate, verifiedUserId]);

  useEffect(() => {
    if (!isApiBackendEnabled() || !verifiedUserId) {
      if (!isApiBackendEnabled()) {
        setDailyLoading(false);
        setDailySummary(null);
        setDailyError("");
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setDailyLoading(true);
      setDailyError("");
      try {
        const data = await apiRequest(
          `/me/workouts/daily-summary?date=${encodeURIComponent(selectedDate)}`
        );
        if (!cancelled) setDailySummary(data);
      } catch (e) {
        if (!cancelled) {
          setDailySummary(null);
          setDailyError(e instanceof Error ? e.message : "Gagal memuat data olahraga.");
        }
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, verifiedUserId]);

  useEffect(() => {
    if (!isApiBackendEnabled() || !verifiedUserId) {
      if (!isApiBackendEnabled()) {
        setStravaLoading(false);
        setStravaStatus(null);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setStravaLoading(true);
      try {
        const status = await fetchStravaStatus();
        if (!cancelled) setStravaStatus(status);
      } catch {
        if (!cancelled) setStravaStatus(null);
      } finally {
        if (!cancelled) setStravaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verifiedUserId]);

  const story = useMemo(
    () => resolveWorkoutStoryFromDaily(dailySummary, { isToday }),
    [dailySummary, isToday]
  );

  const targets = story?.targets || dailySummary?.targets || defaultWorkoutTargets();

  const durationTarget =
    Number(weeklySummary?.daily_target_duration_min) > 0
      ? Number(weeklySummary.daily_target_duration_min)
      : Number(targets.duration_min) || DEFAULT_DURATION_TARGET_MIN;

  const weeklySessionsTarget =
    Number(weeklySummary?.weekly_target_sessions) > 0
      ? Number(weeklySummary.weekly_target_sessions)
      : Number(targets.sessions_per_week) || 3;

  const dayTotals = dailySummary?.totals || {
    duration_min: 0,
    calories_kcal: 0,
    sessions: 0,
    strava_sessions: 0,
    manual_sessions: 0,
    distance_m: 0,
    avg_heart_rate: null,
    max_heart_rate: null,
  };

  const durationProgressPct = Math.max(
    0,
    Math.round((Number(dayTotals.duration_min) || 0) / Math.max(1, durationTarget) * 100)
  );

  const weeklyChartPoints = useMemo(() => {
    const days = Array.isArray(weeklySummary?.days) ? weeklySummary.days : [];
    const n = days.length || 7;
    const padX = 18;
    const width = 310;
    const top = 18;
    const bottom = 92;
    const chartH = bottom - top;
    const maxDur = Math.max(
      1,
      ...days.map((d) => Number(d.duration_min) || 0),
      durationTarget
    );
    return days.map((d, i) => {
      const dur = Number(d.duration_min) || 0;
      const x = n <= 1 ? width / 2 : padX + (i / (n - 1)) * (width - padX * 2);
      const y = bottom - (dur / maxDur) * chartH;
      return {
        ...d,
        duration_min: dur,
        x,
        y,
        underTarget: dur > 0 && dur < durationTarget,
        isSelected: d.date === selectedDate,
        maxDur,
      };
    });
  }, [weeklySummary, durationTarget, selectedDate]);

  const weeklyTrendPaths = useMemo(() => {
    if (!weeklyChartPoints.length) {
      return { line: "", area: "", targetY: 92 };
    }
    const maxDur = weeklyChartPoints[0]?.maxDur || durationTarget || 1;
    const top = 18;
    const bottom = 92;
    const chartH = bottom - top;
    const targetY = bottom - (durationTarget / maxDur) * chartH;
    const line = weeklyChartPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const first = weeklyChartPoints[0];
    const last = weeklyChartPoints[weeklyChartPoints.length - 1];
    const area = `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
    return { line, area, targetY };
  }, [weeklyChartPoints, durationTarget]);

  const sessionItems = Array.isArray(dailySummary?.items) ? dailySummary.items : [];
  const weekSessions = Number(weeklySummary?.totals?.sessions) || 0;
  const stravaConnected = Boolean(stravaStatus?.connected);
  const stravaConfigured = Boolean(stravaStatus?.configured);

  return (
    <div className="font-['Public_Sans'] bg-background-light text-slate-900 min-h-screen dark:bg-background-dark dark:text-slate-100">
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto">
        <div className="flex items-center bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 justify-between">
          <Link to="/home" className="flex size-12 shrink-0 items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
              arrow_back
            </span>
          </Link>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            Workout Insight
          </h2>
          <div className="flex w-12 items-center justify-end">
            <Link
              to="/mcu"
              className="flex items-center justify-center rounded-xl h-10 w-10 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="MCU"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
                medical_information
              </span>
            </Link>
          </div>
        </div>

        {/* Date navigator */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-2 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-50 disabled:opacity-30"
              aria-label="Hari sebelumnya"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
              className="min-w-0 flex-1 text-center"
            >
              <p className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
                {dateLabel}
              </p>
              <p className="text-[10px] font-medium text-slate-400">{selectedDate}</p>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="sr-only"
              min={minYmd}
              max={todayYmd}
              value={selectedDate}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                if (v < minYmd) {
                  showToast("Maksimal 90 hari ke belakang", "info");
                  setSelectedDate(minYmd);
                  return;
                }
                if (v > todayYmd) {
                  setSelectedDate(todayYmd);
                  return;
                }
                setSelectedDate(v);
              }}
            />
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-50 disabled:opacity-30"
              aria-label="Hari berikutnya"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          {dailyLoading && isApiBackendEnabled() ? (
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ) : (
            <WorkoutHealthStatusCard story={story} dateLabel={dateLabel} />
          )}
          {dailyError ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{dailyError}</p>
          ) : null}
        </div>

        {/* Day duration ring */}
        <div className="px-4 py-2">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Durasi · {dateLabel}
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">
                Target {durationTarget} menit
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex items-center gap-3">
                <div className="relative size-[72px] shrink-0">
                  <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200 dark:text-slate-600"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray="100, 100"
                      strokeWidth="3"
                    />
                    <path
                      className={
                        durationProgressPct >= 100 ? "text-emerald-500" : "text-primary"
                      }
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray={`${Math.min(durationProgressPct, 100)}, 100`}
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[26px]">
                      exercise
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-slate-100">
                    {Math.round((Number(dayTotals.duration_min) || 0) * 10) / 10}
                    <span className="text-sm font-semibold text-slate-400"> mnt</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {Number(dayTotals.sessions) || 0} sesi ·{" "}
                    {Math.round(Number(dayTotals.calories_kcal) || 0)} kkal
                    {Number(dayTotals.distance_m) > 0
                      ? ` · ${formatDistanceKm(dayTotals.distance_m)}`
                      : ""}
                    {dayTotals.avg_heart_rate != null
                      ? ` · HR ${formatHr(dayTotals.avg_heart_rate)}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly trend */}
        <div className="px-4 py-2">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">
                Tren durasi minggu
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Ketuk titik untuk lihat hari tersebut
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tabular-nums text-slate-600">
              Target {durationTarget} mnt
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {weeklyError && (
              <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">{weeklyError}</p>
            )}
            {weeklyLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-500">
                Memuat grafik…
              </div>
            ) : !isApiBackendEnabled() ? (
              <div className="flex h-40 items-center justify-center px-2 text-center text-xs text-slate-500">
                Set VITE_API_URL untuk ringkasan olahraga dari database.
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white px-1 pt-2 dark:from-slate-800/40 dark:to-slate-900">
                  <svg
                    viewBox="0 0 310 110"
                    className="w-full"
                    role="img"
                    aria-label="Tren durasi mingguan"
                  >
                    <defs>
                      <linearGradient id="workoutTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="workoutTrendStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#006a3f" />
                      </linearGradient>
                    </defs>
                    <line x1="12" y1="92" x2="298" y2="92" stroke="#e2e8f0" strokeWidth="1.5" />
                    <line
                      x1="12"
                      y1={weeklyTrendPaths.targetY}
                      x2="268"
                      y2={weeklyTrendPaths.targetY}
                      stroke="#006a3f"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      opacity="0.55"
                    />
                    <rect
                      x="270"
                      y={weeklyTrendPaths.targetY - 8}
                      width="36"
                      height="14"
                      rx="4"
                      fill="#ecfdf5"
                      stroke="#a7f3d0"
                    />
                    <text
                      x="288"
                      y={weeklyTrendPaths.targetY + 2}
                      textAnchor="middle"
                      className="fill-[#006a3f]"
                      style={{ fontSize: 8, fontWeight: 700 }}
                    >
                      {durationTarget}m
                    </text>
                    {weeklyTrendPaths.area ? (
                      <path d={weeklyTrendPaths.area} fill="url(#workoutTrendFill)" />
                    ) : null}
                    {weeklyTrendPaths.line ? (
                      <path
                        d={weeklyTrendPaths.line}
                        fill="none"
                        stroke="url(#workoutTrendStroke)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : null}
                    {weeklyChartPoints.map((p) => (
                      <g key={p.date || p.index}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={p.isSelected ? 7 : 5}
                          fill={p.isSelected ? "#006a3f" : "#fff"}
                          stroke={p.isSelected ? "#006a3f" : "#10b981"}
                          strokeWidth="2"
                          className="cursor-pointer"
                          onClick={() => {
                            if (p.date) setSelectedDate(p.date);
                          }}
                        />
                        <text
                          x={p.x}
                          y="106"
                          textAnchor="middle"
                          className={p.isSelected ? "fill-primary" : "fill-slate-400"}
                          style={{ fontSize: 9, fontWeight: p.isSelected ? 700 : 500 }}
                        >
                          {(p.label || "").slice(0, 3)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>
                    Rata {Number(weeklySummary?.avg_minutes_per_day) || 0} mnt/hari
                    {weeklySummary?.avg_heart_rate_week != null
                      ? ` · HR ${formatHr(weeklySummary.avg_heart_rate_week)}`
                      : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {weekSessions}/{weeklySessionsTarget} sesi minggu
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="px-4 py-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {dailyLoading ? (
              <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <WorkoutDayAnalysisCharts
                totals={dayTotals}
                targets={{ duration_min: durationTarget }}
                story={story}
                dateLabel={dateLabel}
              />
            )}
          </div>
        </div>

        {/* Session list */}
        <div className="px-4 py-2">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">
              Sesi · {dateLabel}
            </h3>
            <Link
              to="/workout/manual"
              className="text-[11px] font-bold text-primary"
            >
              + Log
            </Link>
          </div>
          <div className="space-y-2">
            {dailyLoading ? (
              <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ) : sessionItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-600">Belum ada sesi</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Catat olahraga atau sync Strava untuk tanggal ini.
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <Link
                    to="/workout/manual"
                    className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    Log olahraga
                  </Link>
                  <Link
                    to="/activity/capture"
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600"
                  >
                    Scan
                  </Link>
                </div>
              </div>
            ) : (
              sessionItems.map((it) => {
                const href = it.href || null;
                const isStrava = it.source === "strava";
                const distM = Number(it.distance_m) || 0;
                const movingS = Math.round((Number(it.duration_min) || 0) * 60);
                const metaBits = [
                  isStrava ? "Strava" : "Manual",
                  formatSessionTime(it.start_at) || null,
                  Number(it.duration_min) > 0
                    ? `${Math.round(Number(it.duration_min) * 10) / 10} mnt`
                    : null,
                  Number(it.calories_kcal) > 0
                    ? `${Math.round(Number(it.calories_kcal))} kkal`
                    : null,
                ].filter(Boolean);
                const richBits = [
                  distM > 0 ? formatDistanceKm(distM) : null,
                  it.avg_heart_rate != null ? formatHr(it.avg_heart_rate) : null,
                  isStrava && distM > 50 && movingS > 0
                    ? formatPace(distM, movingS)
                    : null,
                  isStrava && it.average_speed != null
                    ? formatSpeedKmh(it.average_speed)
                    : null,
                  isStrava && it.total_elevation_gain != null
                    ? `↑${Math.round(Number(it.total_elevation_gain))} m`
                    : null,
                ].filter(Boolean);
                const inner = (
                  <>
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                        isStrava
                          ? "bg-orange-50 text-[#fc4c02]"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {isStrava
                          ? sportIcon(it.sport_type || it.name)
                          : "fitness_center"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {it.name || "Olahraga"}
                      </p>
                      <p className="text-[11px] text-slate-500">{metaBits.join(" · ")}</p>
                      {richBits.length > 0 ? (
                        <p className="mt-0.5 text-[11px] text-slate-400">{richBits.join(" · ")}</p>
                      ) : null}
                    </div>
                    <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                  </>
                );
                return href ? (
                  <Link
                    key={`${it.source}-${it.id}`}
                    to={href}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={`${it.source}-${it.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Strava strip */}
        <div className="px-4 py-2 mb-24">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Strava</h3>
              <Link to="/strava" className="text-[11px] font-bold text-[#fc4c02]">
                Hub
              </Link>
            </div>
            {stravaLoading ? (
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ) : !stravaConfigured ? (
              <p className="text-[12px] text-slate-500">
                Integrasi Strava belum dikonfigurasi di server.
              </p>
            ) : !stravaConnected ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] text-slate-600">
                  Hubungkan Strava agar aktivitas otomatis masuk insight.
                </p>
                <Link
                  to="/strava"
                  className="shrink-0 rounded-full bg-[#fc4c02] px-3 py-1.5 text-[11px] font-bold text-white"
                >
                  Connect
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-xl bg-orange-50/80 px-2 py-2">
                  <p className="text-lg font-black tabular-nums text-slate-900">
                    {Number(dayTotals.strava_sessions) || 0}
                  </p>
                  <p className="text-[10px] text-slate-500">Sesi Strava</p>
                </div>
                <div className="rounded-xl bg-orange-50/80 px-2 py-2">
                  <p className="text-lg font-black tabular-nums text-slate-900">
                    {formatDistanceKm(dayTotals.distance_m || 0)}
                  </p>
                  <p className="text-[10px] text-slate-500">Jarak hari</p>
                </div>
                <div className="rounded-xl bg-orange-50/80 px-2 py-2">
                  <p className="text-lg font-black tabular-nums text-slate-900">
                    {dayTotals.avg_heart_rate != null
                      ? Math.round(Number(dayTotals.avg_heart_rate))
                      : "—"}
                  </p>
                  <p className="text-[10px] text-slate-500">Avg HR</p>
                </div>
                <div className="rounded-xl bg-orange-50/80 px-2 py-2">
                  <p className="text-lg font-black tabular-nums text-slate-900">
                    {dayTotals.max_heart_rate != null
                      ? Math.round(Number(dayTotals.max_heart_rate))
                      : "—"}
                  </p>
                  <p className="text-[10px] text-slate-500">Max HR</p>
                </div>
              </div>
            )}
            {stravaConnected ? (
              <p className="mt-2 text-[10px] text-slate-400">
                Metrik hari · {dateLabel.toLowerCase()} (manual + Strava). HR dari sesi yang punya data.
              </p>
            ) : null}
          </div>
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
            <Link
              to="/activity/capture"
              className="size-14 bg-primary rounded-full text-white shadow-xl shadow-primary/30 flex items-center justify-center"
            >
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
