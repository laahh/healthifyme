import { Link } from "react-router-dom";

const FLAG_LABELS = {
  diabetes: "Diabetes",
  prediabetes: "Prediabetes",
  hipertensi: "Hipertensi",
  dislipidemia: "Kolesterol",
  metabolik: "Metabolik",
};

function toneForGrade(grade) {
  if (grade === "alert") {
    return {
      wrap: "border-red-200 bg-red-50",
      score: "text-red-800",
      chip: "bg-red-100 text-red-800",
      label: "Waspada",
    };
  }
  if (grade === "watch") {
    return {
      wrap: "border-orange-200 bg-orange-50",
      score: "text-orange-900",
      chip: "bg-orange-100 text-orange-900",
      label: "Perlu perhatian",
    };
  }
  if (grade === "incomplete") {
    return {
      wrap: "border-slate-200 bg-slate-50",
      score: "text-slate-600",
      chip: "bg-slate-200 text-slate-700",
      label: "Belum lengkap",
    };
  }
  return {
    wrap: "border-emerald-200 bg-emerald-50",
    score: "text-emerald-900",
    chip: "bg-emerald-100 text-emerald-800",
    label: "Baik",
  };
}

/**
 * @param {{
 *   story: {
 *     score?: number | null,
 *     grade?: string,
 *     title?: string,
 *     summary?: string,
 *     tips?: string[],
 *     mcuFlags?: string[],
 *     disclaimer?: string,
 *     targets?: { calorie_kcal?: number, source?: string, has_active_goal?: boolean },
 *     isToday?: boolean,
 *   } | null,
 *   dateLabel?: string,
 * }} props
 */
export default function NutritionHealthStatusCard({ story, dateLabel = "" }) {
  if (!story) return null;
  const tone = toneForGrade(story.grade);
  const flags = Array.isArray(story.mcuFlags) ? story.mcuFlags : [];
  const tips = Array.isArray(story.tips) ? story.tips : [];
  const targets = story.targets || {};
  const fromGoal = targets.source === "goal";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone.wrap}`}>
      <div className="flex items-start gap-3">
        <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <span className={`text-2xl font-black tabular-nums leading-none ${tone.score}`}>
            {story.score == null ? "—" : story.score}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">skor</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.chip}`}>{tone.label}</span>
            {dateLabel ? (
              <span className="text-[11px] font-medium text-slate-500">{dateLabel}</span>
            ) : null}
          </div>
          <h3 className="mt-1 text-[15px] font-bold leading-snug text-slate-900">{story.title}</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-700">{story.summary}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            fromGoal ? "bg-primary/15 text-primary" : "bg-white/70 text-slate-600"
          }`}
        >
          {fromGoal
            ? `Target goal · ${Number(targets.calorie_kcal || 0).toLocaleString("id-ID")} kkal`
            : `Target harian · ${Number(targets.calorie_kcal || 2250).toLocaleString("id-ID")} kkal`}
        </span>
        {!fromGoal ? (
          <Link to="/activity/capture" className="text-[10px] font-semibold text-primary underline underline-offset-2">
            Atur goal
          </Link>
        ) : null}
      </div>

      {flags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span
              key={f}
              className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200/80"
            >
              MCU · {FLAG_LABELS[f] || f}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500">Belum ada flag risiko kuat dari data MCU.</p>
      )}

      {tips.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
          {tips.map((t, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-snug text-slate-800">
              <span className="material-symbols-outlined mt-0.5 text-[16px] text-primary">lightbulb</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {story.disclaimer ? (
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">{story.disclaimer}</p>
      ) : null}
    </div>
  );
}
