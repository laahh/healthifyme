import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getStoredMealType, logFoodItem, setStoredMealType } from "../../lib/foodLogApi";
import { showError, showSuccess, showWarning, showToast } from "../../lib/appAlert";
import { hasHealthAlerts, healthAlertSeverity } from "../../lib/healthAlertApi";

const ACCENT = "#2563eb";

export default function FoodManualContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mealFromQs = searchParams.get("meal");
  const meal =
    ["breakfast", "lunch", "dinner", "snack"].includes(mealFromQs || "")
      ? mealFromQs
      : getStoredMealType();

  const [form, setForm] = useState({
    food_name: "",
    calories: "",
    protein_g: "",
    fats_g: "",
    carbs_g: "",
    serving_label: "1 porsi",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      setStoredMealType(meal);
      const res = await logFoodItem({
        food_name: form.food_name.trim(),
        calories: Number(form.calories) || 0,
        protein_g: form.protein_g === "" ? null : Number(form.protein_g),
        fats_g: form.fats_g === "" ? null : Number(form.fats_g),
        carbs_g: form.carbs_g === "" ? null : Number(form.carbs_g),
        serving_label: form.serving_label || null,
        meal_type: meal,
        source_type: "manual",
      });
      const alert = res?.healthAlert;
      if (hasHealthAlerts(alert)) {
        const sev = healthAlertSeverity(alert);
        if (sev === "high" || sev === "warning") {
          await showWarning(
            alert.primary?.title || "Peringatan MCU",
            alert.primary?.message || ""
          );
        } else {
          showToast(alert.primary?.title || "Saran MCU", "info");
        }
      }
      showSuccess("Makanan tersimpan", `${form.food_name.trim()} berhasil dicatat.`);
      navigate("/food", { replace: true });
    } catch (err) {
      setError(err?.message || "Gagal menyimpan.");
      showError("Gagal menyimpan", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#f3f4f6] font-['Public_Sans',sans-serif]">
      <header className="flex shrink-0 items-center gap-2 bg-white px-3 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] shadow-sm">
        <Link to="/food" className="flex size-10 items-center justify-center rounded-full text-slate-700">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Quick add</h1>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Nama makanan</span>
            <input
              required
              value={form.food_name}
              onChange={(e) => setForm((f) => ({ ...f, food_name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              placeholder="Nasi goreng"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Kalori (kkal)</span>
            <input
              required
              type="number"
              min={0}
              step="1"
              value={form.calories}
              onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["protein_g", "Protein (g)"],
              ["fats_g", "Lemak (g)"],
              ["carbs_g", "Karbo (g)"],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-[10px] font-semibold text-slate-600">{label}</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm outline-none"
                />
              </label>
            ))}
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Porsi</span>
            <input
              value={form.serving_label}
              onChange={(e) => setForm((f) => ({ ...f, serving_label: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            />
          </label>
          <p className="text-[11px] text-slate-500">Meal: <span className="font-semibold capitalize">{meal}</span></p>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </form>
      </main>
    </div>
  );
}
