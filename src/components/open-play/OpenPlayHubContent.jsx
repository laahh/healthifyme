import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FALLBACK_OPEN_PLAY, fetchOpenPlayHub } from "../../lib/openPlayApi";
import { resolveOpenPlayCover } from "../../lib/openPlayCovers";
import { CommunityShell } from "../community/CommunityShell";

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

function ctaLabel(event) {
  if (event.is_host) return "Host";
  if (event.my_status === "approved") return "Joined";
  if (event.my_status === "pending") return "Pending";
  if (event.my_status === "waitlist") return "Waitlist";
  if (event.spots_left <= 0 || event.status === "full") return "Waitlist";
  return "Join";
}

export default function OpenPlayHubContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [sport, setSport] = useState(searchParams.get("sport") || "");
  const [hub, setHub] = useState(FALLBACK_OPEN_PLAY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchOpenPlayHub({
          q: searchParams.get("q") || undefined,
          sport: searchParams.get("sport") || undefined,
        });
        if (!cancelled) setHub(data);
      } catch (e) {
        if (!cancelled) {
          setHub(FALLBACK_OPEN_PLAY);
          setError(e?.message || "Mode demo — API/DB belum siap.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const sports = useMemo(() => hub.sports || [], [hub.sports]);
  const events = useMemo(() => hub.events || [], [hub.events]);

  const onSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    setSearchParams(next);
  };

  const selectSport = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key && sport !== key) {
      next.set("sport", key);
      setSport(key);
    } else {
      next.delete("sport");
      setSport("");
    }
    setSearchParams(next);
  };

  return (
    <CommunityShell className="bg-[#f7f7f8]">
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f8] pb-[max(5.5rem,env(safe-area-inset-bottom))]">
        <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-4 pb-3 pt-[max(0.85rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center gap-2">
            <Link
              to="/home"
              className="flex size-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
              aria-label="Kembali"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-slate-900">Main Bareng</h1>
              <p className="text-[11px] text-slate-500">Cari sesi olahraga di dekatmu</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/open-play/mine")}
              className="rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-primary"
            >
              Saya
            </button>
          </div>
          <form onSubmit={onSearch} className="mt-3">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
                search
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari badminton / lokasi…"
                className="w-full rounded-xl border-0 bg-slate-100 py-2.5 pl-10 pr-3 text-[13px] outline-none placeholder:text-slate-400"
              />
            </div>
          </form>
        </header>

        <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => selectSport("")}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
              !sport ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            Semua
          </button>
          {sports.map((s) => (
            <button
              key={s.sport_key}
              type="button"
              onClick={() => selectSport(s.sport_key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
                sport === s.sport_key
                  ? "bg-primary text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mx-4 mb-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {error}
          </p>
        ) : null}

        <section className="space-y-3 px-4 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">Segera berlangsung</h2>
            <span className="text-[11px] text-slate-400">Tanggal terdekat</span>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Memuat…</p>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
              <p className="text-sm text-slate-500">Belum ada Main Bareng. Jadilah yang pertama!</p>
            </div>
          ) : (
            events.map((event) => {
              const cover = resolveOpenPlayCover(event);
              return (
                <Link
                  key={event.id}
                  to={`/open-play/${event.id}`}
                  className="block overflow-hidden rounded-2xl bg-white shadow-[0_2px_10px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 active:scale-[0.99] transition-transform"
                >
                  <div className="relative h-[132px] overflow-hidden bg-slate-800">
                    <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase text-primary shadow-sm">
                      <span className="material-symbols-outlined text-[14px]">
                        {event.sport_icon || "sports"}
                      </span>
                      {event.sport_name || event.sport_key}
                    </span>
                    <span
                      className={`absolute right-3 top-3 rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-sm ${
                        event.my_status || event.is_host
                          ? "bg-white/95 text-slate-700"
                          : "bg-primary text-white"
                      }`}
                    >
                      {ctaLabel(event)}
                    </span>
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="truncate text-[16px] font-extrabold text-white drop-shadow">
                        {event.title}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-1.5 px-3.5 py-3 text-[12px] text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                      {formatWhen(event.starts_at)}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
                      <span className="truncate">
                        {event.place || "-"}
                        {event.city ? ` · ${event.city}` : ""}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">group</span>
                      {event.approved_count}/{event.capacity} pemain
                      {event.fee_note ? ` · ${event.fee_note}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          onClick={() => navigate("/open-play/create")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Buat Main Bareng
        </button>
      </div>
    </CommunityShell>
  );
}
