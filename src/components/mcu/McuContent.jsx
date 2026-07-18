import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSessionUser, mergeSessionUser } from "../../auth/auth";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";

const ACCENT = "#006a3f";

const MCU_LABEL_MAP = {
  tanggal: "Tanggal",
  lokasi: "Lokasi",
  gulaDarahPuasa: "Gula darah puasa",
  kolesterolTotal: "Kolesterol total",
  tekananDarah: "Tekanan darah",
  hemoglobin: "Hemoglobin",
  catatan: "Catatan",
  GDP: "GDP",
  Kolesterol: "Kolesterol",
  IMT: "IMT",
  GulaDarahPuasa: "Gula darah puasa (raw)",
  KolesterolTotal: "Kolesterol total (raw)",
  SindromMetabolik: "Sindrom metabolik",
  FraminghamScore: "Framingham score",
  sid: "SID",
  kode_sid: "SID",
  nik: "NIK",
  nama: "Nama",
  paketMcu: "Paket MCU",
  perluFollowup: "Perlu follow-up",
  kondisiKritis: "Temuan kritis",
  kondisiNonKritis: "Temuan non-kritis",
  namaDokter: "Dokter",
  tanggalKadaluarsa: "Tanggal kadaluarsa",
  kodeMcu: "Kode MCU",
  urlPdf: "URL PDF",
  perusahaan: "Perusahaan",
  jabatan_struktural: "Jabatan struktural",
  jabatan_fungsional: "Jabatan fungsional",
  jenis_pekerjaan: "Jenis pekerjaan",
  no_sip_dokter: "No. SIP dokter",
  tanggal_input: "Tanggal input",
  tanggal_update: "Tanggal update",
};

const HIGHLIGHT_KEYS = [
  "gulaDarahPuasa",
  "GDP",
  "GulaDarahPuasa",
  "kolesterolTotal",
  "Kolesterol",
  "KolesterolTotal",
  "IMT",
  "tekananDarah",
  "hemoglobin",
  "SindromMetabolik",
  "FraminghamScore",
  "kondisiKritis",
  "kondisiNonKritis",
  "perluFollowup",
  "paketMcu",
];

function toReadableLabel(key) {
  return (MCU_LABEL_MAP[key] || key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function pickFirst(mcu, keys) {
  if (!mcu || typeof mcu !== "object") return "";
  for (const key of keys) {
    const v = mcu[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/** Ubah JSON kondisi kritis/non-kritis jadi teks terbaca (juga untuk cache session lama). */
function formatKondisiDisplay(raw) {
  if (raw == null) return "";
  let items = raw;
  if (typeof items === "string") {
    const t = items.trim();
    if (!t || t === "[]" || t === "null") return "";
    if (!(t.startsWith("[") || t.startsWith("{"))) return t;
    try {
      items = JSON.parse(t);
    } catch {
      return t;
    }
  }
  if (!Array.isArray(items)) return String(raw);
  const lines = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const name = String(it.nama_kondisi || it.nama || "").trim();
    if (!name) continue;
    const yes = Number(it.is_yes) === 1 || it.is_yes === true;
    const no = Number(it.is_no) === 1 || it.is_no === true;
    const na = Number(it.is_na) === 1 || it.is_na === true;
    let status = yes ? "Ya" : no ? "Tidak" : na ? "N/A" : "";
    const note = it.note != null && String(it.note).trim() ? String(it.note).trim() : "";
    if (status && note) lines.push(`${name}: ${status} (${note})`);
    else if (status) lines.push(`${name}: ${status}`);
    else if (note) lines.push(`${name}: ${note}`);
    else lines.push(name);
  }
  return lines.join("\n");
}

function normalizeMcuForUi(raw) {
  if (!raw || typeof raw !== "object") return null;
  const next = { ...raw };
  if (next.kondisiKritis != null) {
    const f = formatKondisiDisplay(next.kondisiKritis);
    if (f) next.kondisiKritis = f;
    else delete next.kondisiKritis;
  }
  if (next.kondisiNonKritis != null) {
    const f = formatKondisiDisplay(next.kondisiNonKritis);
    if (f) next.kondisiNonKritis = f;
    else delete next.kondisiNonKritis;
  }
  return next;
}

function kondisiHighlightSummary(text, { critical = false } = {}) {
  if (!text) return "";
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const yesCount = lines.filter((l) => /:\s*Ya\b/i.test(l)).length;
  const total = lines.length;
  if (critical) {
    if (yesCount > 0) return yesCount === 1 ? "Ada 1 temuan" : `Ada ${yesCount} temuan`;
    return "Tidak ada temuan";
  }
  if (total === 0) return "Tidak ada catatan";
  return total === 1 ? "Ada 1 catatan" : `Ada ${total} catatan`;
}

function parseKondisiLines(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?):\s*(Ya|Tidak|N\/A)(?:\s*\((.+)\))?$/i);
      if (m) {
        return { name: m[1].trim(), status: m[2], note: m[3]?.trim() || "" };
      }
      return { name: line, status: "", note: "" };
    });
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "ya") return "bg-red-100 text-red-800";
  if (s === "tidak") return "bg-emerald-100 text-emerald-800";
  if (s === "n/a") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-600";
}

