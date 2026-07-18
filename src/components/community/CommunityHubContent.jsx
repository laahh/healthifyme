import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FALLBACK_HUB, fetchCommunityHub, fetchMyCommunities } from "../../lib/communityApi";
import { CommunityShell, formatMemberCount } from "./CommunityShell";
import CommunityCreateSheet from "./CommunityCreateSheet";

/** Hero community: marathon / runners. */
const HERO_IMG =
  "https://images.unsplash.com/photo-1667781838690-5f32ea0ccea6?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const SPORT_ICON_FALLBACK = {
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

function formatAyoCount(n) {
  const num = Number(n) || 0;
  if (num >= 1000) {
    return `${num.toLocaleString("id-ID")}+`;
  }
  return `${num}+`;
}

const AVATAR_COLORS = ["#0d9488", "#f97316", "#ec4899", "#6366f1", "#14b8a6", "#e11d48"];
const AVATAR_PHOTOS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop",
];

/** Avatar stack demo untuk kartu Popular (AYO-style). */
function memberAvatarPalette(seed) {
  const s = String(seed || "x");
  const initials = ["AG", "AM", "RK", "DN", "ST", "MY"];
  return Array.from({ length: 5 }, (_, i) => {
    const usePhoto = i < 2;
    return {
      key: `${s}-${i}`,
      label: initials[(s.length + i) % initials.length],
      color: AVATAR_COLORS[(s.length + i) % AVATAR_COLORS.length],
      photo: usePhoto ? AVATAR_PHOTOS[i % AVATAR_PHOTOS.length] : null,
    };
  });
}

