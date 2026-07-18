/** Shared UI helpers for Goal Daily / Progress panels. */

export function categoryLabel(cat) {
  const c = String(cat || "");
  if (c === "excellent") {
    return {
      text: "Excellent",
      cls: "bg-emerald-100 text-emerald-800",
      tone: "good",
      wrap: "border-emerald-200 bg-emerald-50",
      score: "text-emerald-900",
    };
  }
  if (c === "good") {
    return {
      text: "Baik",
      cls: "bg-green-100 text-green-800",
      tone: "good",
      wrap: "border-emerald-200 bg-emerald-50",
      score: "text-emerald-900",
    };
  }
  if (c === "need_improvement") {
    return {
      text: "Perlu ditingkatkan",
      cls: "bg-amber-100 text-amber-900",
      tone: "watch",
      wrap: "border-orange-200 bg-orange-50",
      score: "text-orange-900",
    };
  }
  return {
    text: "Perlu perhatian",
    cls: "bg-red-100 text-red-800",
    tone: "alert",
    wrap: "border-red-200 bg-red-50",
    score: "text-red-800",
  };
}

export function formatProgressDay(dateStr) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(`${dateStr}T12:00:00`));
  } catch {
    return dateStr;
  }
}

export function formatShortDay(dateStr) {
  try {
    return new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(
      new Date(`${dateStr}T12:00:00`)
    );
  } catch {
    return String(dateStr || "").slice(5);
  }
}

export function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {number} actual
 * @param {number} target
 */
export function pctOf(actual, target) {
  const t = Number(target);
  if (!(t > 0)) return 0;
  return Math.round((Number(actual) / t) * 100);
}

export function clampPct(n, max = 100) {
  return Math.min(max, Math.max(0, Math.round(Number(n) || 0)));
}

export const ACHIEVEMENT_BADGE = {
  food: {
    no_log: { label: "Belum log", cls: "bg-slate-100 text-slate-600" },
    over: { label: "Kalori tinggi", cls: "bg-amber-100 text-amber-900" },
    under: { label: "Kurang", cls: "bg-orange-100 text-orange-900" },
    on_target: { label: "Nutrisi OK", cls: "bg-emerald-100 text-emerald-800" },
    unknown: { label: "—", cls: "bg-slate-100 text-slate-500" },
  },
  exercise: {
    none: { label: "Tidak ada", cls: "bg-slate-100 text-slate-600" },
    under: { label: "Kurang", cls: "bg-orange-100 text-orange-900" },
    partial: { label: "Cukup", cls: "bg-sky-100 text-sky-800" },
    on_target: { label: "Target", cls: "bg-emerald-100 text-emerald-800" },
    unknown: { label: "—", cls: "bg-slate-100 text-slate-500" },
  },
};

/**
 * Build a short Indonesian summary for today's score + top recommendation.
 * @param {object | null} dashboard
 */
export function buildDailyStatusCopy(dashboard) {
  const score = dashboard?.score;
  const recs = Array.isArray(dashboard?.recommendations) ? dashboard.recommendations : [];
  const total = score?.total_score != null ? Math.round(Number(score.total_score)) : null;
  const cat = categoryLabel(score?.category);
  const tgt = dashboard?.daily_target;
  const act = dashboard?.actuals;

  if (!tgt) {
    return {
      title: "Target harian belum tersedia",
      summary:
        "Tanggal hari ini di luar rentang goal atau target belum di-generate. Cek tab Rencana.",
      tips: [],
      grade: cat,
      score: total,
    };
  }

  const calPct = pctOf(act?.calorie, tgt.calorie_target);
  const exPct = pctOf(act?.exercise_min, tgt.exercise_duration_target_min);
  const mealCount = Number(act?.meal_count) || 0;

  let title = "Status hari ini";
  if (total == null) title = "Belum ada skor";
  else if (cat.tone === "good") title = "Hari ini cukup baik";
  else if (cat.tone === "watch") title = "Perlu perhatian hari ini";
  else title = "Hari ini perlu diperbaiki";

  const parts = [];
  if (total != null) {
    parts.push(`Skor kesehatan ${total}/100 (${cat.text}).`);
  }
  if (mealCount === 0 && Number(act?.exercise_min || 0) === 0) {
    parts.push("Belum ada asupan atau olahraga tercatat — mulai log agar skor akurat.");
  } else {
    parts.push(
      `Kalori ${Math.round(act?.calorie || 0)}/${Math.round(tgt.calorie_target)} kkal (${calPct}%), olahraga ${act?.exercise_min || 0}/${tgt.exercise_duration_target_min} mnt (${exPct}%).`
    );
  }

  const tips = recs.slice(0, 2).map((r) => r.body || r.title).filter(Boolean);
  if (tips.length === 0) {
    if (calPct > 105) tips.push("Kalori sudah melewati target — atur porsi sisa hari.");
    else if (exPct < 80) tips.push("Tambah sesi singkat agar mendekati target menit olahraga.");
    else tips.push("Pertahankan ritme log makanan dan olahraga hari ini.");
  }

  return {
    title,
    summary: parts.join(" "),
    tips,
    grade: cat,
    score: total,
  };
}
