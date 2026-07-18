import { useEffect, useState } from "react";
import { fetchCommunitySports, FALLBACK_HUB } from "../../lib/communityApi";
import { showError } from "../../lib/appAlert";

const ACCENT = "#8B1E2D";
const OTHER_KEY = "__other__";

const FALLBACK_SPORTS = (FALLBACK_HUB.sports || []).map((s) => ({
  sport_key: s.sport_key,
  name: s.name,
}));

/**
 * Bottom sheet form untuk buat aktivitas komunitas.
 * Olahraga bisa dipilih dari list atau diketik manual.
 */
export default function CommunityCreateEventSheet({ open, onClose, onSubmit, defaultSportKey, busy }) {
  const [sports, setSports] = useState(FALLBACK_SPORTS);
  const [form, setForm] = useState({
    title: "",
    sport_key: "",
    sport_custom: "",
    event_type: "open_play",
    starts_at: "",
    place: "",
    capacity: "20",
    fee_note: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchCommunitySports()
      .then((d) => {
        const list = (d.sports || []).map((s) => ({
          sport_key: s.sport_key,
          name: s.name,
        }));
        if (!cancelled && list.length) setSports(list);
      })
      .catch(() => {
        if (!cancelled) setSports(FALLBACK_SPORTS);
      });
    setForm((f) => ({
      ...f,
      sport_key: f.sport_key || defaultSportKey || "",
    }));
    setError("");
    return () => {
      cancelled = true;
    };
  }, [open, defaultSportKey]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isOther = form.sport_key === OTHER_KEY;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.starts_at) {
      setError("Judul dan waktu wajib diisi.");
      return;
    }
    if (!form.sport_key) {
      setError("Pilih olahraga / aktivitas.");
      return;
    }
    if (isOther && !form.sport_custom.trim()) {
      setError("Ketik nama olahraga / aktivitas.");
      return;
    }
    try {
      const iso = new Date(form.starts_at).toISOString();
      await onSubmit({
        title: form.title.trim(),
        sport_key: isOther ? OTHER_KEY : form.sport_key,
        sport_custom: isOther ? form.sport_custom.trim() : undefined,
        event_type: form.event_type,
        starts_at: iso,
        place: form.place.trim() || undefined,
        capacity: Number(form.capacity) || 20,
        fee_note: form.fee_note.trim() || undefined,
      });
      setForm({
        title: "",
        sport_key: defaultSportKey || "",
        sport_custom: "",
        event_type: "open_play",
        starts_at: "",
        place: "",
        capacity: "20",
        fee_note: "",
      });
    } catch (err) {
      setError(err?.message || "Gagal membuat aktivitas.");
      showError("Gagal membuat aktivitas", err?.message || "");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <button type="button" className="absolute inset-0" aria-label="Tutup" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">Buat aktivitas</h3>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full text-slate-500">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Judul</span>
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
              placeholder="Open Play Minggu Pagi"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Olahraga / aktivitas</span>
            <select
              required
              value={form.sport_key}
              onChange={(e) => set("sport_key", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="">Pilih olahraga…</option>
              {sports.map((s) => (
                <option key={s.sport_key} value={s.sport_key}>
                  {s.name}
                </option>
              ))}
              <option value={OTHER_KEY}>Lainnya (ketik manual)</option>
            </select>
          </label>
          {isOther ? (
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Nama olahraga / aktivitas</span>
              <input
                required
                value={form.sport_custom}
                onChange={(e) => set("sport_custom", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
                placeholder="Contoh: Sepak Takraw, Hiking, Yoga malam"
              />
            </label>
          ) : null}
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Tipe</span>
            <select
              value={form.event_type}
              onChange={(e) => set("event_type", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="open_play">Open Play</option>
              <option value="coaching">Coaching</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Waktu mulai</span>
            <input
              required
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => set("starts_at", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Lokasi</span>
            <input
              value={form.place}
              onChange={(e) => set("place", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Lapangan / venue"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Kapasitas</span>
              <input
                type="number"
                min={2}
                max={500}
                value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Biaya (opsional)</span>
              <input
                value={form.fee_note}
                onChange={(e) => set("fee_note", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="Rp 50rb"
              />
            </label>
          </div>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: ACCENT }}
          >
            {busy ? "Menyimpan…" : "Buat aktivitas"}
          </button>
        </form>
      </div>
    </div>
  );
}
