import { useEffect, useState } from "react";
import { fetchEvent, rsvpEvent } from "../../lib/communityApi";
import { showError, showSuccess } from "../../lib/appAlert";

const ACCENT = "#8B1E2D";

/**
 * Bottom sheet detail aktivitas komunitas — dibuka saat kartu aktivitas diklik.
 */
export default function CommunityActivityDetailSheet({ open, eventId, onClose, onChanged }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !eventId) {
      setEvent(null);
      setError("");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchEvent(eventId)
      .then((d) => {
        if (!cancelled) setEvent(d.event || null);
      })
      .catch((e) => {
        if (!cancelled) {
          setEvent(null);
          setError(e?.message || "Aktivitas tidak ditemukan.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  if (!open) return null;

  const when = event?.starts_at
    ? new Date(event.starts_at).toLocaleString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const typeLabel = event?.event_type === "coaching" ? "Coaching" : "Open Play";
  const joined = Number(event?.rsvp_count) || 0;
  const cap = Number(event?.capacity) || 0;

  const onToggleRsvp = async () => {
    if (!event || busy) return;
    setBusy(true);
    setError("");
    try {
      const joining = !event.joined;
      const { event: next } = await rsvpEvent(event.id, joining);
      setEvent(next);
      showSuccess(joining ? "Berhasil join" : "Join dibatalkan", joining ? "Anda bergabung ke aktivitas ini." : "");
      onChanged?.(next);
    } catch (e) {
      setError(e?.message || "Gagal update RSVP.");
      showError("Gagal RSVP", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <button type="button" className="absolute inset-0" aria-label="Tutup" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200" />
        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
          <h3 className="text-base font-extrabold text-slate-900">Detail aktivitas</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-400">Memuat…</p>
          ) : error && !event ? (
            <p className="py-12 text-center text-sm text-red-500">{error}</p>
          ) : event ? (
            <div className="space-y-4 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex rounded-md px-2.5 py-0.5 text-[10px] font-bold uppercase text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  {typeLabel}
                </span>
                {event.status ? (
                  <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold capitalize text-slate-600">
                    {event.status}
                  </span>
                ) : null}
              </div>

              <h2 className="text-xl font-extrabold leading-snug text-slate-900">{event.title}</h2>

              <p className="flex items-center gap-2 text-sm text-slate-600">
                <span className="material-symbols-outlined text-[20px]" style={{ color: ACCENT }}>
                  sports_tennis
                </span>
                {event.sport_name || event.sport_key || "Olahraga"}
              </p>

              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                <p className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="material-symbols-outlined mt-0.5 text-[20px]" style={{ color: ACCENT }}>
                    schedule
                  </span>
                  <span>{when}</span>
                </p>
                <p className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="material-symbols-outlined mt-0.5 text-[20px]" style={{ color: ACCENT }}>
                    location_on
                  </span>
                  <span>{event.place || "Lokasi menyusul"}</span>
                </p>
                <p className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="material-symbols-outlined mt-0.5 text-[20px]" style={{ color: ACCENT }}>
                    group
                  </span>
                  <span>
                    {joined}/{cap || "—"} pemain
                  </span>
                </p>
                {event.fee_note ? (
                  <p className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="material-symbols-outlined mt-0.5 text-[20px]" style={{ color: ACCENT }}>
                      payments
                    </span>
                    <span>{event.fee_note}</span>
                  </p>
                ) : null}
              </div>

              {event.description ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Deskripsi</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {event.description}
                  </p>
                </div>
              ) : null}

              {error ? <p className="text-xs text-red-500">{error}</p> : null}

              <button
                type="button"
                disabled={busy || event.status === "cancelled" || event.status === "done"}
                onClick={onToggleRsvp}
                className={`w-full rounded-xl py-3.5 text-sm font-bold disabled:opacity-50 ${
                  event.joined
                    ? "border-2 bg-white text-slate-800"
                    : "text-white"
                }`}
                style={
                  event.joined
                    ? { borderColor: ACCENT, color: ACCENT }
                    : { backgroundColor: ACCENT }
                }
              >
                {busy
                  ? "Memproses…"
                  : event.joined
                    ? "Batalkan Join"
                    : "Join Aktivitas"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
