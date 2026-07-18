import { Link } from "react-router-dom";
import { buildDailyStatusCopy, clampPct, pctOf } from "./goalUiHelpers";

function ProgressRing({ pct, over, icon }) {
  const display = clampPct(pct, 100);
  return (
    <div className="relative size-[72px] shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-slate-200"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeDasharray="100, 100"
          strokeWidth="3"
        />
        <path
          className={over ? "text-amber-500" : "text-primary"}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeDasharray={`${display}, 100`}
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="material-symbols-outlined text-[26px] text-primary">{icon}</span>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   activeGoal: object | null,
 *   dashboard: object | null,
 *   loading?: boolean,
 *   onGoPlan: () => void,
 *   onRefresh: () => void,
 * }} props
 */
export default function GoalDailyPanel({
  activeGoal,
  dashboard,
  loading = false,
  onGoPlan,
  onRefresh,
}) {
  if (!activeGoal) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <span className="material-symbols-outlined text-[28px] text-primary">flag</span>
        </div>
        <p className="mt-3 text-[15px] font-bold text-slate-900">Belum ada goal aktif</p>
        <p className="mt-1 text-[12px] text-slate-500">
          Buat rencana lalu aktifkan untuk mulai tracking hari ini.
        </p>
        <button
          type="button"
          onClick={onGoPlan}
          className="mt-4 rounded-2xl bg-primary px-6 py-2.5 text-[13px] font-bold text-white"
        >
          Ke Rencana
        </button>
      </div>
    );
  }

  if (!dashboard && loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="size-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-8 text-center shadow-sm">
        <p className="text-[13px] text-slate-500">Gagal memuat data hari ini.</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-3 text-[13px] font-bold text-primary"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const status = buildDailyStatusCopy(dashboard);
  const tgt = dashboard.daily_target;
  const act = dashboard.actuals || {};
  const sources = dashboard.actuals_sources || {};

  const calTarget = Number(tgt?.calorie_target) || 0;
  const calActual = Number(act.calorie) || 0;
  const calPct = pctOf(calActual, calTarget);
  const calOver = calPct > 100;
  const calRemain = Math.round(calTarget - calActual);

  const exTarget = Number(tgt?.exercise_duration_target_min) || 0;
  const exActual = Number(act.exercise_min) || 0;
  const exPct = pctOf(exActual, exTarget);

  const macros = [
    {
      key: "protein",
      label: "Protein",
      actual: Number(act.protein_g) || 0,
      target: Number(tgt?.protein_target_g) || 0,
      color: "bg-amber-500",
      unit: "g",
    },
    {
      key: "carb",
      label: "Karbo",
      actual: Number(act.carb_g) || 0,
      target: Number(tgt?.carb_target_g) || 0,
      color: "bg-emerald-500",
      unit: "g",
    },
    {
      key: "fat",
      label: "Lemak",
      actual: Number(act.fat_g) || 0,
      target: Number(tgt?.fat_target_g) || 0,
      color: "bg-rose-500",
      unit: "g",
    },
  ];

  return (
    <div className="space-y-3 pb-6">
      {/* Status card */}
      <div className={`rounded-2xl border px-4 py-4 ${status.grade.wrap}`}>
        <div className="flex items-start gap-3">
          <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/80 shadow-sm">
            <span className={`text-2xl font-black tabular-nums leading-none ${status.grade.score}`}>
              {status.score == null ? "—" : status.score}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
              skor
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.grade.cls}`}>
                {status.grade.text}
              </span>
              <span className="text-[11px] font-medium text-slate-500">Hari ini</span>
            </div>
            <h3 className="mt-1 text-[15px] font-bold leading-snug text-slate-900">{status.title}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-700">{status.summary}</p>
          </div>
        </div>
        {status.tips.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
            {status.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-snug text-slate-800">
                <span className="material-symbols-outlined mt-0.5 text-[16px] text-primary">
                  lightbulb
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {tgt ? (
        <>
          {/* Rings */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Kalori</p>
              <div className="mt-2 flex items-center gap-2">
                <ProgressRing pct={calPct} over={calOver} icon="restaurant" />
                <div className="min-w-0">
                  <p className="text-lg font-black tabular-nums text-slate-900">
                    {Math.round(calActual)}
                    <span className="text-xs font-semibold text-slate-400"> kkal</span>
                  </p>
                  <p className="text-[10px] text-slate-500">Target {Math.round(calTarget)}</p>
                  <p
                    className={`mt-0.5 text-[11px] font-semibold ${
                      calOver ? "text-amber-700" : "text-slate-600"
                    }`}
                  >
                    {calOver
                      ? `+${Math.abs(calRemain)} surplus`
                      : `Sisa ${Math.max(0, calRemain)}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Olahraga
              </p>
              <div className="mt-2 flex items-center gap-2">
                <ProgressRing pct={exPct} over={false} icon="exercise" />
                <div className="min-w-0">
                  <p className="text-lg font-black tabular-nums text-slate-900">
                    {Math.round(exActual * 10) / 10}
                    <span className="text-xs font-semibold text-slate-400"> mnt</span>
                  </p>
                  <p className="text-[10px] text-slate-500">Target {exTarget}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Number(sources.manual_workouts) > 0 ? (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                        {sources.manual_workouts} manual
                      </span>
                    ) : null}
                    {Number(sources.strava_sessions) > 0 ? (
                      <span className="rounded-full bg-[#fc4c02] px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {sources.strava_sessions} Strava
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Macros */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-bold text-slate-900">Makro vs target</p>
              {tgt.step_target != null ? (
                <span className="text-[10px] font-medium text-slate-400">
                  Target langkah {Number(tgt.step_target).toLocaleString("id-ID")}
                </span>
              ) : null}
            </div>
            <div className="space-y-2.5">
              {macros.map((m) => {
                const p = clampPct(pctOf(m.actual, m.target));
                return (
                  <div key={m.key}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">{m.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {Math.round(m.actual)}
                        {m.target > 0 ? ` / ${Math.round(m.target)}` : ""} {m.unit}
                        {m.target > 0 ? ` · ${p}%` : ""}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${m.color}`}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center text-[13px] text-slate-500 shadow-sm">
          Tanggal hari ini di luar rentang goal atau target harian belum tersedia.
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/food"
          className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <span className="material-symbols-outlined text-[18px]">restaurant</span>
          </span>
          <span className="text-[12px] font-semibold text-slate-800">Log makanan</span>
        </Link>
        <Link
          to="/workout"
          className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[18px]">exercise</span>
          </span>
          <span className="text-[12px] font-semibold text-slate-800">Log olahraga</span>
        </Link>
        <Link
          to="/nutrition/insight"
          className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[18px]">nutrition</span>
          </span>
          <span className="text-[12px] font-semibold text-slate-800">Insight nutrisi</span>
        </Link>
        <Link
          to="/workout/insight"
          className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <span className="material-symbols-outlined text-[18px]">fitness_center</span>
          </span>
          <span className="text-[12px] font-semibold text-slate-800">Insight olahraga</span>
        </Link>
      </div>

      {Number(sources.strava_sessions) === 0 ? (
        <Link
          to="/strava"
          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 shadow-sm"
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-[#fc4c02]/10">
            <span className="material-symbols-outlined text-[20px] text-[#fc4c02]">sync</span>
          </div>
          <span className="flex-1 text-[13px] font-semibold text-slate-800">
            Sinkronkan aktivitas dari Strava
          </span>
          <span className="material-symbols-outlined text-slate-300">chevron_right</span>
        </Link>
      ) : null}

      <button
        type="button"
        onClick={onRefresh}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-3 text-[13px] font-semibold text-slate-700"
      >
        <span className="material-symbols-outlined text-[18px]">refresh</span>
        Muat ulang hari ini
      </button>
    </div>
  );
}