export default function McuContent() {
  const navigate = useNavigate();
  const sessionUser = getSessionUser();
  const [mcu, setMcu] = useState(() => normalizeMcuForUi(sessionUser?.mcu || null));
  const [loading, setLoading] = useState(() => isApiBackendEnabled() && !sessionUser?.mcu);
  const [kondisiModal, setKondisiModal] = useState(null); // { title, text } | null

  useEffect(() => {
    if (!isApiBackendEnabled()) {
      setMcu(normalizeMcuForUi(sessionUser?.mcu || null));
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiRequest("/me/mcu");
        if (cancelled) return;
        const next = normalizeMcuForUi(data?.mcu && typeof data.mcu === "object" ? data.mcu : null);
        setMcu(next);
        if (next) mergeSessionUser({ mcu: next });
      } catch {
        if (!cancelled) setMcu(normalizeMcuForUi(sessionUser?.mcu || null));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUser?.id]);

  const mcuEntries = useMemo(() => {
    if (!mcu || typeof mcu !== "object") return [];
    return Object.entries(mcu).filter(([, value]) => value != null && String(value).trim() !== "");
  }, [mcu]);

  const highlightCards = useMemo(() => {
    const cards = [];
    const glucose = pickFirst(mcu, ["gulaDarahPuasa", "GDP", "GulaDarahPuasa"]);
    const cholesterol = pickFirst(mcu, ["kolesterolTotal", "Kolesterol", "KolesterolTotal"]);
    const imt = pickFirst(mcu, ["IMT"]);
    const bp = pickFirst(mcu, ["tekananDarah"]);
    const framingham = pickFirst(mcu, ["FraminghamScore"]);
    const metabolic = pickFirst(mcu, ["SindromMetabolik"]);
    const critical = pickFirst(mcu, ["kondisiKritis"]);
    const nonCritical = pickFirst(mcu, ["kondisiNonKritis"]);
    const followup = pickFirst(mcu, ["perluFollowup"]);
    const paket = pickFirst(mcu, ["paketMcu"]);
    if (glucose) cards.push({ label: "Gula darah", value: glucose, icon: "water_drop", tone: "bg-sky-50 text-sky-700" });
    if (cholesterol) cards.push({ label: "Kolesterol", value: cholesterol, icon: "bloodtype", tone: "bg-rose-50 text-rose-700" });
    if (imt) cards.push({ label: "IMT", value: imt, icon: "monitor_weight", tone: "bg-amber-50 text-amber-700" });
    if (bp) cards.push({ label: "Tekanan darah", value: bp, icon: "favorite", tone: "bg-red-50 text-red-700" });
    if (framingham) cards.push({ label: "Framingham", value: framingham, icon: "monitoring", tone: "bg-indigo-50 text-indigo-700" });
    if (metabolic) cards.push({ label: "Sindrom metabolik", value: metabolic, icon: "ecg", tone: "bg-violet-50 text-violet-700" });
    if (paket) cards.push({ label: "Paket MCU", value: paket, icon: "medical_services", tone: "bg-emerald-50 text-emerald-700" });
    if (followup) cards.push({ label: "Follow-up", value: followup, icon: "event_repeat", tone: "bg-orange-50 text-orange-800" });
    if (critical) {
      cards.push({
        key: "kondisiKritis",
        label: "Temuan kritis",
        value: kondisiHighlightSummary(critical, { critical: true }),
        icon: "warning",
        tone: "bg-red-50 text-red-700",
        clickable: true,
        detailText: critical,
      });
    }
    if (nonCritical) {
      cards.push({
        key: "kondisiNonKritis",
        label: "Temuan non-kritis",
        value: kondisiHighlightSummary(nonCritical, { critical: false }),
        icon: "health_and_safety",
        tone: "bg-amber-50 text-amber-800",
        clickable: true,
        detailText: nonCritical,
      });
    }
    return cards;
  }, [mcu]);

  const detailEntries = useMemo(() => {
    const used = new Set();
    for (const key of HIGHLIGHT_KEYS) {
      if (mcu?.[key] != null && String(mcu[key]).trim() !== "") used.add(key);
    }
    return mcuEntries.filter(([key]) => !used.has(key) || ["tanggal", "lokasi", "catatan"].includes(key));
  }, [mcu, mcuEntries]);

  const tanggal = pickFirst(mcu, ["tanggal"]);
  const lokasi = pickFirst(mcu, ["lokasi"]);
  const catatan = pickFirst(mcu, ["catatan"]);
  const modalItems = kondisiModal ? parseKondisiLines(kondisiModal.text) : [];

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#f3f4f6] font-['Public_Sans',sans-serif] text-slate-900">
      <header className="flex shrink-0 items-center gap-2 bg-white px-3 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] shadow-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full text-slate-700"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">Data MCU</h1>
          <p className="truncate text-[11px] text-slate-500">Medical check-up terakhir</p>
        </div>
        <Link
          to="/profile"
          className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"
          aria-label="Profil"
        >
          <span className="material-symbols-outlined">person</span>
        </Link>
      </header>

      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-16 text-center text-sm text-slate-500">Memuat data MCU…</p>
        ) : !mcu || mcuEntries.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-12 text-center shadow-sm ring-1 ring-slate-100">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <span className="material-symbols-outlined text-[28px]">medical_information</span>
            </div>
            <p className="mt-3 text-base font-bold text-slate-900">Belum ada data MCU</p>
            <p className="mt-1 text-[13px] text-slate-500">
              Data medical check-up untuk SID akun ini belum tersedia di sistem, atau koneksi sumber MCU sedang tidak aktif.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 p-4 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <span className="material-symbols-outlined text-[24px]">medical_information</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100">MCU terakhir</p>
                  <p className="mt-0.5 text-lg font-black">{tanggal || "Tanggal tidak tersedia"}</p>
                  {lokasi ? <p className="mt-0.5 text-sm text-emerald-50">{lokasi}</p> : null}
                </div>
              </div>
              {catatan ? (
                <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[12px] leading-relaxed text-emerald-50">
                  {catatan}
                </p>
              ) : null}
            </section>

            {highlightCards.length > 0 ? (
              <section className="grid grid-cols-2 gap-2">
                {highlightCards.map((card) => {
                  const Tag = card.clickable ? "button" : "div";
                  return (
                    <Tag
                      key={card.key || card.label}
                      type={card.clickable ? "button" : undefined}
                      onClick={
                        card.clickable
                          ? () => setKondisiModal({ title: card.label, text: card.detailText })
                          : undefined
                      }
                      className={`rounded-2xl p-3 text-left shadow-sm ring-1 ring-black/5 ${card.tone} ${
                        card.clickable ? "active:scale-[0.98] transition-transform cursor-pointer" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                        <p className="text-[11px] font-semibold opacity-80">{card.label}</p>
                        {card.clickable ? (
                          <span className="material-symbols-outlined ml-auto text-[16px] opacity-60">chevron_right</span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-sm font-black leading-snug">{card.value}</p>
                      {card.clickable ? (
                        <p className="mt-1 text-[10px] font-medium opacity-70">Lihat detail</p>
                      ) : null}
                    </Tag>
                  );
                })}
              </section>
            ) : null}

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-3 text-sm font-bold text-slate-900">Detail lengkap</h2>
              <dl className="space-y-3 text-sm">
                {detailEntries.map(([key, value], index) => {
                  const isLast = index === detailEntries.length - 1;
                  const isLongText = key.toLowerCase().includes("catatan") || String(value).length > 60;
                  return (
                    <div
                      key={key}
                      className={`flex gap-4 ${
                        isLongText ? "flex-col" : "justify-between"
                      } ${!isLast ? "border-b border-slate-100 pb-2" : ""}`}
                    >
                      <dt className="text-slate-500">{toReadableLabel(key)}</dt>
                      <dd
                        className={`text-slate-900 ${
                          isLongText ? "leading-relaxed whitespace-pre-line" : "font-medium text-right"
                        }`}
                      >
                        {String(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            <p className="px-1 text-center text-[11px] text-slate-400">
              Data MCU live · matched by SID · aksen <span style={{ color: ACCENT }}>Well</span>
            </p>
          </>
        )}
      </main>

      {kondisiModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={kondisiModal.title}
          onClick={() => setKondisiModal(null)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-red-50 text-red-700">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-slate-900">{kondisiModal.title}</p>
                <p className="text-[11px] text-slate-500">
                  {modalItems.length === 1 ? "1 item" : `${modalItems.length} item`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKondisiModal(null)}
                className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                aria-label="Tutup"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <ul className="space-y-2">
                {modalItems.map((item, idx) => (
                  <li
                    key={`${item.name}-${idx}`}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold leading-snug text-slate-900">{item.name}</p>
                      {item.status ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      ) : null}
                    </div>
                    {item.note ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{item.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="shrink-0 border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setKondisiModal(null)}
                className="w-full rounded-2xl bg-slate-900 py-3 text-[13px] font-bold text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