export default function CommunityHubContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [hub, setHub] = useState(FALLBACK_HUB);
  const [myCommunities, setMyCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllSports, setShowAllSports] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchCommunityHub({ q: searchParams.get("q") || undefined });
        if (!cancelled) setHub(data);
      } catch (e) {
        if (!cancelled) {
          setHub(FALLBACK_HUB);
          setError(e?.message || "Gagal memuat komunitas. Menampilkan data demo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetchMyCommunities()
      .then((d) => {
        if (!cancelled) setMyCommunities(d.communities || []);
      })
      .catch(() => {
        if (!cancelled) setMyCommunities([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sportsVisible = useMemo(() => {
    const list = hub.sports || [];
    return showAllSports ? list : list.slice(0, 6);
  }, [hub.sports, showAllSports]);

  const totalLabel = useMemo(() => {
    const n = Number(hub.total_communities) || 38300;
    return n.toLocaleString("id-ID");
  }, [hub.total_communities]);

  const onSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    setSearchParams(next);
  };

  return (
    <CommunityShell className="bg-[#f7f7f8]">
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f8] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Hero + search overlapping seperti AYO */}
        <section className="relative">
          <div className="relative h-[220px] overflow-hidden">
            <img src={HERO_IMG} alt="" className="absolute inset-0 size-full object-cover object-[center_30%]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/75" />
            <div className="relative z-10 flex h-full flex-col px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-14">
              <Link
                to="/home"
                className="flex size-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-[2px]"
                aria-label="Kembali"
              >
                <span className="material-symbols-outlined text-[22px]">arrow_back</span>
              </Link>
              <div className="mt-auto mb-1">
                <h1 className="text-[32px] font-extrabold leading-none tracking-tight text-white">
                  Community
                </h1>
                <p className="mt-2 text-[13px] font-medium text-white/90">
                  Join over {totalLabel} Communities on WELL!
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={onSearch} className="relative z-20 -mt-7 px-4">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[22px] text-slate-400">
                search
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find Sepak Bola Community"
                className="w-full rounded-2xl border-0 bg-white py-[13px] pl-11 pr-4 text-[13px] text-slate-800 shadow-[0_4px_20px_rgba(15,23,42,0.12)] outline-none placeholder:text-slate-400 ring-1 ring-black/[0.04]"
              />
            </div>
          </form>
        </section>

        {/* CTA: Create | My Communities — flat & clean */}
        <div className="grid grid-cols-2 gap-2.5 px-4 pt-3.5">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-3 text-white active:scale-[0.99] transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span className="text-[13px] font-semibold">Create</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/community/manage")}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-slate-800 ring-1 ring-slate-200 active:scale-[0.99] transition-transform"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
            <span className="text-[13px] font-semibold">My Communities</span>
          </button>
        </div>

        {error ? (
          <p className="mx-4 mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            {error}
          </p>
        ) : null}

        {/* Komunitas Saya */}
        <section className="px-4 pt-6">
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold text-slate-900">Komunitas Saya</h2>
            {myCommunities.length > 0 ? (
              <button
                type="button"
                onClick={() => navigate("/community/manage")}
                className="text-[13px] font-semibold text-[#8B1E2D]"
              >
                Lihat semua
              </button>
            ) : null}
          </div>
          {myCommunities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
              <p className="text-[13px] text-slate-500">
                Belum join komunitas. Cari di Popular di bawah.
              </p>
              <button
                type="button"
                onClick={() => navigate("/community/manage")}
                className="mt-3 text-[13px] font-semibold text-primary"
              >
                Buka My Communities
              </button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {myCommunities.map((c) => (
                <Link
                  key={c.id}
                  to={`/community/${c.id}`}
                  className="snap-start shrink-0 w-[148px] rounded-2xl bg-white p-3 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 active:scale-[0.98] transition-transform"
                >
                  <div className="mx-auto size-12 overflow-hidden rounded-full bg-[#8B1E2D]/10">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center text-[#8B1E2D]">
                        <span className="material-symbols-outlined text-[22px]">groups</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2.5 truncate text-center text-[13px] font-bold text-slate-900">{c.name}</p>
                  <p className="mt-0.5 truncate text-center text-[11px] text-slate-500">
                    {c.my_role || "member"} · {formatMemberCount(c.member_count)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Sport categories */}
        <section className="px-4 pt-6">
          <h2 className="text-[17px] font-bold text-slate-900 mb-3.5">Communities on WELL!</h2>
          {loading ? (
            <p className="text-xs text-slate-500 py-8 text-center">Memuat kategori…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {sportsVisible.map((sport) => {
                  const icon =
                    sport.icon || SPORT_ICON_FALLBACK[sport.sport_key] || "sports";
                  return (
                    <Link
                      key={sport.sport_key}
                      to={`/community/sports/${sport.sport_key}`}
                      className="rounded-2xl bg-white p-3.5 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 active:scale-[0.98] transition-transform"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg, #ffffff, #ffffff 7px, #f3f4f6 7px, #f3f4f6 8px)",
                      }}
                    >
                      <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-[#8B1E2D] text-white shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">{icon}</span>
                      </div>
                      <p className="text-[13px] font-bold leading-tight text-slate-900 truncate">
                        {sport.name}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-tight text-slate-400 truncate">
                        {formatAyoCount(sport.community_count)} Commu..
                      </p>
                    </Link>
                  );
                })}
              </div>
              {(hub.sports || []).length > 6 ? (
                <button
                  type="button"
                  onClick={() => setShowAllSports((v) => !v)}
                  className="mt-4 w-full flex items-center justify-center gap-0.5 text-[14px] font-semibold text-[#8B1E2D]"
                >
                  {showAllSports ? "View Less" : "View More"}
                  <span className="material-symbols-outlined text-[20px]">
                    {showAllSports ? "expand_less" : "expand_more"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAllSports(true)}
                  className="mt-4 w-full flex items-center justify-center gap-0.5 text-[14px] font-semibold text-[#8B1E2D]"
                >
                  View More
                  <span className="material-symbols-outlined text-[20px]">expand_more</span>
                </button>
              )}
            </>
          )}
        </section>

        {/* Popular — horizontal cards ala AYO (logo centered + avatar stack) */}
        <section className="px-4 pt-7 pb-2">
          <h2 className="text-[17px] font-bold text-slate-900 mb-4">Popular Communities</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-pl-0">
            {(hub.popular || []).map((c, idx) => {
              const avatars = memberAvatarPalette(c.id || idx);
              return (
                <Link
                  key={c.id}
                  to={`/community/${c.id}`}
                  className="snap-start shrink-0 w-[min(86%,300px)] rounded-[18px] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.10)] ring-1 ring-slate-100/90 active:scale-[0.99] transition-transform"
                >
                  <div className="relative">
                    <div className="relative h-[140px] overflow-hidden rounded-t-[18px] bg-slate-800">
                      {c.banner_url ? (
                        <img src={c.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-primary/40" />
                      )}
                      <div className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-r from-[#0b1f3a]/92 via-[#0b1f3a]/75 to-transparent" />
                      <div className="absolute left-3.5 top-1/2 z-10 max-w-[42%] -translate-y-1/2 pr-1">
                        <p className="text-[13px] font-extrabold leading-tight text-white drop-shadow">
                          {c.name.split(" ").slice(0, 3).join(" ")}
                        </p>
                        <p className="mt-1 text-[10px] font-medium leading-snug text-white/80">
                          Beginner friendly coaching &amp; mabar
                        </p>
                      </div>
                    </div>
                    {/* Logo di luar overflow banner agar tidak terpotong */}
                    <div className="absolute left-1/2 top-[140px] z-20 size-14 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-white bg-white shadow-[0_2px_10px_rgba(15,23,42,0.18)]">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="size-full flex items-center justify-center bg-[#8B1E2D]/10 text-[#8B1E2D]">
                          <span className="material-symbols-outlined text-[26px]">groups</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center rounded-b-[18px] px-5 pb-5 pt-10 text-center">
                    <p className="text-[15px] font-bold leading-snug text-slate-900 px-1">
                      {c.name}
                    </p>
                    <p className="mt-1 flex items-center justify-center gap-1 text-[12px] leading-none text-slate-500">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">sports_tennis</span>
                      <span>
                        {c.sport_name || c.sport_key} · {formatMemberCount(c.member_count)} Members
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] leading-none text-slate-500">
                      {c.city || "Indonesia"}
                    </p>

                    <div className="mt-4 flex items-center justify-center">
                      <div className="flex -space-x-2.5">
                        {avatars.map((av) => (
                          <span
                            key={av.key}
                            className="inline-flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[9px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: av.color }}
                            title={av.label}
                          >
                            {av.photo ? (
                              <img src={av.photo} alt="" className="size-full object-cover" />
                            ) : (
                              av.label
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {/* peek ruang kanan saat scroll */}
            <div className="w-1 shrink-0" aria-hidden />
          </div>
        </section>

        {searchParams.get("q") && (hub.communities || []).length > 0 ? (
          <section className="px-4 pb-6 space-y-2">
            <h2 className="text-[15px] font-bold mb-2">Hasil pencarian</h2>
            {hub.communities.map((c) => (
              <Link
                key={c.id}
                to={`/community/${c.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
              >
                <div className="size-12 overflow-hidden rounded-full bg-slate-100">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center text-[#8B1E2D]">
                      <span className="material-symbols-outlined">groups</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.sport_name} · {c.city}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        ) : null}
      </div>

      <CommunityCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </CommunityShell>
  );
}
