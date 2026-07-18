/**
 * Visual analisis olahraga: meter skor, durasi vs target, sumber sesi, HR.
 * SVG murni — tanpa library chart.
 */

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function donutSlice(cx, cy, rOuter, rInner, startAngle, endAngle) {
  if (endAngle - startAngle < 0.5) return "";
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const o1 = polar(cx, cy, rOuter, startAngle);
  const o2 = polar(cx, cy, rOuter, endAngle);
  const i1 = polar(cx, cy, rInner, endAngle);
  const i2 = polar(cx, cy, rInner, startAngle);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ");
}

/**
 * @param {{
 *   totals: {
 *     duration_min?: number,
 *     calories_kcal?: number,
 *     sessions?: number,
 *     manual_sessions?: number,
 *     strava_sessions?: number,
 *     distance_m?: number,
 *     avg_heart_rate?: number | null,
 *     max_heart_rate?: number | null,
 *   },
 *   targets: { duration_min?: number },
 *   story?: { score?: number|null, grade?: string } | null,
 *   dateLabel?: string,
 * }} props
 */
export default function WorkoutDayAnalysisCharts({
  totals,
  targets,
  story = null,
  dateLabel = "",
}) {
  const duration = Number(totals?.duration_min) || 0;
  const calories = Number(totals?.calories_kcal) || 0;
  const sessions = Number(totals?.sessions) || 0;
  const manual = Number(totals?.manual_sessions) || 0;
  const strava = Number(totals?.strava_sessions) || 0;
  const distanceM = Number(totals?.distance_m) || 0;
  const avgHr = totals?.avg_heart_rate != null ? Number(totals.avg_heart_rate) : null;
  const maxHr = totals?.max_heart_rate != null ? Number(totals.max_heart_rate) : null;
  const durationTarget = Math.max(1, Number(targets?.duration_min) || 30);
  const durationPct = Math.round((duration / durationTarget) * 100);

  const score = story?.score;
  const grade = story?.grade || "incomplete";
  const scoreTone =
    grade === "alert"
      ? { ring: "#ef4444", bg: "bg-red-50", text: "text-red-800" }
      : grade === "watch"
        ? { ring: "#f97316", bg: "bg-orange-50", text: "text-orange-900" }
        : grade === "incomplete"
          ? { ring: "#94a3b8", bg: "bg-slate-50", text: "text-slate-600" }
          : { ring: "#10b981", bg: "bg-emerald-50", text: "text-emerald-900" };

  const sourceSlices = [
    { key: "manual", label: "Manual", count: manual, color: "#006a3f" },
    { key: "strava", label: "Strava", count: strava, color: "#fc4c02" },
  ].filter((s) => s.count > 0);
  const sourceDenom = Math.max(1, sourceSlices.reduce((s, x) => s + x.count, 0));
  let angle = 0;
  const arcs = sourceSlices.map((s) => {
    const span = (s.count / sourceDenom) * 360;
    const start = angle;
    const end = angle + Math.max(span, s.count > 0 ? 8 : 0);
    angle = end;
    return { ...s, start, end, pct: Math.round((s.count / sourceDenom) * 100) };
  });

  const compareRows = [
    {
      label: "Durasi",
      actual: duration,
      target: durationTarget,
      unit: "mnt",
      color: "#006a3f",
    },
    {
      label: "Kalori",
      actual: calories,
      target: null,
      unit: "kkal",
      color: "#f59e0b",
    },
    {
      label: "Sesi",
      actual: sessions,
      target: null,
      unit: "",
      color: "#6366f1",
    },
  ];

  const scoreCirc = 2 * Math.PI * 28;
  const scoreVal = score == null ? 0 : Math.max(0, Math.min(100, score));
  const scoreDash = (scoreVal / 100) * scoreCirc;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Analisis hari · {dateLabel || "Hari ini"}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl border border-slate-100 p-3 ${scoreTone.bg}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Skor</p>
          <div className="mt-2 flex items-center gap-2">
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke={scoreTone.ring}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${scoreDash} ${scoreCirc}`}
              />
            </svg>
            <div>
              <p className={`text-2xl font-black tabular-nums ${scoreTone.text}`}>
                {score == null ? "—" : score}
              </p>
              <p className="text-[10px] text-slate-500">dari 100</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Durasi vs target
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative size-16 shrink-0">
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
                  className={durationPct >= 100 ? "text-emerald-500" : "text-primary"}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={`${Math.min(durationPct, 100)}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold tabular-nums text-slate-800">
                  {Math.min(durationPct, 999)}%
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black tabular-nums text-slate-900">
                {Math.round(duration * 10) / 10}
                <span className="text-xs font-semibold text-slate-400"> mnt</span>
              </p>
              <p className="text-[10px] text-slate-500">Target {durationTarget} mnt</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:bg-slate-900">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Aktual vs target
        </p>
        <div className="space-y-2.5">
          {compareRows.map((row) => {
            const pct =
              row.target != null && row.target > 0
                ? Math.min(140, Math.round((row.actual / row.target) * 100))
                : null;
            return (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700">{row.label}</span>
                  <span className="tabular-nums text-slate-500">
                    {Math.round(row.actual * 10) / 10}
                    {row.unit ? ` ${row.unit}` : ""}
                    {row.target != null ? ` / ${row.target}${row.unit ? ` ${row.unit}` : ""}` : ""}
                  </span>
                </div>
                {pct != null ? (
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: row.actual > 0 ? "100%" : "0%",
                        backgroundColor: row.color,
                        opacity: 0.55,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {distanceM > 0 ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Jarak · {(distanceM / 1000).toFixed(2)} km
            {avgHr != null ? ` · HR rata ${Math.round(avgHr)} bpm` : ""}
            {maxHr != null ? ` · max ${Math.round(maxHr)}` : ""}
          </p>
        ) : avgHr != null ? (
          <p className="mt-2 text-[11px] text-slate-500">
            HR rata · {Math.round(avgHr)} bpm
            {maxHr != null ? ` · max ${Math.round(maxHr)}` : ""}
          </p>
        ) : null}
      </div>

      {arcs.length > 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-3 dark:bg-slate-900">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Sumber sesi
          </p>
          <div className="flex items-center gap-4">
            <svg width="88" height="88" viewBox="0 0 88 88">
              {arcs.map((a) => (
                <path
                  key={a.key}
                  d={donutSlice(44, 44, 40, 24, a.start, a.end)}
                  fill={a.color}
                />
              ))}
              <text
                x="44"
                y="42"
                textAnchor="middle"
                className="fill-slate-900 text-[14px] font-bold"
                style={{ fontSize: 14, fontWeight: 700 }}
              >
                {sessions}
              </text>
              <text
                x="44"
                y="56"
                textAnchor="middle"
                className="fill-slate-400"
                style={{ fontSize: 9 }}
              >
                sesi
              </text>
            </svg>
            <ul className="space-y-1.5">
              {arcs.map((a) => (
                <li key={a.key} className="flex items-center gap-2 text-[12px] text-slate-700">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="font-semibold">{a.label}</span>
                  <span className="tabular-nums text-slate-400">
                    {a.count} · {a.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
