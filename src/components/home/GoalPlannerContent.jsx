import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";

const SWAL_CONFIRM = "#15803d";

const GOAL_ICONS = {
  WEIGHT_LOSS: "monitor_weight_loss",
  MAINTAIN_WEIGHT: "balance",
  MUSCLE_GAIN: "fitness_center",
  ACTIVE_LIFESTYLE: "directions_run",
  HEALTHY_LIFESTYLE: "spa",
};

function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function categoryLabel(cat) {
  const c = String(cat || "");
  if (c === "excellent") return { text: "Excellent", cls: "bg-emerald-100 text-emerald-800" };
  if (c === "good") return { text: "Good", cls: "bg-green-100 text-green-800" };
  if (c === "need_improvement") return { text: "Perlu ditingkatkan", cls: "bg-amber-100 text-amber-900" };
  return { text: "Perlu perhatian", cls: "bg-red-100 text-red-800" };
}

/**
 * @param {Record<string, unknown>} form
 * @param {string} selectedCode
 * @param {{ code: string, name: string }[]} goalTypes
 * @returns {{ items: { label: string, ok: boolean, hint: string }[], allOk: boolean }}
 */
function evaluateGoalForm(form, selectedCode, goalTypes) {
  const code = String(selectedCode || "").trim();
  const typeName = goalTypes.find((g) => g.code === code)?.name || code || "—";
  const h = parseFloat(String(form.height_cm ?? "").replace(",", "."));
  const w = parseFloat(String(form.weight_kg ?? "").replace(",", "."));
  const sw = parseFloat(String(form.start_weight_kg ?? "").replace(",", "."));
  const tw = parseFloat(String(form.target_weight_kg ?? "").replace(",", "."));
  const startD = String(form.start_date || "").trim();
  const endD = String(form.target_date || "").trim();
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  /** @type {{ label: string, ok: boolean, hint: string }[]} */
  const items = [
    {
      label: "Jenis goal",
      ok: Boolean(code),
      hint: code ? typeName : "Pilih dari daftar",
    },
    {
      label: "Gender",
      ok: Boolean(form.gender),
      hint: form.gender ? String(form.gender) : "Pilih male / female / other",
    },
    {
      label: "Tinggi badan (cm)",
      ok: Number.isFinite(h) && h >= 100 && h <= 250,
      hint: Number.isFinite(h) ? `${h} cm` : "Isi 100–250",
    },
    {
      label: "Berat badan profil (kg)",
      ok: Number.isFinite(w) && w >= 30 && w <= 300,
      hint: Number.isFinite(w) ? `${w} kg` : "Isi 30–300",
    },
    {
      label: "Tanggal mulai",
      ok: Boolean(startD && dateRe.test(startD)),
      hint: startD || "YYYY-MM-DD",
    },
    {
      label: "Tanggal selesai",
      ok: Boolean(endD && dateRe.test(endD)),
      hint: endD || "YYYY-MM-DD",
    },
    {
      label: "Berat awal goal (kg)",
      ok: Number.isFinite(sw) && sw >= 30 && sw <= 300,
      hint: Number.isFinite(sw) ? `${sw} kg` : "Isi 30–300",
    },
    {
      label: "Target berat (kg)",
      ok: Number.isFinite(tw) && tw >= 30 && tw <= 300,
      hint: Number.isFinite(tw) ? `${tw} kg` : "Isi 30–300",
    },
  ];

  const age = parseInt(String(form.age_years ?? "").trim(), 10);
  if (String(form.age_years ?? "").trim()) {
    items.push({
      label: "Usia (opsional)",
      ok: Number.isFinite(age) && age >= 15 && age <= 100,
      hint: Number.isFinite(age) ? `${age} tahun` : "15–100 atau kosongkan",
    });
  }

  const allOk = items.every((i) => i.ok);
  return { items, allOk };
}

