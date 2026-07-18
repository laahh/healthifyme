import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchEvent, rsvpEvent } from "../../lib/communityApi";
import { CommunityShell, CommunityTopBar } from "./CommunityShell";

export default function CommunityEventDetailContent() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchEvent(eventId)
      .then((d) => setEvent(d.event))
      .catch((e) => setError(e?.message || "Event tidak ditemukan."));
  }, [eventId]);

  const toggle = async () => {
    if (!event) return;
    setBusy(true);
    try {
      const { event: next } = await rsvpEvent(eventId, !event.joined);
      setEvent(next);
    } catch (e) {
      setError(e?.message || "Gagal RSVP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommunityShell>
      <CommunityTopBar
        title="Event Detail"
        subtitle="Open Play / Coaching"
        backTo={event?.community_id ? `/community/${event.community_id}` : "/community"}
      />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
        {!event ? (
          <p className="text-sm text-slate-500 text-center py-10">Memuat…</p>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
            <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary">
              {event.event_type === "coaching" ? "Coaching" : "Open Play"}
            </span>
            <h2 className="text-xl font-bold">{event.title}</h2>
            <p className="text-sm text-slate-600">{event.sport_name}</p>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
                {new Date(event.starts_at).toLocaleString("id-ID")}
              </p>
              <p className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">location_on</span>
                {event.place || "-"}
              </p>
              <p className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">group</span>
                {event.rsvp_count}/{event.capacity} pemain
              </p>
              {event.fee_note ? (
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">payments</span>
                  {event.fee_note}
                </p>
              ) : null}
            </div>
            {event.community_id ? (
              <Link to={`/community/${event.community_id}`} className="text-xs font-semibold text-primary">
                Lihat komunitas {event.community_name || ""}
              </Link>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={toggle}
              className={`w-full rounded-xl py-3 text-sm font-bold ${
                event.joined
                  ? "border border-slate-200 text-slate-700"
                  : "bg-primary text-white"
              }`}
            >
              {event.joined ? "Batalkan Join" : "Join Event"}
            </button>
          </div>
        )}
      </main>
    </CommunityShell>
  );
}
