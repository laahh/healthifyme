import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOpenPlay } from "../../lib/openPlayApi";
import { fetchCommunitySports } from "../../lib/communityApi";
import { compressDataUrlForAi } from "../../lib/imageCompressForAi";
import { defaultOpenPlayCover } from "../../lib/openPlayCovers";
import { CommunityShell, CommunityTopBar } from "../community/CommunityShell";
import { showError, showSuccess } from "../../lib/appAlert";

function toLocalInputValue(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
}

export default function OpenPlayCreateContent() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [sports, setSports] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [customCover, setCustomCover] = useState("");
  const [form, setForm] = useState({
    title: "",
    sport_key: "badminton",
    starts_at: toLocalInputValue(new Date(Date.now() + 2 * 3600_000)),
    place: "",
    city: "",
    capacity: 8,
    skill_level: "all",
    fee_note: "",
    description: "",
  });

  const previewUrl = customCover || defaultOpenPlayCover(form.sport_key);

  useEffect(() => {
    fetchCommunitySports()
      .then((d) => {
        const list = d.sports || [];
        setSports(list);
        if (list[0]?.sport_key) {
          setForm((f) => ({ ...f, sport_key: f.sport_key || list[0].sport_key }));
        }
      })
      .catch(() =>
        setSports([
          { sport_key: "badminton", name: "Badminton" },
          { sport_key: "futsal", name: "Futsal" },
          { sport_key: "tennis", name: "Tennis" },
          { sport_key: "padel", name: "Padel" },
        ])
      );
  }, []);

  const onPickCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Pilih file gambar (JPG/PNG).");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = String(reader.result || "");
        const compressed = await compressDataUrlForAi(raw, { maxEdge: 960, quality: 0.72 });
        setCustomCover(compressed);
        setCoverPreview(compressed);
      } catch {
        setError("Gagal memproses gambar.");
      }
    };
    reader.onerror = () => setError("Gagal membaca gambar.");
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const starts = new Date(form.starts_at);
      const { event } = await createOpenPlay({
        ...form,
        capacity: Number(form.capacity) || 8,
        starts_at: starts.toISOString(),
        cover_url: customCover || defaultOpenPlayCover(form.sport_key),
      });
      showSuccess("Main Bareng dibuat", "Event berhasil dibuat.");
      navigate(`/open-play/${event.id}`, { replace: true });
    } catch (err) {
      const msg = err?.message || "Gagal membuat Main Bareng.";
      if (/Data too long|cover_url|ER_DATA_TOO_LONG/i.test(msg)) {
        const friendly =
          "Cover terlalu besar untuk DB saat ini. Jalankan migrate 009_open_play_cover_text.sql, atau buat tanpa upload (pakai default).";
        setError(friendly);
        showError("Gagal membuat Main Bareng", friendly);
      } else {
        setError(msg);
        showError("Gagal membuat Main Bareng", msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <CommunityShell>
      <CommunityTopBar title="Buat Main Bareng" subtitle="Undang teman main tanpa komunitas" backTo="/open-play" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <span className="text-xs font-semibold text-slate-600">Cover event</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative mt-1 block w-full overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200"
            >
              <img src={coverPreview || previewUrl} alt="" className="h-40 w-full object-cover" />
              <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-white">
                <span className="material-symbols-outlined text-[28px]">add_a_photo</span>
                <span className="mt-1 text-[12px] font-semibold">
                  {customCover ? "Ganti foto" : "Upload foto (opsional)"}
                </span>
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickCover} />
            {customCover ? (
              <button
                type="button"
                onClick={() => {
                  setCustomCover("");
                  setCoverPreview("");
                }}
                className="mt-1.5 text-[12px] font-semibold text-slate-500"
              >
                Pakai default olahraga
              </button>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Tanpa upload, cover mengikuti olahraga yang dipilih.
              </p>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Judul</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Mabar Badminton Siang"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Olahraga</span>
            <select
              value={form.sport_key}
              onChange={(e) => setForm((f) => ({ ...f, sport_key: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              {sports.map((s) => (
                <option key={s.sport_key} value={s.sport_key}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Waktu mulai</span>
            <input
              required
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Tempat</span>
              <input
                required
                value={form.place}
                onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
                placeholder="Lapangan A"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Kota</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Jakarta"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Kapasitas</span>
              <input
                type="number"
                min={2}
                max={500}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Level</span>
              <select
                value={form.skill_level}
                onChange={(e) => setForm((f) => ({ ...f, skill_level: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
              >
                <option value="all">Semua level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Biaya (opsional, teks saja)</span>
            <input
              value={form.fee_note}
              onChange={(e) => setForm((f) => ({ ...f, fee_note: e.target.value }))}
              placeholder="Rp 35rb / orang"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Deskripsi</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            />
          </label>
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Setiap request join memerlukan persetujuanmu sebagai host. Jika slot penuh, pemain masuk waitlist.
          </p>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Menyimpan…" : "Buat Event"}
          </button>
        </form>
      </main>
    </CommunityShell>
  );
}
