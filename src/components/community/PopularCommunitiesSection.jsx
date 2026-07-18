import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FALLBACK_HUB, fetchCommunityHub } from "../../lib/communityApi";
import { formatMemberCount } from "./CommunityShell";

const AVATAR_COLORS = ["#0d9488", "#f97316", "#ec4899", "#6366f1", "#14b8a6", "#e11d48"];
const AVATAR_PHOTOS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop",
];

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

/**
 * @param {{ title?: string, showHeaderLink?: boolean, className?: string, communities?: object[] | null }} props
 * Jika `communities` diisi, tidak fetch (untuk hub). Jika null/undefined, fetch dari API.
 */
export default function PopularCommunitiesSection({
  title = "Popular Communities",
  showHeaderLink = true,
  className = "px-4 pt-4 pb-4",
  communities: communitiesProp,
}) {
  const [fetched, setFetched] = useState([]);
  const [loading, setLoading] = useState(communitiesProp === undefined);

  useEffect(() => {
    if (communitiesProp !== undefined) return;
    let cancelled = false;
    setLoading(true);
    fetchCommunityHub()
      .then((data) => {
        if (!cancelled) setFetched(data?.popular || FALLBACK_HUB.popular || []);
      })
      .catch(() => {
        if (!cancelled) setFetched(FALLBACK_HUB.popular || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [communitiesProp]);

  const list =
    communitiesProp !== undefined ? communitiesProp || [] : fetched;

  if (!loading && list.length === 0) return null;

  return (
    <section className={className}>
      <div className="flex justify-between items-center mb-3.5">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {showHeaderLink ? (
          <Link to="/community" className="text-xs font-semibold text-primary">
            Lihat Semua
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[220px] w-[min(72%,260px)] shrink-0 animate-pulse rounded-[18px] bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1">
          {list.map((c, idx) => {
            const avatars = memberAvatarPalette(c.id || idx);
            const tagline =
              (c.tagline || c.description || "").trim() ||
              "Komunitas olahraga & mabar bareng";
            return (
              <Link
                key={c.id}
                to={`/community/${c.id}`}
                className="snap-start shrink-0 w-[min(86%,280px)] rounded-[18px] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.10)] ring-1 ring-slate-100/90 active:scale-[0.99] transition-transform"
              >
                <div className="relative">
                  <div className="relative h-[120px] overflow-hidden rounded-t-[18px] bg-slate-800">
                    {c.banner_url ? (
                      <img src={c.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-primary/40" />
                    )}
                    <div className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-r from-[#0b1f3a]/92 via-[#0b1f3a]/75 to-transparent" />
                    <div className="absolute left-3 top-1/2 z-10 max-w-[42%] -translate-y-1/2 pr-1">
                      <p className="text-[12px] font-extrabold leading-tight text-white drop-shadow line-clamp-2">
                        {c.name}
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-1/2 top-[120px] z-20 size-12 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-white bg-white shadow-[0_2px_10px_rgba(15,23,42,0.18)]">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center bg-[#8B1E2D]/10 text-[#8B1E2D]">
                        <span className="material-symbols-outlined text-[22px]">groups</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center rounded-b-[18px] px-4 pb-4 pt-9 text-center">
                  <p className="text-[14px] font-bold leading-snug text-slate-900 line-clamp-2">{c.name}</p>
                  <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-slate-500">
                    <span className="material-symbols-outlined text-[13px] text-slate-400">sports_tennis</span>
                    <span>
                      {c.sport_name || c.sport_key} · {formatMemberCount(c.member_count)} anggota
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{c.city || "Indonesia"}</p>
                  <p className="mt-2 text-[10px] leading-snug text-slate-400 line-clamp-2 px-1">{tagline}</p>
                  <div className="mt-3 flex items-center justify-center">
                    <div className="flex -space-x-2">
                      {avatars.map((av) => (
                        <span
                          key={av.key}
                          className="inline-flex size-6 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[8px] font-bold text-white shadow-sm"
                          style={{ backgroundColor: av.color }}
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
          <div className="w-1 shrink-0" aria-hidden />
        </div>
      )}
    </section>
  );
}