function swalFormIncompleteHtml(items) {
  const filled = items.filter((i) => i.ok);
  const missing = items.filter((i) => !i.ok);
  const row = (i, done) =>
    `<li style="margin:6px 0;line-height:1.35"><span style="color:${done ? "#15803d" : "#b91c1c"};font-weight:700">${done ? "✓" : "○"}</span> <strong>${i.label}</strong><br/><span style="font-size:12px;color:#64748b">${i.hint}</span></li>`;
  return `
    <div style="text-align:left;font-size:14px;max-height:55vh;overflow:auto">
      <p style="margin:0 0 8px;font-weight:700;color:#15803d">Sudah diisi (${filled.length})</p>
      <ul style="margin:0 0 16px;padding-left:18px;list-style:none">${filled.map((i) => row(i, true)).join("") || '<li style="color:#64748b">—</li>'}</ul>
      <p style="margin:0 0 8px;font-weight:700;color:#b91c1c">Belum lengkap (${missing.length})</p>
      <ul style="margin:0;padding-left:18px;list-style:none">${missing.map((i) => row(i, false)).join("") || '<li style="color:#64748b">—</li>'}</ul>
    </div>`;
}

export default function GoalPlannerContent() {
  const [tab, setTab] = useState("plan");
  const [planStep, setPlanStep] = useState("pick");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [goalTypes, setGoalTypes] = useState([]);
  const [goals, setGoals] = useState([]);
  const [, setProfile] = useState(null);
  const [selectedCode, setSelectedCode] = useState("");
  const [draftGoalId, setDraftGoalId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    goal_name: "",
    start_date: localToday(),
    target_date: "",
    start_weight_kg: "",
    target_weight_kg: "",
    intensity_level: "normal",
    activity_level: "moderate",
    exercise_preferences: "",
    food_restrictions: "",
    age_years: "",
    gender: "",
    height_cm: "",
    weight_kg: "",
  });

  const apiOk = isApiBackendEnabled();

  const activeGoal = useMemo(() => goals.find((g) => g.status === "active"), [goals]);

  const loadAll = useCallback(async () => {
    if (!apiOk) {
      setLoading(false);
      setError("Set VITE_API_URL dan jalankan server API untuk Goal Planner.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const [gt, gl, pr] = await Promise.all([
        apiRequest("/me/goal-types"),
        apiRequest("/me/goals"),
        apiRequest("/me/profile"),
      ]);
      setGoalTypes(gt.goal_types || []);
      setGoals(gl.goals || []);
      setProfile(pr.profile || null);
      setForm((f) => ({
        ...f,
        gender: pr.profile?.gender || "",
        height_cm: pr.profile?.height_cm != null ? String(pr.profile.height_cm) : "",
        weight_kg: pr.profile?.weight_kg != null ? String(pr.profile.weight_kg) : "",
        activity_level: pr.profile?.activity_level || f.activity_level,
        exercise_preferences: pr.profile?.exercise_preferences || "",
        food_restrictions: pr.profile?.food_restrictions || "",
        start_weight_kg:
          f.start_weight_kg ||
          (pr.profile?.weight_kg != null ? String(pr.profile.weight_kg) : ""),
      }));
    } catch (e) {
      setError(e?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [apiOk]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadDashboard = useCallback(async () => {
    if (!apiOk || !activeGoal) return;
    const d = localToday();
    try {
      const dash = await apiRequest(`/me/goals/dashboard?date=${encodeURIComponent(d)}`);
      setDashboard(dash);
    } catch (e) {
      setError(e?.message || "Gagal memuat dashboard.");
    }
  }, [apiOk, activeGoal]);

  const loadProgress = useCallback(async () => {
    if (!apiOk || !activeGoal) return;
    try {
      const p = await apiRequest("/me/goals/progress?days=30");
      setProgress(p);
    } catch (e) {
      setError(e?.message || "Gagal memuat progres.");
    }
  }, [apiOk, activeGoal]);

  useEffect(() => {
    if (tab === "daily") loadDashboard();
  }, [tab, loadDashboard]);

  useEffect(() => {
    if (tab === "progress") loadProgress();
  }, [tab, loadProgress]);

  const handleGeneratePlan = async () => {
    if (!apiOk) {
      await Swal.fire({
        icon: "info",
        title: "API belum siap",
        text: "Set VITE_API_URL dan jalankan server + migrasi goal.",
        confirmButtonColor: SWAL_CONFIRM,
      });
      return;
    }

    const { items, allOk } = evaluateGoalForm(form, selectedCode, goalTypes);
    if (!allOk) {
      await Swal.fire({
        icon: "warning",
        title: "Form belum lengkap",
        html: swalFormIncompleteHtml(items),
        confirmButtonText: "Mengerti",
        confirmButtonColor: SWAL_CONFIRM,
        width: "min(100vw - 24px, 400px)",
      });
      return;
    }

    const code = String(selectedCode || "").trim();
    const h = parseFloat(String(form.height_cm).replace(",", "."));
    const w = parseFloat(String(form.weight_kg).replace(",", "."));
    const sw = parseFloat(String(form.start_weight_kg).replace(",", "."));
    const tw = parseFloat(String(form.target_weight_kg).replace(",", "."));

    setSaving(true);
    setError("");
    try {
      await apiRequest("/me/profile", {
        method: "PUT",
        json: {
          gender: form.gender,
          height_cm: h,
          weight_kg: w,
          activity_level: form.activity_level,
          exercise_preferences: form.exercise_preferences?.trim() || undefined,
          food_restrictions: form.food_restrictions?.trim() || undefined,
        },
      });

      /** @type {Record<string, unknown>} */
      const body = {
        goal_type_code: code,
        goal_name: form.goal_name?.trim() || undefined,
        start_date: form.start_date,
        target_date: form.target_date,
        start_weight_kg: sw,
        target_weight_kg: tw,
        intensity_level: form.intensity_level,
        activity_level: form.activity_level,
        exercise_preferences: form.exercise_preferences?.trim() || undefined,
        food_restrictions: form.food_restrictions?.trim() || undefined,
      };
      const age = parseInt(String(form.age_years).trim(), 10);
      if (Number.isFinite(age) && age >= 15 && age <= 100) body.age_years = age;

      const res = await apiRequest("/me/goals", { method: "POST", json: body });
      setDraftGoalId(res.goal.id);
      const sum = await apiRequest(`/me/goals/${encodeURIComponent(res.goal.id)}/summary`);
      setSummary(sum);
      setPlanStep("summary");
      await loadAll();

      await Swal.fire({
        icon: "success",
        title: "Rencana berhasil dibuat",
        text: "Tinjau ringkasan lalu klik Aktifkan Goal bila sudah sesuai.",
        confirmButtonText: "Oke",
        confirmButtonColor: SWAL_CONFIRM,
      });
    } catch (e) {
      const msg = e?.message || "Gagal membuat rencana.";
      setError(msg);
      await Swal.fire({
        icon: "error",
        title: "Gagal membuat rencana",
        text: msg,
        confirmButtonColor: SWAL_CONFIRM,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!draftGoalId || !apiOk) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/me/goals/${encodeURIComponent(draftGoalId)}/activate`, { method: "POST" });
      setPlanStep("pick");
      setDraftGoalId(null);
      setSummary(null);
      setSelectedCode("");
      await loadAll();
      setTab("daily");
      await Swal.fire({
        icon: "success",
        title: "Goal diaktifkan",
        text: "Silakan cek tab Hari ini untuk target dan skor harian.",
        confirmButtonText: "Oke",
        confirmButtonColor: SWAL_CONFIRM,
      });
    } catch (e) {
      const msg = e?.message || "Gagal mengaktifkan goal.";
      setError(msg);
      await Swal.fire({
        icon: "error",
        title: "Gagal mengaktifkan",
        text: msg,
        confirmButtonColor: SWAL_CONFIRM,
      });
    } finally {
      setSaving(false);
    }
  };

  const aggressiveWarn = form.intensity_level === "aggressive";

  const lastScores = useMemo(() => {
    const arr = progress?.scores || [];
    return arr.slice(-7);
  }, [progress]);

  const maxScore = useMemo(() => {
    const m = Math.max(1, ...lastScores.map((s) => Number(s.total_score) || 0));
    return m;
  }, [lastScores]);

  return (
    <div className="bg-surface text-on-surface antialiased max-w-[375px] mx-auto min-h-screen relative pb-28">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-emerald-50/80 backdrop-blur-xl no-border shadow-none max-w-[375px] mx-auto">
        <Link
          to="/home"
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-emerald-100/50 transition-colors active:scale-95 duration-150"
        >
          <span className="material-symbols-outlined text-emerald-700">arrow_back</span>
        </Link>
        <span className="text-2xl font-black tracking-tighter text-emerald-800">Goal Planner</span>
        <button
          type="button"
          onClick={() => loadAll()}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-emerald-100/50 transition-colors"
        >
          <span className="material-symbols-outlined text-emerald-700">refresh</span>
        </button>
      </header>

      <main className="pt-20 px-4">
        <div className="flex rounded-2xl bg-surface-container-low p-1 mb-4 border border-outline-variant/10">
          {[
            { id: "plan", label: "Rencana" },
            { id: "daily", label: "Hari ini" },
            { id: "progress", label: "Progres" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                tab === t.id ? "bg-primary text-white shadow-md shadow-primary/20" : "text-on-surface-variant"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!apiOk && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
            Backend API belum dikonfigurasi. Tambahkan <code className="text-xs">VITE_API_URL</code> dan jalankan migrasi MySQL{" "}
            <code className="text-xs">006_goal_planner.sql</code>.
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="size-10 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
            <p className="text-sm font-semibold text-emerald-700">Memuat…</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 mb-4">{error}</div>
        )}

        {!loading && tab === "plan" && (
          <div className="space-y-4 pb-8">
            {activeGoal && (
              <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Goal aktif</p>
                <p className="font-bold text-on-surface mt-1">{activeGoal.goal_name}</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {activeGoal.start_date} → {activeGoal.target_date} · {activeGoal.goal_type_name}
                </p>
              </div>
            )}

            {planStep === "pick" && (
              <>
                <h2 className="text-lg font-extrabold text-on-surface px-1">Pilih tujuanmu</h2>
                <div className="grid grid-cols-1 gap-3">
                  {goalTypes.length === 0 && apiOk && (
                    <p className="text-sm text-on-surface-variant px-1">Belum ada tipe goal. Jalankan seed migrasi.</p>
                  )}
                  {goalTypes.map((g) => (
                    <button
                      key={g.code}
                      type="button"
                      onClick={() => {
                        setSelectedCode(g.code);
                        setPlanStep("form");
                      }}
                      className={`text-left rounded-2xl border p-4 flex gap-3 transition-colors ${
                        selectedCode === g.code
                          ? "border-primary bg-primary/5"
                          : "border-outline-variant/20 bg-white shadow-sm"
                      }`}
                    >
                      <div className="size-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0">
                        <span className="material-symbols-outlined">
                          {GOAL_ICONS[g.code] || "flag"}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold">{g.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{g.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {planStep === "form" && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setPlanStep("pick")}
                  className="text-sm font-semibold text-primary flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span> Ganti tipe goal
                </button>

                <section className="rounded-2xl bg-white border border-slate-100 p-4 space-y-3 shadow-sm">
                  <h3 className="font-bold text-sm">Data fisik & profil</h3>
                  <p className="text-xs text-on-surface-variant">
                    Data ini disimpan ke profil Anda untuk perhitungan BMR/TDEE.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-semibold col-span-2">
                      Gender
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={form.gender}
                        onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                      >
                        <option value="">Pilih</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold">
                      Tinggi (cm)
                      <input
                        type="number"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={form.height_cm}
                        onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      Berat profil (kg)
                      <input
                        type="number"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={form.weight_kg}
                        onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                      />
                    </label>
                    <label className="text-xs font-semibold col-span-2">
                      Usia (jika tidak ada di data karyawan)
                      <input
                        type="number"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Opsional"
                        value={form.age_years}
                        onChange={(e) => setForm((f) => ({ ...f, age_years: e.target.value }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl bg-white border border-slate-100 p-4 space-y-3 shadow-sm">
                  <h3 className="font-bold text-sm">Target goal</h3>
                  <label className="text-xs font-semibold block">
                    Nama goal (opsional)
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={form.goal_name}
                      onChange={(e) => setForm((f) => ({ ...f, goal_name: e.target.value }))}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-semibold">
                      Mulai
                      <input
                        type="date"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
                        value={form.start_date}
                        onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      Selesai
                      <input
                        type="date"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
                        value={form.target_date}
                        onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      Berat awal (kg)
                      <input
                        type="number"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={form.start_weight_kg}
                        onChange={(e) => setForm((f) => ({ ...f, start_weight_kg: e.target.value }))}
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      Target berat (kg)
                      <input
                        type="number"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={form.target_weight_kg}
                        onChange={(e) => setForm((f) => ({ ...f, target_weight_kg: e.target.value }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl bg-white border border-slate-100 p-4 space-y-3 shadow-sm">
                  <h3 className="font-bold text-sm">Intensitas & aktivitas</h3>
                  <div className="flex flex-wrap gap-2">
                    {["easy", "normal", "aggressive"].map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, intensity_level: i }))}
                        className={`px-4 py-2 rounded-full text-xs font-bold capitalize border ${
                          form.intensity_level === i
                            ? "bg-primary text-white border-primary"
                            : "bg-surface-container-low border-slate-200"
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  {aggressiveWarn && (
                    <p className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3 border border-amber-100">
                      Intensitas agresif menyesuaikan defisit/surplus lebih kuat. Pastikan Anda sehat cukup dan konsultasi
                      profesional bila perlu.
                    </p>
                  )}
                  <label className="text-xs font-semibold block">
                    Level aktivitas harian
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={form.activity_level}
                      onChange={(e) => setForm((f) => ({ ...f, activity_level: e.target.value }))}
                    >
                      <option value="low">Rendah (kerja mostly duduk)</option>
                      <option value="moderate">Sedang</option>
                      <option value="high">Tinggi</option>
                      <option value="very_high">Sangat tinggi</option>
                    </select>
                  </label>
                </section>

                <section className="rounded-2xl bg-white border border-slate-100 p-4 space-y-3 shadow-sm">
                  <h3 className="font-bold text-sm">Preferensi</h3>
                  <label className="text-xs font-semibold block">
                    Olahraga favorit
                    <textarea
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[72px]"
                      placeholder="Mis. jalan cepat, renang, gym"
                      value={form.exercise_preferences}
                      onChange={(e) => setForm((f) => ({ ...f, exercise_preferences: e.target.value }))}
                    />
                  </label>
                  <label className="text-xs font-semibold block">
                    Pantangan makanan
                    <textarea
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[72px]"
                      placeholder="Mis. seafood, kacang, susu"
                      value={form.food_restrictions}
                      onChange={(e) => setForm((f) => ({ ...f, food_restrictions: e.target.value }))}
                    />
                  </label>
                </section>

                <button
                  type="button"
                  disabled={saving || !apiOk}
                  onClick={handleGeneratePlan}
                  className="w-full h-14 rounded-full bg-gradient-to-br from-primary-container to-primary text-white font-bold text-lg shadow-[0_8px_24px_rgba(0,106,63,0.3)] disabled:opacity-50"
                >
                  {saving ? "Menyimpan…" : "Generate My Plan"}
                </button>
              </div>
            )}

            {planStep === "summary" && summary && (
              <div className="space-y-4 pb-8">
                <h2 className="text-xl font-extrabold">Ringkasan rencana</h2>
                <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm space-y-2">
                  <p className="font-bold text-lg">{summary.goal.goal_name}</p>
                  <p className="text-sm text-on-surface-variant">
                    {summary.goal.start_date} → {summary.goal.target_date}
                  </p>
                  <p className="text-sm">
                    Berat {summary.goal.start_weight_kg} kg → target {summary.goal.target_weight_kg} kg
                  </p>
                  {summary.sample_daily_target && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-emerald-50/50 p-3">
                        <p className="text-[10px] font-bold text-emerald-800 uppercase">Kalori/hari</p>
                        <p className="font-black text-lg text-emerald-900">
                          {Math.round(summary.sample_daily_target.calorie_target)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase text-slate-600">Protein</p>
                        <p className="font-bold">{Math.round(summary.sample_daily_target.protein_target_g)} g</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase text-slate-600">Karbo</p>
                        <p className="font-bold">{Math.round(summary.sample_daily_target.carb_target_g)} g</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase text-slate-600">Lemak</p>
                        <p className="font-bold">{Math.round(summary.sample_daily_target.fat_target_g)} g</p>
                      </div>
                      <div className="col-span-2 rounded-xl bg-slate-50 p-3 flex justify-between text-sm">
                        <span className="text-on-surface-variant">Latihan (menit/hari)</span>
                        <span className="font-bold">{summary.sample_daily_target.exercise_duration_target_min} min</span>
                      </div>
                      <div className="col-span-2 rounded-xl bg-slate-50 p-3 flex justify-between text-sm">
                        <span className="text-on-surface-variant">Target langkah</span>
                        <span className="font-bold">{summary.sample_daily_target.step_target}</span>
                      </div>
                    </div>
                  )}
                </div>

                {summary.milestones?.length > 0 && (
                  <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                    <p className="font-bold text-sm mb-2">Milestone mingguan</p>
                    <ul className="space-y-2 text-sm">
                      {summary.milestones.slice(0, 6).map((m) => (
                        <li key={m.milestone_date} className="flex justify-between border-b border-slate-50 pb-2">
                          <span className="text-on-surface-variant">{m.milestone_date}</span>
                          <span className="font-semibold">~{m.expected_weight_kg} kg</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleActivate}
                  className="w-full h-14 rounded-full bg-primary text-white font-bold shadow-lg disabled:opacity-50"
                >
                  Aktifkan Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlanStep("form");
                  }}
                  className="w-full h-12 rounded-full border border-slate-200 font-semibold text-sm"
                >
                  Ubah form
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && tab === "daily" && (
          <div className="space-y-4 pb-8">
            {!activeGoal && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-400">flag</span>
                <p className="mt-2 font-bold text-on-surface">Belum ada goal aktif</p>
                <p className="text-sm text-on-surface-variant mt-1">Buat rencana di tab Rencana lalu aktifkan.</p>
                <button
                  type="button"
                  onClick={() => setTab("plan")}
                  className="mt-4 px-6 py-3 rounded-full bg-primary text-white text-sm font-bold"
                >
                  Ke Rencana
                </button>
              </div>
            )}

            {activeGoal && !dashboard && (
              <div className="flex justify-center py-12">
                <div className="size-9 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
              </div>
            )}

            {activeGoal && dashboard && (
              <>
                <div className="rounded-2xl bg-gradient-to-br from-primary-container to-primary text-white p-5 shadow-lg">
                  <p className="text-xs font-bold uppercase opacity-80">Health score hari ini</p>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-5xl font-black">
                      {dashboard.score ? Math.round(dashboard.score.total_score) : "—"}
                    </span>
                    <span className="text-lg opacity-80 mb-1">/100</span>
                  </div>
                  {dashboard.score && (
                    <span
                      className={`inline-block mt-3 text-xs font-bold px-3 py-1 rounded-full ${categoryLabel(dashboard.score.category).cls}`}
                    >
                      {categoryLabel(dashboard.score.category).text}
                    </span>
                  )}
                </div>

                {dashboard.daily_target && (
                  <>
                    <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm space-y-3">
                      <h3 className="font-bold text-sm">Kalori</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Aktual</span>
                        <span className="font-bold">{Math.round(dashboard.actuals?.calorie || 0)} kcal</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Target</span>
                        <span className="font-bold">{Math.round(dashboard.daily_target.calorie_target)} kcal</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (dashboard.daily_target.calorie_target > 0
                                ? ((dashboard.actuals?.calorie || 0) / dashboard.daily_target.calorie_target) * 100
                                : 0)
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Sisa kalori:{" "}
                        <span className="font-bold text-on-surface">
                          {Math.round(
                            Math.max(0, dashboard.daily_target.calorie_target - (dashboard.actuals?.calorie || 0))
                          )}{" "}
                          kcal
                        </span>
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                      <h3 className="font-bold text-sm mb-2">Protein & olahraga</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-on-surface-variant text-xs">Protein aktual</p>
                          <p className="font-bold">{Math.round(dashboard.actuals?.protein_g || 0)} g</p>
                          <p className="text-xs text-on-surface-variant mt-1">
                            Target {Math.round(dashboard.daily_target.protein_target_g)} g
                          </p>
                          <p className="text-xs font-semibold text-primary mt-1">
                            Gap:{" "}
                            {Math.round(dashboard.daily_target.protein_target_g - (dashboard.actuals?.protein_g || 0))}{" "}
                            g
                          </p>
                        </div>
                        <div>
                          <p className="text-on-surface-variant text-xs">Olahraga</p>
                          <p className="font-bold">{dashboard.actuals?.exercise_min || 0} min</p>
                          <p className="text-xs text-on-surface-variant mt-1">
                            Target {dashboard.daily_target.exercise_duration_target_min} min
                          </p>
                          <p className="text-xs font-semibold text-primary mt-1">
                            Gap:{" "}
                            {Math.max(
                              0,
                              dashboard.daily_target.exercise_duration_target_min -
                                (dashboard.actuals?.exercise_min || 0)
                            )}{" "}
                            min
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-sm">
                        <span className="text-on-surface-variant">Langkah (target)</span>
                        <span className="font-bold">{dashboard.daily_target.step_target}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Aktual langkah memerlukan integrasi perangkat; fokus ke log olahraga dari foto.
                      </p>
                    </div>
                  </>
                )}

                {!dashboard.daily_target && (
                  <p className="text-sm text-on-surface-variant">
                    Tanggal hari ini di luar rentang goal atau target harian belum tersedia.
                  </p>
                )}

                <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                  <h3 className="font-bold text-sm mb-2">Rekomendasi hari ini</h3>
                  {!dashboard.recommendations?.length && (
                    <p className="text-sm text-on-surface-variant">Tidak ada rekomendasi baru. Pertahankan!</p>
                  )}
                  <ul className="space-y-3">
                    {dashboard.recommendations?.map((r) => (
                      <li key={r.id} className="rounded-xl bg-emerald-50/40 border border-emerald-100/50 p-3">
                        <p className="text-[10px] font-bold uppercase text-emerald-800">{r.category}</p>
                        <p className="font-bold text-sm mt-0.5">{r.title}</p>
                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{r.body}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => loadDashboard()}
                  className="w-full h-12 rounded-xl border border-slate-200 font-semibold text-sm"
                >
                  Muat ulang hari ini
                </button>
              </>
            )}
          </div>
        )}

        {!loading && tab === "progress" && (
          <div className="space-y-4 pb-8">
            {!activeGoal && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-on-surface-variant">
                Aktifkan goal untuk melihat progres.
              </div>
            )}

            {activeGoal && progress && (
              <>
                <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase">Penyelesaian perkiraan</p>
                    <p className="text-3xl font-black text-primary mt-1">{progress.completion_percent}%</p>
                  </div>
                  <div className="h-16 w-16 rounded-full border-4 border-emerald-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600 text-3xl">timeline</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                  <h3 className="font-bold text-sm mb-3">Health score (7 hari terakhir)</h3>
                  {lastScores.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Belum ada data skor. Buka tab Hari ini untuk menghitung.</p>
                  ) : (
                    <div className="flex items-end gap-1 h-28">
                      {lastScores.map((s) => {
                        const h = (Number(s.total_score) / maxScore) * 100;
                        return (
                          <div key={s.date} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-20">
                              <div
                                className="bg-primary w-full rounded-t-lg transition-all min-h-[4px]"
                                style={{ height: `${h}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-on-surface-variant truncate w-full text-center">
                              {s.date?.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                  <h3 className="font-bold text-sm mb-2">Milestone</h3>
                  {!progress.milestones?.length && (
                    <p className="text-xs text-on-surface-variant">Tidak ada milestone (rentang terlalu pendek).</p>
                  )}
                  <ul className="space-y-2 text-sm">
                    {progress.milestones?.map((m) => (
                      <li key={m.milestone_date} className="flex justify-between">
                        <span>{m.milestone_date}</span>
                        <span className="font-semibold">~{m.expected_weight_kg} kg</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
