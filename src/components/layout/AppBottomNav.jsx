import { Link, useLocation } from "react-router-dom";

/**
 * Bottom nav utama Well:
 * Beranda · Makanan · + · Sosial · Profil
 */
export default function AppBottomNav() {
  const { pathname } = useLocation();

  const isActive = (path) => {
    if (path === "/home") return pathname === "/home" || pathname === "/";
    if (path === "/social") {
      return (
        pathname === "/social" ||
        pathname.startsWith("/community") ||
        pathname.startsWith("/open-play")
      );
    }
    if (path === "/nutrition/insight") {
      return pathname.startsWith("/nutrition") || pathname.startsWith("/food");
    }
    if (path === "/profile") return pathname.startsWith("/profile");
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const itemClass = (path) =>
    `flex flex-col items-center gap-1 ${isActive(path) ? "text-primary" : "text-slate-400"}`;
  const labelClass = (path) =>
    `text-[10px] ${isActive(path) ? "font-bold" : "font-medium"}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-md items-center justify-between border-t border-slate-100 bg-white px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Link to="/home" className={itemClass("/home")}>
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: `'FILL' ${isActive("/home") ? 1 : 0}` }}
        >
          grid_view
        </span>
        <span className={labelClass("/home")}>Beranda</span>
      </Link>

      <Link to="/nutrition/insight" className={itemClass("/nutrition/insight")}>
        <span
          className="material-symbols-outlined"
          style={{
            fontVariationSettings: `'FILL' ${isActive("/nutrition/insight") ? 1 : 0}`,
          }}
        >
          restaurant
        </span>
        <span className={labelClass("/nutrition/insight")}>Makanan</span>
      </Link>

      <div className="relative -top-8">
        <Link
          to="/activity/capture"
          className="flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30"
          aria-label="Tambah"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </Link>
      </div>

      <Link to="/social" className={itemClass("/social")}>
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: `'FILL' ${isActive("/social") ? 1 : 0}` }}
        >
          groups
        </span>
        <span className={labelClass("/social")}>Sosial</span>
      </Link>

      <Link to="/profile" className={itemClass("/profile")}>
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: `'FILL' ${isActive("/profile") ? 1 : 0}` }}
        >
          person
        </span>
        <span className={labelClass("/profile")}>Profil</span>
      </Link>
    </nav>
  );
}
