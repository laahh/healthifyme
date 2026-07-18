import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";
import { getSessionUser } from "../../auth/auth";
import { CommunityShell } from "../community/CommunityShell";
import GoalDailyPanel from "../goal/GoalDailyPanel";
import GoalProgressPanel from "../goal/GoalProgressPanel";

const SWAL_CONFIRM = "#006a3f";

const HERO_IMG =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1200&auto=format&fit=crop";

const GOAL_ICONS = {
  WEIGHT_LOSS: "monitor_weight",
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

/**
 * @param {Record<string, unknown>} form
 * @param {string} selectedCode
 * @param {{ code: string, name: string }[]} goalTypes
 * @returns {{ items: { label: string, ok: boolean, hint: string }[], allOk: boolean }}
 */
function evaluateGoalForm(form, selectedCode, goalTypes) {
  const code = String(selectedCode || "").trim();
  const typeName = goalTypes.find((g) => g.code === code)?.name || code || "â€”";
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
      hint: Number.isFinite(h) ? `${h} cm` : "Isi 100â€“250",
    },
    {
      label: "Berat badan profil (kg)",
      ok: Number.isFinite(w) && w >= 30 && w <= 300,
      hint: Number.isFinite(w) ? `${w} kg` : "Isi 30â€“300",
    },
    {
      label: "Tanggal mulai",
      ok: Boolean(startD && dateRe.test(startD)),
      hint: startD || "YYYY-MM-DD",
    },
    {
      label: "Tanggal selesai",
      ok: Boolean(endD && dateRe.test(endD) && (!startD || endD > startD)),
      hint: endD ? (startD && endD <= startD ? "Harus setelah tanggal mulai" : endD) : "YYYY-MM-DD",
    },
    {
      label: "Berat awal goal (kg)",
      ok: Number.isFinite(sw) && sw >= 30 && sw <= 300,
      hint: Number.isFinite(sw) ? `${sw} kg` : "Isi 30â€“300",
    },
    {
      label: "Target berat (kg)",
      ok: Number.isFinite(tw) && tw >= 30 && tw <= 300,
      hint: Number.isFinite(tw) ? `${tw} kg` : "Isi 30â€“300",
    },
  ];

  const age = parseInt(String(form.age_years ?? "").trim(), 10);
  if (String(form.age_years ?? "").trim()) {
    items.push({
      label: "Usia (opsional)",
      ok: Number.isFinite(age) && age >= 15 && age <= 100,
      hint: Number.isFinite(age) ? `${age} tahun` : "15â€“100 atau kosongkan",
    });
  }

  const allOk = items.every((i) => i.ok);
  return { items, allOk };
}

function swalFormIncompleteHtml(items) {
  const filled = items.filter((i) => i.ok);
  const missing = items.filter((i) => !i.ok);
  const row = (i, done) =>
    `<li style="margin:6px 0;line-height:1.35"><span style="color:${done ? "#006a3f" : "#b91c1c"};font-weight:700">${done ? "âœ“" : "â—‹"}</span> <strong>${i.label}</strong><br/><span style="font-size:12px;color:#64748b">${i.hint}</span></li>`;
  return `
    <div style="text-align:left;font-size:14px;max-height:55vh;overflow:auto">
      <p style="margin:0 0 8px;font-weight:700;color:#006a3f">Sudah diisi (${filled.length})</p>
      <ul style="margin:0 0 16px;padding-left:18px;list-style:none">${filled.map((i) => row(i, true)).join("") || '<li style="color:#64748b">â€”</li>'}</ul>
      <p style="margin:0 0 8px;font-weight:700;color:#b91c1c">Belum lengkap (${missing.length})</p>
      <ul style="margin:0;padding-left:18px;list-style:none">${missing.map((i) => row(i, false)).join("") || '<li style="color:#64748b">â€”</li>'}</ul>
    </div>`;
}

