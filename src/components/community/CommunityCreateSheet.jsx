import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCommunity, fetchCommunitySports } from "../../lib/communityApi";
import { showError, showSuccess } from "../../lib/appAlert";
import { compressDataUrlForAi } from "../../lib/imageCompressForAi";

const ACCENT = "#8B1E2D";
const OTHER_KEY = "__other__";

const FALLBACK_SPORTS = [
  { sport_key: "futsal", name: "Futsal" },
  { sport_key: "tennis", name: "Tennis" },
  { sport_key: "badminton", name: "Badminton" },
  { sport_key: "padel", name: "Padel" },
];

async function readCompressedImage(file, { maxEdge, quality }) {
  const raw = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Gagal membaca gambar."));
    reader.readAsDataURL(file);
  });
  return compressDataUrlForAi(raw, { maxEdge, quality });
}

/**
 * Bottom sheet buat komunitas baru + upload logo & background.
 */
export default function CommunityCreateSheet({ open, onClose, onCreated }) {
  const navigate = useNavigate();
  const bannerRef = useRef(null);
  const logoRef = useRef(null);
  const [sports, setSports] = useState(FALLBACK_SPORTS);
  const [form, setForm] = useState({
    name: "",
    sport_key: "futsal",
    sport_custom: "",
    city: "",
    company: "",
    description: "",
    banner_url: "",
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError("");
    fetchCommunitySports()
      .then((d) => {
        if (cancelled) return;
        const list = d.sports || [];
        if (list.length) {
          setSports(list);
          setForm((f) => ({
            ...f,
            sport_key: f.sport_key || list[0].sport_key,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setSports(FALLBACK_SPORTS);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const isOther = form.sport_key === OTHER_KEY;
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const initials = (form.name || "C").trim().slice(0, 2).toUpperCase() || "C";

  const onPickImage = async (e, field) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Pilih file gambar (JPG/PNG/WebP).");
      return;
    }
    setError("");
    setPicking(field);
    try {
      const compressed = await readCompressedImage(file, {
        maxEdge: field === "banner_url" ? 1400 : 512,
        quality: field === "banner_url" ? 0.72 : 0.8,
      });
      set(field, compressed);
    } catch {
      setError("Gagal memproses gambar.");
    } finally {
      setPicking("");
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nama komunitas wajib diisi.");
      return;
    }
    if (!form.sport_key) {
      setError("Pilih olahraga.");
      return;
    }
    if (isOther && !form.sport_custom.trim()) {
      setError("Ketik nama olahraga / aktivitas.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { community } = await createCommunity({
        name: form.name.trim(),
        sport_key: isOther ? OTHER_KEY : form.sport_key,
        sport_custom: isOther ? form.sport_custom.trim() : undefined,
        city: form.city.trim() || undefined,
        company: form.company.trim() || undefined,
        description: form.description.trim() || undefined,
        banner_url: form.banner_url || undefined,
        logo_url: form.logo_url || undefined,
      });
      showSuccess("Komunitas dibuat", `Komunitas "${community.name || form.name}" berhasil dibuat.`);
      setForm({
        name: "",
        sport_key: sports[0]?.sport_key || "futsal",
        sport_custom: "",
        city: "",
        company: "",
        description: "",
        banner_url: "",
        logo_url: "",
      });
      onClose?.();
      onCreated?.(community);
      if (community?.id) navigate(`/community/${community.id}`);
    } catch (err) {
      const msg = err?.message || "Gagal membuat komunitas.";
      let friendly = msg;
      if (/Unknown column ['`]?company/i.test(msg)) {
        friendly = "Kolom perusahaan belum ada di DB. Jalankan migrate 015_community_company.sql.";
      } else if (/Data too long|banner_url|logo_url|ER_DATA_TOO_LONG/i.test(msg)) {
        friendly =
          "Logo/background terlalu besar untuk DB. Jalankan migrate 016_community_banner_logo_text.sql, atau buat tanpa foto dulu.";
      }
      setError(friendly);
      showError("Gagal membuat komunitas", friendly);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <button type="button" className="absolute inset-0" aria-label="Tutup" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200" />
        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
          <h3 className="text-base font-extrabold text-slate-900">Create Community</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {/* Preview banner + logo ala desain */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-100">
            <div className="relative h-28 bg-slate-700">
              {form.banner_url ? (
                <img src={form.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-600 to-slate-800">
                  <span className="text-[11px] font-semibold text-white/70">Background komunitas</span>
                </div>
              )}
            </div>
            <div className="flex justify-center pb-3 pt-8">
              <div
                className="absolute left-1/2 top-[7rem] size-[72px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-white shadow-md"
                style={{ backgroundColor: ACCENT }}
              >
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-lg font-black text-white">
                    {initials}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-2">
              <button
                type="button"
                disabled={Boolean(picking)}
                onClick={() => bannerRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white py-2.5 text-[12px] font-semibold text-slate-700 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">wallpaper</span>
                {picking === "banner_url" ? "…" : form.banner_url ? "Ganti background" : "Upload background"}
              </button>
              <button
                type="button"
                disabled={Boolean(picking)}
                onClick={() => logoRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white py-2.5 text-[12px] font-semibold text-slate-700 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
                {picking === "logo_url" ? "…" : form.logo_url ? "Ganti logo" : "Upload logo"}
              </button>
            </div>
            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickImage(e, "banner_url")}
            />
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickImage(e, "logo_url")}
            />
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Nama komunitas</span>
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Mis. Padel BSD Club"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Olahraga</span>
            <select
              required
              value={form.sport_key}
              onChange={(e) => set("sport_key", e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
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
                placeholder="Mis. Pickleball, Hiking, CrossFit…"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Perusahaan</span>
            <input
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Nama perusahaan / organisasi"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Kota</span>
            <input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Jakarta Selatan"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Deskripsi</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ceritakan singkat komunitasmu…"
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
            />
          </label>

          {error ? <p className="text-xs text-red-500">{error}</p> : null}

          <button
            type="submit"
            disabled={saving || Boolean(picking) || !form.name.trim() || (isOther && !form.sport_custom.trim())}
            className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {saving ? "Menyimpan…" : "Buat Komunitas"}
          </button>
        </form>
      </div>
    </div>
  );
}
