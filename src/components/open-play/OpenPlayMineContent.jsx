import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMyOpenPlays } from "../../lib/openPlayApi";
import { resolveOpenPlayCover } from "../../lib/openPlayCovers";
import { CommunityShell, CommunityTopBar } from "../community/CommunityShell";

function formatWhen(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventRow({ event, badge }) {
  const cover = resolveOpenPlayCover(event);
  return (
    <Link
      to={`/open-play/${event.id}`}
      className="flex items-center gap-3 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm"
    >
      <div className="size-[72px] shrink-0 overflow-hidden bg-slate-200">
        <img src={cover} alt="" className="size-full object-cover" />
      </div>
      <div className="min-w-0 flex-1 py-2.5 pr-3">
        <p className="truncate text-sm font-bold text-slate-900">{event.title}</p>
        <p className="text-[11px] text-slate-500">
          {formatWhen(event.starts_at)} · {event.place || event.city || "-"}
        </p>
        <p className="text-[11px] text-slate-400">
          {event.approved_count}/{event.capacity} pemain
        </p>
      </div>
      {badge ? (
        <span className="mr-3 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export default function OpenPlayMineContent() {
  const [tab, setTab] = useState("hosting");
  const [data, setData] = useState({ hosting: [], joined: [], pending: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchMyOpenPlays()
      .then((d) =>
        setData({
          hosting: d.hosting || [],
          joined: d.joined || [],
          pending: d.pending || [],
        })
      )
      .catch((e) => setError(e?.message || "Gagal memuat."))
      .finally(() => setLoading(false));
  }, []);

  const list =
    tab === "hosting" ? data.hosting : tab === "joined" ? data.joined : data.pending;

  return (
    <CommunityShell>
      <CommunityTopBar title="Main Bareng Saya" subtitle="Hosting, join, dan pending" backTo="/open-play" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <Link
          to="/open-play/create"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Buat Main Bareng
        </Link>

        <div className="flex gap-2">
          {[
            { key: "hosting", label: "Hosting" },
            { key: "joined", label: "Joined" },
            { key: "pending", label: "Pending" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
                tab === t.key ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Memuat…</p>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
            <p className="text-sm text-slate-500">Belum ada event di tab ini.</p>
            <Link to="/open-play" className="mt-2 inline-block text-[13px] font-semibold text-primary">
              Jelajahi Main Bareng
            </Link>
          </div>
        ) : (
          list.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              badge={
                tab === "pending"
                  ? event.my_status === "waitlist"
                    ? "waitlist"
                    : "pending"
                  : tab === "hosting"
                    ? event.status
                    : null
              }
            />
          ))
        )}
      </main>
    </CommunityShell>
  );
}
