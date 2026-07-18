import { useEffect, useState } from "react";
import { logWorkoutItem } from "../../lib/workoutLogApi";
import { showError, showSuccess } from "../../lib/appAlert";

const ACCENT = "#006a3f";

const PRESETS = [
  "Lari",
  "Jalan Kaki",
  "Bersepeda",
  "Gym / Strength",
  "Yoga",
  "Renang",
  "Badminton",
  "Padel",
  "HIIT",
];

const EMPTY_FORM = {
  activity_type: "",
  calories: "",
  duration_min: "",
  distance: "",
  avg_heart_rate: "",
  notes: "",
};

/**
 * Bottom sheet input olahraga manual.
 */
export default function WorkoutManualSheet({ open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setError("");
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const name = form.activity_type.trim();
      await logWorkoutItem({
        activity_type: name,
        calories: Number(form.calories) || 0,
        duration_min: form.duration_min === "" ? null : Number(form.duration_min),
        distance: form.distance.trim() || null,
        avg_heart_rate: form.avg_heart_rate.trim() || null,
        notes: form.notes.trim() || null,
      });
      showSuccess("Olahraga tersimpan", `${name} berhasil dicatat.`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan.");
      showError("Gagal menyimpan", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Tutup"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-base font-bold text-slate-900">Input Manual</p>
            <p className="text-[11px] text-slate-500">Catat olahraga yang sudah dilakukan</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm((f) => ({ ...f, activity_type: p }))}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ${
                  form.activity_type === p
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-slate-50 text-slate-600 ring-slate-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Jenis olahraga</span>
              <input
                required
                value={form.activity_type}
                onChange={(e) => setForm((f) => ({ ...f, activity_type: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                placeholder="Lari pagi"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
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
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Durasi (menit)</span>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.duration_min}
                  onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                  placeholder="30"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Jarak (opsional)</span>
                <input
                  value={form.distance}
                  onChange={(e) => setForm((f) => ({ ...f, distance: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                  placeholder="5 km"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Avg HR (opsional)</span>
                <input
                  value={form.avg_heart_rate}
                  onChange={(e) => setForm((f) => ({ ...f, avg_heart_rate: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                  placeholder="140 bpm"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Catatan</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                placeholder="Opsional"
              />
            </label>
            {error ? <p className="text-xs text-red-500">{error}</p> : null}
          </div>

          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
