/** Default Unsplash covers per sport — dipakai jika host tidak upload. */
const DEFAULT_COVERS = {
  padel:
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop&q=80",
  tennis:
    "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop&q=80",
  badminton:
    "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
  pickleball:
    "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
  futsal:
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80",
  mini_soccer:
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80",
  sepak_bola:
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80",
  basketball:
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80",
  volleyball:
    "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&auto=format&fit=crop&q=80",
  running:
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&auto=format&fit=crop&q=80",
  yoga:
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=80",
  fitness:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&auto=format&fit=crop&q=80",
};

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1517649763962-0c623066027e?w=800&auto=format&fit=crop&q=80";

export function defaultOpenPlayCover(sportKey) {
  const key = String(sportKey || "").toLowerCase();
  return DEFAULT_COVERS[key] || FALLBACK_COVER;
}

/** Resolve cover: uploaded URL / data URL, else default by sport. */
export function resolveOpenPlayCover(event) {
  const custom = String(event?.cover_url || "").trim();
  if (custom) return custom;
  return defaultOpenPlayCover(event?.sport_key);
}
