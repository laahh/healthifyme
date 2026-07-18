import { Link } from "react-router-dom";

/**
 * @param {{
 *   loading?: boolean,
 *   hasGoal?: boolean,
 *   healthScore?: number | null,
 *   caloriePct?: number | null,
 *   exercisePct?: number | null,
 *   calorieTargetKcal?: number | null,
 *   calorieActual?: number | null,
 *   exerciseActualMin?: number | null,
 *   exerciseTargetMin?: number | null,
 *   error?: string | null,
 * }} props
 */
export default function ProfileTodayCard({
  loading = false,
  hasGoal = false,
  healthScore = null,
  caloriePct = null,
  exercisePct = null,
  calorieTargetKcal = null,
  calorieActual = null,
  exerciseActualMin = null,
  exerciseTargetMin = null,
  error = null,
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
        {error}
      </div>
    );
  }

  if (!hasGoal) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hari ini</p>
        <h3 className="mt-1 text-[15px] font-bold text-slate-900 dark:text-slate-100">
          Belum ada goal aktif
        </h3>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
          Atur target kalori dan olahraga agar progress harian muncul di sini.
        </p>
        <Link
          to="/activity/capture"
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-[12px] font-bold text-white"
        >
          Atur goal
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    );
  }

  const calPct = Math.min(100, Math.max(0, Number(caloriePct) || 0));
  const exPct = Math.min(100, Math.max(0, Number(exercisePct) || 0));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hari ini</p>
          <h3 className="mt-0.5 text-[15px] font-bold text-slate-900 dark:text-slate-100">
            Progress goal
          </h3>
        </div>
        {healthScore != null ? (
          <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10">
            <span className="text-lg font-black tabular-nums leading-none text-primary">
              {healthScore}
            </span>
            <span className="text-[8px] font-semibold uppercase text-slate-500">skor</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700">Kalori</span>
            <span className="tabular-nums text-slate-500">
              {calorieActual != null ? Math.round(calorieActual) : "—"}
              {calorieTargetKcal != null ? ` / ${calorieTargetKcal} kkal` : ""}
              {caloriePct != null ? ` · ${calPct}%` : ""}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${calPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700">Olahraga</span>
            <span className="tabular-nums text-slate-500">
              {exerciseActualMin != null ? Math.round(exerciseActualMin * 10) / 10 : "—"}
              {exerciseTargetMin != null ? ` / ${exerciseTargetMin} mnt` : ""}
              {exercisePct != null ? ` · ${exPct}%` : ""}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${exPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/nutrition/insight"
          className="text-[11px] font-bold text-primary underline underline-offset-2"
        >
          Insight nutrisi
        </Link>
        <span className="text-slate-300">·</span>
        <Link
          to="/workout/insight"
          className="text-[11px] font-bold text-primary underline underline-offset-2"
        >
          Insight olahraga
        </Link>
      </div>
    </div>
  );
}
