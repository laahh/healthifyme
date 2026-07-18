import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FALLBACK_HUB, fetchCommunityHub } from "../../lib/communityApi";
import { CommunityShell, formatMemberCount } from "./CommunityShell";

const ACCENT = "#8B1E2D";

const SPORT_ICON = {
  padel: "sports_tennis",
  tennis: "sports_tennis",
  badminton: "sports_tennis",
  mini_soccer: "sports_soccer",
  sepak_bola: "sports_soccer",
  basketball: "sports_basketball",
  futsal: "sports_soccer",
  running: "directions_run",
  volleyball: "sports_volleyball",
  yoga: "self_improvement",
  fitness: "fitness_center",
  pickleball: "sports_tennis",
};

function CommunityRow({ community }) {
  const sportLabel = community.sport_name || community.sport_key || "";
  const city = community.city || "Indonesia";
  const members = formatMemberCount(community.member_count);
  const initial = (community.name || "?").slice(0, 1).toUpperCase();

  return (
    <Link
      to={`/community/${community.id}`}
      className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 transition-colors"
    >
      {community.logo_url ? (
        <img
          src={community.logo_url}
          alt=""
          className="size-12 shrink-0 rounded-full object-cover bg-slate-100"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fallback = e.currentTarget.nextElementSibling;
            if (fallback) fallback.classList.remove("hidden");
          }}
        />
      ) : null}
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
          community.logo_url ? "hidden" : ""
        }`}
        style={{ backgroundColor: ACCENT }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-400 capitalize">{sportLabel}</p>
        <p className="truncate text-[15px] font-bold text-slate-900 leading-snug">{community.name}</p>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">
          {city}
          {community.company ? ` · ${community.company}` : ""} · {members} Anggota
        </p>
      </div>
    </Link>
  );
}

export default function CommunitySportListContent() {
  const { sportKey } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [sports, setSports] = useState(FALLBACK_HUB.sports);
  const [totalCommunities, setTotalCommunities] = useState(FALLBACK_HUB.total_communities);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchCommunityHub({ sport: sportKey })
      .then((d) => {
        if (cancelled) return;
        setItems(d.communities || []);
        setSports(d.sports?.length ? d.sports : FALLBACK_HUB.sports);
        setTotalCommunities(d.total_communities ?? FALLBACK_HUB.total_communities);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Gagal memuat. Menampilkan data demo.");
        setSports(FALLBACK_HUB.sports);
        setTotalCommunities(FALLBACK_HUB.total_communities);
        setItems(
          (FALLBACK_HUB.popular || []).filter((c) => !sportKey || c.sport_key === sportKey)
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sportKey]);

  const filtered = useMemo(() => {
    let list = items;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          String(c.name || "").toLowerCase().includes(q) ||
          String(c.city || "").toLowerCase().includes(q)
      );
    }
    if (location.trim()) {
      const loc = location.trim().toLowerCase();
      list = list.filter((c) => String(c.city || "").toLowerCase().includes(loc));
    }
    return list;
  }, [items, query, location]);

  const cities = useMemo(() => {
    const set = new Set();
    items.forEach((c) => {
      const city = String(c.city || "").trim();
      if (city) set.add(city);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [items]);

  const displayingLabel = useMemo(() => {
    const shown = filtered.length.toLocaleString("id-ID");
    const total = Number(totalCommunities || 0).toLocaleString("id-ID");
    return `Displaying ${shown} communities out of ${total}`;
  }, [filtered.length, totalCommunities]);

  return (
    <CommunityShell className="bg-white">
      {/* Header: back + search + location */}
      <header className="shrink-0 border-b border-slate-100 bg-white px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/community")}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-50"
            aria-label="Kembali"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2.5">
            <span className="material-symbols-outlined text-[20px] text-slate-400">search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Community"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>

          <label className="relative flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-slate-700">
            <span className="material-symbols-outlined text-[16px] text-slate-500">location_on</span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Filter lokasi"
            >
              <option value="">All Location</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <span className="max-w-[4.5rem] truncate">{location || "All Location"}</span>
          </label>
        </div>
      </header>

      {/* Sport chips */}
      <div className="shrink-0 border-b border-slate-50 bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
            aria-label="Filter"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
          {sports.map((s) => {
            const active = s.sport_key === sportKey;
            const icon = s.icon || SPORT_ICON[s.sport_key] || "sports";
            return (
              <button
                key={s.sport_key}
                type="button"
                onClick={() => navigate(`/community/sports/${s.sport_key}`)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors ${
                  active
                    ? "text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
                style={active ? { backgroundColor: ACCENT } : undefined}
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  style={active ? { color: "#fff" } : undefined}
                >
                  {icon}
                </span>
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <p className="shrink-0 px-4 pt-3 pb-1 text-[12px] text-slate-500">{displayingLabel}</p>

      <main className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error ? <p className="px-4 pb-2 text-xs text-amber-700">{error}</p> : null}
        {loading ? (
          <p className="py-16 text-center text-sm text-slate-400">Memuat komunitas…</p>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-200">groups</span>
            <p className="mt-3 text-sm font-bold text-slate-800">Belum ada komunitas</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Coba ganti olahraga, lokasi, atau kata pencarian.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {filtered.map((c) => (
              <li key={c.id}>
                <CommunityRow community={c} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </CommunityShell>
  );
}
