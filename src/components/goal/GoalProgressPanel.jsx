import { useMemo } from "react";
import {
  ACHIEVEMENT_BADGE,
  clampPct,
  formatProgressDay,
  formatShortDay,
  localTodayYmd,
} from "./goalUiHelpers";

/**
 * @param {{
 *   activeGoal: object | null,
 *   progress: object | null,
 *   loading?: boolean,
 *   onGoPlan: () => void,
 * }} props
 */
export default function GoalProgressPanel({
  activeGoal,
  progress,
  loading = false,
  onGoPlan,
}) {
  const today = localTodayYmd();

  const lastScores = useMemo(() => {
    const arr = Array.isArray(progress?.scores) ? progress.scores : [];
    return arr.slice(-7);
  }, [progress]);

  const trend = useMemo(() => {
    const days = lastScores;
    const n = days.length || 7;
    const padX = 18;
    const width = 310;
    const top = 18;
    const bottom = 92;
    const chartH = bottom - top;
    const maxScore = Math.max(100, ...days.map((d) => Number(d.total_score) || 0), 1);
    const points = days.map((d, i) => {
      const score = Number(d.total_score) || 0;
      const x = n <= 1 ? width / 2 : padX + (i / (n - 1)) * (width - padX * 2);
      const y = bottom - (score / maxScore) * chartH;
      return { ...d, score, x, y, maxScore };
    });
    if (!points.length) return { line: "", area: "", points: [], targetY: 92 };
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const first = points[0];
    const last = points[points.length - 1];
    const area = `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
    const targetY = bottom - (70 / maxScore) * chartH;
    return { line, area, points, targetY };
  }, [lastScores]);

  const milestones = useMemo(() => {
    const list = Array.isArray(progress?.milestones) ? progress.milestones : [];
    return list.map((m) => {
      const date = String(m.milestone_date || "").slice(0, 10);
      const past = date && date < today;
      const isNext = date && date >= today;
      return { ...m, date, past, isNext };
    });
  }, [progress, today]);

  const nextMilestone = milestones.find((m) => m.isNext) || null;

  if (!activeGoal) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
        <p className="text-[13px] text-slate-500">Aktifkan goal untuk melihat progres perjalanan.</p>
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

  if (!progress && loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="size-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-8 text-center text-[13px] text-slate-500 shadow-sm">
        Belum ada data progres.
      </div>
    );
  }

  const pct = clampPct(Number(progress.completion_percent) || 0);
  const summary = progress.period_summary;
  const stats = summary?.stats;
  const windowDays = Number(summary?.window_days) || 7;
  const foodDays = Number(stats?.food_logged_days) || 0;
  const exDays = Number(stats?.exercise_days) || 0;
  const foodPct = clampPct((foodDays / windowDays) * 100);
  const exConsPct = clampPct((exDays / windowDays) * 100);
  const achievements = Array.isArray(progress.daily_achievements)
    ? progress.daily_achievements
    : [];

  const goalStart = activeGoal.start_date || progress.goal?.start_date;
  const goalEnd = activeGoal.target_date || progress.goal?.target_date;

  return (
    <div className="space-y-3 pb-6">
      {/* Journey card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Perjalanan goal
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-primary">{pct}%</p>
            {(goalStart || goalEnd) && (
              <p className="mt-1 text-[12px] text-slate-500">
                {goalStart || "—"} → {goalEnd || "—"}
              </p>
            )}
          </div>
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-3xl">timeline</span>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        {summary?.narrative ? (
          <p className="mt-3 text-[12px] leading-relaxed text-slate-600">{summary.narrative}</p>
        ) : null}
        {nextMilestone ? (
          <p className="mt-2 rounded-xl bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary">
            Milestone berikutnya · {nextMilestone.date}
            {nextMilestone.expected_weight_kg != null
              ? ` · ~${nextMilestone.expected_weight_kg} kg`
              : ""}
          </p>
        ) : null}
      </div>

      {/* Score trend line */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[14px] font-bold text-slate-900">Tren skor 7 hari</p>
          <span className="text-[10px] font-medium text-slate-400">Target referensi 70</span>
        </div>
        {trend.points.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-500">
            Belum ada data skor. Buka tab Hari ini untuk menghitung.
          </p>
        ) : (
          <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white px-1 pt-1">
            <svg
              viewBox="0 0 310 110"
              className="w-full"
              role="img"
              aria-label="Tren health score"
            >
              <defs>
                <linearGradient id="goalScoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="12" y1="92" x2="298" y2="92" stroke="#e2e8f0" strokeWidth="1.5" />
              <line
                x1="12"
                y1={trend.targetY}
                x2="298"
                y2={trend.targetY}
                stroke="#006a3f"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.45"
              />
              {trend.area ? <path d={trend.area} fill="url(#goalScoreFill)" /> : null}
              {trend.line ? (
                <path
                  d={trend.line}
                  fill="none"
                  stroke="#006a3f"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {trend.points.map((p) => (
                <g key={p.date}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#006a3f" strokeWidth="2" />
                  <text
                    x={p.x}
                    y="106"
                    textAnchor="middle"
                    className="fill-slate-400"
                    style={{ fontSize: 9 }}
                  >
                    {formatShortDay(p.date)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* Consistency */}
      {stats ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-[14px] font-bold text-slate-900">
            Konsistensi {windowDays} hari
          </p>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-semibold text-slate-700">Log makanan</span>
                <span className="tabular-nums text-slate-500">
                  {foodDays} / {windowDays} hari · {foodPct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${foodPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-semibold text-slate-700">Hari olahraga</span>
                <span className="tabular-nums text-slate-500">
                  {exDays} / {windowDays} hari · {exConsPct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${exConsPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Compact timeline */}
      {achievements.length > 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-[14px] font-bold text-slate-900">Timeline pencapaian</p>
          <ul className="space-y-2">
            {achievements.map((day) => {
              const foodBadge =
                ACHIEVEMENT_BADGE.food[day.food_status] || ACHIEVEMENT_BADGE.food.unknown;
              const exBadge =
                ACHIEVEMENT_BADGE.exercise[day.exercise_status] ||
                ACHIEVEMENT_BADGE.exercise.unknown;
              return (
                <li
                  key={day.date}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-slate-900">
                        {formatProgressDay(day.date)}
                      </p>
                      {day.total_score != null ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {Math.round(day.total_score)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
                      {day.overall_summary}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${foodBadge.cls}`}
                      >
                        {foodBadge.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${exBadge.cls}`}
                      >
                        {exBadge.label}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Milestones */}
      {milestones.length > 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-[14px] font-bold text-slate-900">Milestone</p>
          <ul className="space-y-0">
            {milestones.map((m) => (
              <li
                key={m.date || m.milestone_date}
                className={`flex items-center justify-between border-b border-slate-50 py-2.5 last:border-0 ${
                  m === nextMilestone ? "rounded-xl bg-primary/5 px-2 -mx-1" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined text-[16px] ${
                      m.past ? "text-emerald-500" : "text-primary"
                    }`}
                  >
                    {m.past ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span
                    className={`text-[13px] ${m.past ? "text-slate-400" : "text-slate-700"}`}
                  >
                    {m.date}
                  </span>
                  {m === nextMilestone ? (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                      Next
                    </span>
                  ) : null}
                </div>
                <span className="text-[13px] font-semibold text-slate-900">
                  {m.expected_weight_kg != null ? `~${m.expected_weight_kg} kg` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