export default function GoalPlannerContent() {
  const navigate = useNavigate();
  const sessionUser = getSessionUser();
  const myUserId = sessionUser?.id != null ? String(sessionUser.id) : null;

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
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
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
    setDashboardLoading(true);
    try {
      const dash = await apiRequest(`/me/goals/dashboard?date=${encodeURIComponent(d)}`);
      if (dash?.user_id != null && myUserId != null && String(dash.user_id) !== myUserId) {
        setDashboard(null);
        setError("Sesi tidak cocok. Silakan muat ulang atau login kembali.");
        return;
      }
      setDashboard(dash);
    } catch (e) {
      setError(e?.message || "Gagal memuat dashboard.");
    } finally {
      setDashboardLoading(false);
    }
  }, [apiOk, activeGoal, myUserId]);

  const loadProgress = useCallback(async () => {
    if (!apiOk || !activeGoal) return;
    setProgressLoading(true);
    try {
      const p = await apiRequest("/me/goals/progress?days=30");
      if (p?.user_id != null && myUserId != null && String(p.user_id) !== myUserId) {
        setProgress(null);
        setError("Sesi tidak cocok. Silakan muat ulang atau login kembali.");
        return;
      }
      setProgress(p);
    } catch (e) {
      setError(e?.message || "Gagal memuat progres.");
    } finally {
      setProgressLoading(false);
    }
  }, [apiOk, activeGoal, myUserId]);

  useEffect(() => {
    if (tab === "daily") {
      setError("");
      loadDashboard();
    }
  }, [tab, loadDashboard]);

  useEffect(() => {
    if (tab === "progress") {
      setError("");
      loadProgress();
    }
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
        gender: form.gender || undefined,
        height_cm: Number.isFinite(h) ? h : undefined,
        weight_kg: Number.isFinite(w) ? w : undefined,
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

  const draftGoals = useMemo(() => goals.filter((g) => g.status === "draft"), [goals]);

  const handleContinueDraft = async (goalId) => {
    if (!goalId || !apiOk) return;
    setSaving(true);
    setError("");
    try {
      const sum = await apiRequest(`/me/goals/${encodeURIComponent(goalId)}/summary`);
      setDraftGoalId(goalId);
      setSummary(sum);
      setTab("plan");
      setPlanStep("summary");
    } catch (e) {
      const msg = e?.message || "Gagal memuat draft rencana.";
      setError(msg);
      await Swal.fire({
        icon: "error",
        title: "Gagal memuat draft",
        text: msg,
        confirmButtonColor: SWAL_CONFIRM,
      });
    } finally {
      setSaving(false);
    }
  };

  const goToScanWorkout = () => {
    navigate("/home", { state: { openActivityCapture: true } });
  };

  const goToScanFood = () => {
    navigate("/home", { state: { openFoodCapture: true } });
  };

  const aggressiveWarn = form.intensity_level === "aggressive";

  return (
    <CommunityShell className="bg-surface">
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface pb-[max(1.5rem,env(safe-area-inset-bottom))]">

        {/* â”€â”€ Hero â”€â”€ */}
        <section className="relative">
          <div className="relative h-[220px] overflow-hidden">
            <img
              src={HERO_IMG}
              alt=""
              className="absolute inset-0 size-full object-cover object-[center_30%]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/75" />
            <div className="relative z-10 flex h-full flex-col px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-14">
              <div className="flex items-center justify-between">
                <Link
                  to="/home"
                  className="flex size-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-[2px]"
                  aria-label="Kembali"
                >
                  <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </Link>
                <button
                  type="button"
                  onClick={() => loadAll()}
                  className="flex size-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-[2px]"
                  aria-label="Muat ulang"
                >
                  <span className="material-symbols-outlined text-[20px]">refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* icon bulat overlap hero â€” persis pola di gambar */}
          <div className="relative z-20 -mt-9 flex flex-col items-center">
            <div className="size-[72px] overflow-hidden rounded-full border-[3px] border-white bg-primary shadow-[0_4px_16px_rgba(15,23,42,0.22)] flex items-center justify-center">
              <span className="material-symbols-outlined text-[38px] text-white">fitness_center</span>
            </div>
            <h1 className="mt-3 text-[22px] font-extrabold leading-none tracking-tight text-slate-900">
              Goal Planner
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              {activeGoal ? activeGoal.goal_type_name : "Belum ada goal aktif"} Â· {activeGoal ? `${activeGoal.start_date} s/d ${activeGoal.target_date}` : "Buat rencana baru"}
            </p>
          </div>

          {/* â”€â”€ Tombol aksi â”€â”€ */}
          <div className="mt-4 flex gap-2.5 px-4">
            <button
              type="button"
              onClick={() => { setTab("plan"); setPlanStep("pick"); }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-primary py-2.5 text-[13px] font-bold text-primary active:scale-[0.99] transition-transform"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Buat Rencana
            </button>
            <button
              type="button"
              onClick={goToScanWorkout}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary/10 py-2.5 text-[13px] font-bold text-primary active:scale-[0.99] transition-transform"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              Scan Foto
            </button>
            <button
              type="button"
              onClick={goToScanFood}
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200 text-slate-700 active:scale-[0.99] transition-transform"
              aria-label="Log makanan"
            >
              <span className="material-symbols-outlined text-[20px]">restaurant</span>
            </button>
          </div>

          {/* â”€â”€ Stats bar â€” persis "1/8 Players Â· 7 Spots Â· Open" â”€â”€ */}
          <div className="mx-4 mt-3 flex items-center divide-x divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="flex flex-1 flex-col items-center py-3">
              <span className="text-[13px] font-extrabold text-slate-900">{activeGoal ? "1" : "0"}</span>
              <span className="mt-0.5 text-[10px] text-slate-500">Goal Aktif</span>
            </div>
            <div className="flex flex-1 flex-col items-center py-3">
              <span className="text-[13px] font-extrabold text-slate-900">{draftGoals.length}</span>
              <span className="mt-0.5 text-[10px] text-slate-500">Draft</span>
            </div>
            <div className="flex flex-1 flex-col items-center py-3">
              <span className="text-[13px] font-extrabold text-primary">
                {dashboard?.score ? Math.round(dashboard.score.total_score) : "â€”"}
              </span>
              <span className="mt-0.5 text-[10px] text-slate-500">Skor Hari Ini</span>
            </div>
          </div>

          {/* â”€â”€ Tab navigasi â”€â”€ */}
          <div className="mt-4 px-4">
            <div className="flex gap-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
              {[
                { id: "plan", label: "Rencana" },
                { id: "daily", label: "Hari ini" },
                { id: "progress", label: "Progres" },
              ].map((t, i, arr) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex flex-1 items-center justify-center py-2.5 text-[13px] font-bold transition-all ${
                    tab === t.id
                      ? "bg-primary text-white"
                      : "text-slate-500"
                  } ${
                    i < arr.length - 1 ? "border-r border-slate-100" : ""
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* â”€â”€ Konten tab â”€â”€ */}
        <div className="px-4 pt-4 space-y-3">

          {/* Aksi sekunder */}
          {tab === "plan" && planStep === "pick" && (
            <div className="flex gap-2.5">
              <Link
                to="/workout"
                className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-3 py-3 text-slate-800 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-[0.99] transition-transform"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[18px]">exercise</span>
                </span>
                <span className="text-[13px] font-semibold">Log Olahraga</span>
              </Link>
              <Link
                to="/food"
                className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-3 py-3 text-slate-800 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-[0.99] transition-transform"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[18px]">nutrition</span>
                </span>
                <span className="text-[13px] font-semibold">Log Makanan</span>
              </Link>
            </div>
          )}

          {!apiOk && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
              Backend API belum dikonfigurasi. Set <code className="text-[11px]">VITE_API_URL</code> dan pastikan migrasi goal sudah dijalankan.
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="size-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <p className="text-sm font-semibold text-slate-600">Memuatâ€¦</p>
            </div>
          )}

          {error && !loading && (
            <p className="mx-0 rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
              {error}
            </p>
          )}

          {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• TAB: RENCANA â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {!loading && tab === "plan" && (
            <div className="space-y-3 pb-6">

              {/* Goal aktif */}
              {activeGoal && (
                <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                  <div className="px-4 pt-4 pb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Goal aktif</p>
                    <p className="mt-1 text-[16px] font-extrabold text-slate-900">{activeGoal.goal_name}</p>
                  </div>
                  <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
                    <span className="material-symbols-outlined text-[20px] text-slate-400">flag</span>
                    <span className="flex-1 text-[13px] text-slate-600">{activeGoal.goal_type_name} Â· {activeGoal.start_date} â†’ {activeGoal.target_date}</span>
                    <button type="button" onClick={() => setTab("daily")} className="text-[12px] font-semibold text-primary">
                      Lihat
                    </button>
                  </div>
                </div>
              )}

              {/* Drafts */}
              {planStep === "pick" && draftGoals.length > 0 && (
                <div className="space-y-2">
                  <p className="px-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-500">Rencana draft</p>
                  {draftGoals.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                      <span className="material-symbols-outlined text-[20px] text-slate-400">draft</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-slate-900">{g.goal_name}</p>
                        <p className="text-[11px] text-slate-500">{g.start_date} â†’ {g.target_date}</p>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleContinueDraft(g.id)}
                        className="rounded-full border border-primary px-3 py-1 text-[11px] font-bold text-primary disabled:opacity-50"
                      >
                        Lanjutkan
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pilih tipe goal */}
              {planStep === "pick" && (
                <>
                  <p className="px-0.5 text-[17px] font-bold text-slate-900">Pilih tujuanmu</p>
                  {goalTypes.length === 0 && apiOk && (
                    <p className="rounded-2xl bg-white px-4 py-6 text-center text-[13px] text-slate-500 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                      Belum ada tipe goal. Jalankan seed migrasi.
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    {goalTypes.map((g) => (
                      <button
                        key={g.code}
                        type="button"
                        onClick={() => { setSelectedCode(g.code); setPlanStep("form"); }}
                        className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 transition-all active:scale-[0.99] ${
                          selectedCode === g.code ? "ring-primary/40" : "ring-slate-100"
                        }`}
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                          <span className="material-symbols-outlined text-[20px]">{GOAL_ICONS[g.code] || "flag"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-bold text-slate-900">{g.name}</p>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{g.description}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-300">chevron_right</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Form input */}
              {planStep === "form" && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setPlanStep("pick")}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Ganti tipe goal
                  </button>

                  {([
                    { icon: "person", title: "Data fisik & profil", sub: "Untuk perhitungan BMR/TDEE", content: (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="col-span-2 text-[11px] font-semibold text-slate-600">Gender
                          <select className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                            <option value="">Pilih</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                          </select>
                        </label>
                        <label className="text-[11px] font-semibold text-slate-600">Tinggi (cm)
                          <input type="number" className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))} />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-600">Berat profil (kg)
                          <input type="number" className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} />
                        </label>
                        <label className="col-span-2 text-[11px] font-semibold text-slate-600">Usia (opsional)
                          <input type="number" className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" placeholder="Jika tidak ada di data karyawan" value={form.age_years} onChange={(e) => setForm((f) => ({ ...f, age_years: e.target.value }))} />
                        </label>
                      </div>
                    )},
                    { icon: "flag", title: "Target goal", sub: "", content: (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-600">Nama goal (opsional)
                          <input className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.goal_name} onChange={(e) => setForm((f) => ({ ...f, goal_name: e.target.value }))} />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[11px] font-semibold text-slate-600">Mulai
                            <input type="date" className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-2 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
                          </label>
                          <label className="text-[11px] font-semibold text-slate-600">Selesai
                            <input type="date" className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-2 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} />
                          </label>
                          <label className="text-[11px] font-semibold text-slate-600">Berat awal (kg)
                            <input type="number" className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.start_weight_kg} onChange={(e) => setForm((f) => ({ ...f, start_weight_kg: e.target.value }))} />
                          </label>
                          <label className="text-[11px] font-semibold text-slate-600">Target berat (kg)
                            <input type="number" className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.target_weight_kg} onChange={(e) => setForm((f) => ({ ...f, target_weight_kg: e.target.value }))} />
                          </label>
                        </div>
                      </div>
                    )},
                    { icon: "bolt", title: "Intensitas & aktivitas", sub: "", content: (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {["easy","normal","aggressive"].map((i) => (
                            <button key={i} type="button" onClick={() => setForm((f) => ({ ...f, intensity_level: i }))}
                              className={`rounded-full px-4 py-2 text-[12px] font-bold capitalize transition-colors ${
                                form.intensity_level === i ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
                              }`}>{i}</button>
                          ))}
                        </div>
                        {aggressiveWarn && (
                          <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                            Intensitas agresif menyesuaikan defisit/surplus lebih kuat. Pastikan Anda sehat cukup.
                          </p>
                        )}
                        <label className="block text-[11px] font-semibold text-slate-600">Level aktivitas harian
                          <select className="mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" value={form.activity_level} onChange={(e) => setForm((f) => ({ ...f, activity_level: e.target.value }))}>
                            <option value="low">Rendah (kerja mostly duduk)</option>
                            <option value="moderate">Sedang</option>
                            <option value="high">Tinggi</option>
                            <option value="very_high">Sangat tinggi</option>
                          </select>
                        </label>
                      </div>
                    )},
                    { icon: "tune", title: "Preferensi", sub: "", content: (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-600">Olahraga favorit
                          <textarea className="mt-1 min-h-[72px] w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" placeholder="Mis. jalan cepat, renang, gym" value={form.exercise_preferences} onChange={(e) => setForm((f) => ({ ...f, exercise_preferences: e.target.value }))} />
                        </label>
                        <label className="block text-[11px] font-semibold text-slate-600">Pantangan makanan
                          <textarea className="mt-1 min-h-[72px] w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" placeholder="Mis. seafood, kacang, susu" value={form.food_restrictions} onChange={(e) => setForm((f) => ({ ...f, food_restrictions: e.target.value }))} />
                        </label>
                      </div>
                    )},
                  ] ).map((sec) => (
                    <div key={sec.title} className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
                          <span className="material-symbols-outlined text-[16px]">{sec.icon}</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-900">{sec.title}</p>
                          {sec.sub && <p className="text-[11px] text-slate-500">{sec.sub}</p>}
                        </div>
                      </div>
                      <div className="p-4">{sec.content}</div>
                    </div>
                  ))}

                  <button
                    type="button"
                    disabled={saving || !apiOk}
                    onClick={handleGeneratePlan}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-bold text-white shadow-xl shadow-primary/30 disabled:opacity-50 active:scale-[0.99]"
                  >
                    <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                    {saving ? "Menyimpanâ€¦" : "Generate My Plan"}
                  </button>
                </div>
              )}

              {/* Summary */}
              {planStep === "summary" && summary && (
                <div className="space-y-3 pb-6">
                  <p className="px-0.5 text-[17px] font-bold text-slate-900">Ringkasan rencana</p>
                  <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                    <div className="bg-primary px-4 py-4 text-white">
                      <p className="text-[16px] font-extrabold leading-tight">{summary.goal.goal_name}</p>
                      <p className="mt-1 text-[12px] text-white/75">{summary.goal.start_date} â†’ {summary.goal.target_date}</p>
                      <p className="mt-1.5 text-[13px] font-semibold text-white/90">{summary.goal.start_weight_kg} kg â†’ {summary.goal.target_weight_kg} kg</p>
                    </div>
                    {summary.sample_daily_target && (
                      <div className="grid grid-cols-2 gap-2 p-3">
                        {[
                          { label: "Kalori/hari", val: `${Math.round(summary.sample_daily_target.calorie_target)} kcal`, accent: true },
                          { label: "Protein", val: `${Math.round(summary.sample_daily_target.protein_target_g)} g` },
                          { label: "Karbo", val: `${Math.round(summary.sample_daily_target.carb_target_g)} g` },
                          { label: "Lemak", val: `${Math.round(summary.sample_daily_target.fat_target_g)} g` },
                        ].map((item) => (
                          <div key={item.label} className={`rounded-xl p-3 ${ item.accent ? "bg-primary/10" : "bg-slate-50" }`}>
                            <p className={`text-[10px] font-bold uppercase ${ item.accent ? "text-primary" : "text-slate-600" }`}>{item.label}</p>
                            <p className={`mt-1 font-black ${ item.accent ? "text-primary" : "text-slate-900" }`}>{item.val}</p>
                          </div>
                        ))}
                        <div className="col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-[13px]">
                          <span className="text-slate-500">Latihan / hari</span>
                          <span className="font-bold">{summary.sample_daily_target.exercise_duration_target_min} min</span>
                        </div>
                        <div className="col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-[13px]">
                          <span className="text-slate-500">Target langkah</span>
                          <span className="font-bold">{summary.sample_daily_target.step_target}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {summary.milestones?.length > 0 && (
                    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                      <p className="mb-2 text-[14px] font-bold text-slate-900">Milestone mingguan</p>
                      <ul className="space-y-2 text-[13px]">
                        {summary.milestones.slice(0, 6).map((m) => (
                          <li key={m.milestone_date} className="flex justify-between border-b border-slate-50 pb-2 last:border-0">
                            <span className="text-slate-500">{m.milestone_date}</span>
                            <span className="font-semibold text-slate-900">~{m.expected_weight_kg} kg</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button type="button" disabled={saving} onClick={handleActivate}
                    className="w-full rounded-2xl bg-primary py-3.5 text-[15px] font-bold text-white shadow-xl shadow-primary/30 disabled:opacity-50">
                    Aktifkan Goal
                  </button>
                  <button type="button" onClick={() => setPlanStep("form")}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-[13px] font-semibold text-slate-700">
                    Ubah form
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: HARI INI */}
          {!loading && tab === "daily" && (
            <GoalDailyPanel
              activeGoal={activeGoal}
              dashboard={dashboard}
              loading={dashboardLoading}
              onGoPlan={() => setTab("plan")}
              onRefresh={() => loadDashboard()}
            />
          )}

          {/* TAB: PROGRES */}
          {!loading && tab === "progress" && (
            <GoalProgressPanel
              activeGoal={activeGoal}
              progress={progress}
              loading={progressLoading}
              onGoPlan={() => setTab("plan")}
            />
          )}

        </div>
      </div>
    </CommunityShell>
  );
}
