/**
 * Visual analisis asupan: donut makro, distribusi waktu, bar vs target, meter skor.
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

function bucketForHour(h) {
  if (h >= 5 && h < 11) return "pagi";
  if (h >= 11 && h < 15) return "siang";
  if (h >= 15 && h < 19) return "sore";
  return "malam";
}

const SLOT_META = [
  { key: "pagi", label: "Pagi", icon: "wb_twilight", color: "#f59e0b" },
  { key: "siang", label: "Siang", icon: "wb_sunny", color: "#10b981" },
  { key: "sore", label: "Sore", icon: "wb_cloudy", color: "#f97316" },
  { key: "malam", label: "Malam", icon: "nights_stay", color: "#6366f1" },
];

/**
 * @param {{
 *   totals: { energyKkal: number, proteinG: number, fatsG: number, carbsG: number, fiberG: number },
 *   targets: { calorie_kcal?: number, protein_g?: number, fat_g?: number, carb_g?: number, fiber_g?: number },
 *   meals: Array<{ calories?: number|string, createdAt?: string|number }>,
 *   story?: { score?: number|null, grade?: string, focus?: string } | null,
 *   dateLabel?: string,
 * }} props
 */
export default function NutritionDayAnalysisCharts({
  totals,
  targets,
  meals = [],
  story = null,
  dateLabel = "",
}) {
  const proteinKcal = (Number(totals?.proteinG) || 0) * 4;
  const fatKcal = (Number(totals?.fatsG) || 0) * 9;
  const carbKcal = (Number(totals?.carbsG) || 0) * 4;
  const macroSum = proteinKcal + fatKcal + carbKcal;
  const energy = Number(totals?.energyKkal) || macroSum || 0;

  const slices = [
    { key: "protein", label: "Protein", kcal: proteinKcal, color: "#f59e0b", g: Number(totals?.proteinG) || 0 },
    { key: "fat", label: "Lemak", kcal: fatKcal, color: "#f43f5e", g: Number(totals?.fatsG) || 0 },
    { key: "carb", label: "Karbo", kcal: carbKcal, color: "#10b981", g: Number(totals?.carbsG) || 0 },
  ];
  const denom = macroSum > 0 ? macroSum : 1;
  let angle = 0;
  const arcs = slices.map((s) => {
    const span = (s.kcal / denom) * 360;
    const start = angle;
    const end = angle + Math.max(span, s.kcal > 0 ? 2 : 0);
    angle = end;
    return { ...s, start, end, pct: Math.round((s.kcal / denom) * 100) };
  });

  const slots = buildSlots(meals);
  const maxSlot = Math.max(1, ...slots.map((s) => s.kcal));

  const compareRows = [
    {
      label: "Kalori",
      actual: energy,
      target: Number(targets?.calorie_kcal) || 2250,
      unit: "kkal",
      color: "#006a3f",
    },
    {
      label: "Protein",
      actual: Number(totals?.proteinG) || 0,
      target: Number(targets?.protein_g) || 1,
      unit: "g",
      color: "#f59e0b",
    },
    {
      label: "Lemak",
      actual: Number(totals?.fatsG) || 0,
      target: Number(targets?.fat_g) || 1,
      unit: "g",
      color: "#f43f5e",
    },
    {
      label: "Karbo",
      actual: Number(totals?.carbsG) || 0,
      target: Number(targets?.carb_g) || 1,
      unit: "g",
      color: "#10b981",
    },
  ];

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

  const scorePct = score == null ? 0 : Math.min(100, Math.max(0, score));
  const scoreCirc = 2 * Math.PI * 36;
  const scoreDash = (scorePct / 100) * scoreCirc;

  const focusCopy = {
    sugar: "Fokus: pantau gula/karbo",
    fat: "Fokus: pantau lemak",
    calorie: "Fokus: pantau kalori",
    balanced: "Keseimbangan makro cukup baik",
    incomplete: "Belum cukup data untuk analisis",
  };

  const hasData = energy > 0 || meals.length > 0;

  return (
    <div className="px-4 py-2">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-lg font-bold leading-tight tracking-[-0.015em]">Analisis asupan</h3>
        <span className="text-[10px] font-medium text-slate-400">{dateLabel}</span>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <span className="material-symbols-outlined text-3xl text-slate-300">analytics</span>
          <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">Belum ada data untuk dianalisis</p>
          <p className="mt-1 text-xs text-slate-500">Grafik muncul setelah ada asupan pada tanggal ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Row: donut + score gauge */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Komposisi energi
              </p>
              <div className="relative mx-auto size-[120px]">
                <svg viewBox="0 0 100 100" className="size-full">
                  {macroSum <= 0 ? (
                    <circle cx="50" cy="50" r="34" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                  ) : (
                    arcs.map((a) => (
                      <path
                        key={a.key}
                        d={donutSlice(50, 50, 42, 26, a.start, a.end)}
                        fill={a.color}
                        className="transition-opacity hover:opacity-90"
                      />
                    ))
                  )}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black tabular-nums text-slate-900 dark:text-slate-100">
                    {Math.round(energy)}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">kkal</span>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {arcs.map((a) => (
                  <li key={a.key} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                      {a.label}
                    </span>
                    <span className="tabular-nums font-bold text-slate-800 dark:text-slate-100">
                      {a.pct}% · {Math.round(a.g)}g
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className={`rounded-2xl border border-slate-100 p-3 shadow-sm dark:border-slate-800 ${scoreTone.bg}`}
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Skor kesehatan
              </p>
              <div className="relative mx-auto size-[120px]">
                <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                  <circle cx="50" cy="50" r="36" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    stroke={scoreTone.ring}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${scoreDash} ${scoreCirc}`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rotate-0">
                  <span className={`text-2xl font-black tabular-nums ${scoreTone.text}`}>
                    {score == null ? "—" : score}
                  </span>
                  <span className="text-[9px] font-semibold uppercase text-slate-500">/ 100</span>
                </div>
              </div>
              <p className={`mt-2 text-center text-[11px] font-semibold leading-snug ${scoreTone.text}`}>
                {focusCopy[story?.focus] || focusCopy.balanced}
              </p>
            </div>
          </div>

          {/* Time-of-day bars */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative z-10 mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Distribusi waktu makan
              </p>
              <span className="shrink-0 text-[10px] font-medium text-slate-400">
                {meals.length} asupan
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => {
                const ratio = maxSlot > 0 ? s.kcal / maxSlot : 0;
                const barH = s.kcal > 0 ? Math.max(8, Math.round(ratio * 88)) : 3;
                return (
                  <div key={s.key} className="flex min-w-0 flex-col items-center">
                    <div className="flex h-5 w-full items-end justify-center">
                      <span className="max-w-full truncate text-center text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200">
                        {s.kcal > 0 ? Math.round(s.kcal).toLocaleString("id-ID") : "—"}
                      </span>
                    </div>
                    <div className="mt-1 flex h-[96px] w-full items-end justify-center overflow-hidden">
                      <div
                        className="w-[72%] max-w-[40px] rounded-t-lg"
                        style={{
                          height: `${barH}px`,
                          maxHeight: "96px",
                          background: `linear-gradient(180deg, ${s.color} 0%, ${s.color}b3 100%)`,
                        }}
                        title={`${s.label}: ${Math.round(s.kcal)} kkal`}
                      />
                    </div>
                    <span
                      className="material-symbols-outlined mt-1.5 text-[16px]"
                      style={{ color: s.color }}
                    >
                      {s.icon}
                    </span>
                    <span className="mt-0.5 text-[10px] font-semibold text-slate-500">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actual vs target */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Actual vs target
            </p>
            <div className="space-y-3">
              {compareRows.map((row) => {
                const pct = row.target > 0 ? Math.round((row.actual / row.target) * 100) : 0;
                const over = pct > 100;
                return (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">{row.label}</span>
                      <span className="tabular-nums font-bold text-slate-800 dark:text-slate-100">
                        {Math.round(row.actual).toLocaleString("id-ID")} /{" "}
                        {Math.round(row.target).toLocaleString("id-ID")} {row.unit}
                        <span className={`ml-1.5 ${over ? "text-red-500" : "text-primary"}`}>
                          {pct}%
                        </span>
                      </span>
                    </div>
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: over ? "#ef4444" : row.color,
                        }}
                      />
                      {over ? (
                        <div
                          className="absolute inset-y-0 right-0 rounded-r-full bg-red-400/40"
                          style={{ width: `${Math.min(pct - 100, 40)}%` }}
                          title="Melebihi target"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param {Array<{ calories?: number|string, createdAt?: string|number }>} meals
 */
function buildSlots(meals) {
  const map = { pagi: 0, siang: 0, sore: 0, malam: 0 };
  for (const m of meals || []) {
    const cal = Number(m.calories) || 0;
    if (!cal) continue;
    let h = 12;
    if (m.createdAt != null) {
      const d = new Date(m.createdAt);
      if (!Number.isNaN(d.getTime())) h = d.getHours();
    }
    map[bucketForHour(h)] += cal;
  }
  return SLOT_META.map((s) => ({ ...s, kcal: map[s.key] }));
}
