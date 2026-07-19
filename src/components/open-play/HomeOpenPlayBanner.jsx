import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isApiBackendEnabled } from "../../lib/apiClient";
import {
  FALLBACK_OPEN_PLAY,
  fetchMyOpenPlays,
  fetchOpenPlayHub,
} from "../../lib/openPlayApi";
import { resolveOpenPlayCover } from "../../lib/openPlayCovers";

const MAX_CARDS = 3;
const WEEK_MS = 7 * 24 * 3600_000;
const SOON_MS = 48 * 3600_000;

function formatWhen(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function isUpcoming(event, now = Date.now()) {
  const t = event?.starts_at ? new Date(event.starts_at).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  return t >= now - 15 * 60_000; // allow slight past buffer
}

function withinDays(event, now, windowMs) {
  const t = new Date(event.starts_at).getTime();
  return t >= now && t <= now + windowMs;
}

function sortByStart(a, b) {
  return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
}

function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const e of list) {
    const id = e?.id != null ? String(e.id) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(e);
  }
  return out;
}

function prioritizeMine(events, now) {
  const upcoming = events.filter((e) => isUpcoming(e, now)).sort(sortByStart);
  const soon = upcoming.filter((e) => withinDays(e, now, SOON_MS));
  const week = upcoming.filter((e) => withinDays(e, now, WEEK_MS));
  const pool = soon.length ? soon : week.length ? week : upcoming;
  return pool.slice(0, MAX_CARDS);
}

function statusChip(event) {
  if (event.is_host) {
    return { label: "Kamu host", className: "bg-primary text-white" };
  }
  if (event.my_status === "approved") {
    return { label: "Kamu join", className: "bg-emerald-500 text-white" };
  }
  if (event.my_status === "pending") {
    return { label: "Menunggu", className: "bg-amber-500 text-white" };
  }
  if (event.my_status === "waitlist") {
    return { label: "Waitlist", className: "bg-slate-700 text-white" };
  }
  const spots = Number(event.spots_left);
  if (Number.isFinite(spots) && spots > 0) {
    return { label: `Slot ${spots}`, className: "bg-orange-500 text-white" };
  }
  if (event.status === "full" || spots === 0) {
    return { label: "Penuh", className: "bg-slate-600 text-white" };
  }
  return { label: "Open", className: "bg-orange-500 text-white" };
}

function collectMine(data) {
  if (!data || typeof data !== "object") return [];
  return dedupeById([
    ...(Array.isArray(data.hosting) ? data.hosting : []),
    ...(Array.isArray(data.joined) ? data.joined : []),
    ...(Array.isArray(data.pending) ? data.pending : []),
  ]);
}

/**
 * Banner kondisional Main Bareng di Beranda.
 * Prioritas: event milik user (host/join/pending) → discovery hub.
 */
export default function HomeOpenPlayBanner({ className = "px-4 pb-2" }) {
  const [events, setEvents] = useState([]);
  const [mode, setMode] = useState("loading"); // loading | mine | discover | empty

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const now = Date.now();

      if (!isApiBackendEnabled()) {
        const demo = prioritizeMine(
          (FALLBACK_OPEN_PLAY.events || []).filter((e) => isUpcoming(e, now)),
          now
        );
        if (!cancelled) {
          setEvents(demo);
          setMode(demo.length ? "discover" : "empty");
        }
        return;
      }

      try {
        const mineData = await fetchMyOpenPlays();
        const mineList = prioritizeMine(collectMine(mineData), now);
        if (mineList.length > 0) {
          if (!cancelled) {
            setEvents(mineList);
            setMode("mine");
          }
          return;
        }

        const hub = await fetchOpenPlayHub();
        const openUpcoming = (hub?.events || [])
          .filter((e) => isUpcoming(e, now))
          .filter((e) => e.status === "open" || e.status === "full")
          .sort(sortByStart)
          .slice(0, MAX_CARDS);

        if (!cancelled) {
          setEvents(openUpcoming);
          setMode(openUpcoming.length ? "discover" : "empty");
        }
      } catch {
        const demo = prioritizeMine(
          (FALLBACK_OPEN_PLAY.events || []).filter((e) => isUpcoming(e, now)),
          now
        );
        if (!cancelled) {
          setEvents(demo);
          setMode(demo.length ? "discover" : "empty");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === "empty") return null;

  if (mode === "loading") {
    return (
      <section className={className}>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-[120px] animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (!events.length) return null;

  const title = mode === "mine" ? "Main Bareng kamu" : "Main Bareng";

  return (
    <section className={className}>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <Link to="/open-play" className="text-[11px] font-bold text-primary">
          Semua
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((event) => {
          const cover = resolveOpenPlayCover(event);
          const chip = statusChip(event);
          const place = [event.place, event.city].filter(Boolean).join(" · ") || "Lokasi menyusul";
          return (
            <Link
              key={event.id}
              to={`/open-play/${event.id}`}
              className="relative block h-[120px] w-[min(88%,300px)] shrink-0 overflow-hidden rounded-2xl bg-slate-800 shadow-sm ring-1 ring-slate-100 active:scale-[0.99]"
            >
              <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
              <div className="absolute inset-0 flex flex-col justify-between p-3">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-white/90">
                    chevron_right
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-white drop-shadow">
                    {event.title || "Main Bareng"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-white/85">
                    {event.sport_name || event.sport_key || "Olahraga"} · {formatWhen(event.starts_at)}
                  </p>
                  <p className="truncate text-[10px] text-white/70">{place}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
