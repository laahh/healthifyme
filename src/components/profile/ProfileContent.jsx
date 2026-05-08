import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSessionUser, logout, mergeSessionUser } from "../../auth/auth";
import { upsertProfileToCloud } from "../../services/supabaseDataService";

const FALLBACK_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB7uwxn84_hs7oaiFQKLbY8Y-f6y693VmByLqOGrcuA-6v64TcopIAZDvqqRbuzbrkuxM-pg1MkjTwcvsrU3tvYgiBkKItP0qtNqqx-sailK7sQv4jDejfx1_ni-xcQ-frac1FsVCI7bOn9-1fejw0U6l9C01hDLQZ6psZ2La1RnaOfkp8bI9vr2jEd_l3nE7QULFkpC3rdsEBOsNTajMnpxUadnp1jj199t_1nXryacDVai90wtEXEjWZ84YSz4vgyLw0E3pTlJD3H";

export default function ProfileContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const isNavActive = (path) => currentPath === path;
  const navItemClass = (path) =>
    `flex flex-col items-center gap-1 ${isNavActive(path) ? "text-primary" : "text-slate-400"}`;
  const navLabelClass = (path) => `text-[10px] ${isNavActive(path) ? "font-bold" : "font-medium"}`;
  const [, setSessionTick] = useState(0);
  const [activeMenu, setActiveMenu] = useState(null); // null | profile | address | orders | mcu
  const [query, setQuery] = useState("");

  const [profile, setProfile] = useState(() => {
    const u = getSessionUser();
    if (u) return { name: u.name || "", phone: u.phone || "", email: u.email || "" };
    try {
      return JSON.parse(localStorage.getItem("profile_info_v1")) || { name: "", phone: "", email: "" };
    } catch {
      return { name: "", phone: "", email: "" };
    }
  });

  const [address, setAddress] = useState(() => {
    const u = getSessionUser();
    if (u?.address) return { label: u.address.label || "", detail: u.address.detail || "", city: u.address.city || "" };
    try {
      return JSON.parse(localStorage.getItem("profile_address_v1")) || { label: "Rumah", detail: "", city: "" };
    } catch {
      return { label: "Rumah", detail: "", city: "" };
    }
  });

  const user = getSessionUser();

  const orders = useMemo(() => {
    try {
      const raw = localStorage.getItem("health_upload_history_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      const mapped = Array.isArray(parsed)
        ? parsed.map((it) => ({
            id: it.id,
            type: it.type,
            image: it.image,
            title: it.type === "food" ? "Upload makanan" : "Upload olahraga",
            createdAt: it.createdAt,
          }))
        : [];
      return mapped.filter((o) => o.title.toLowerCase().includes(query.toLowerCase()));
    } catch {
      return [];
    }
  }, [query]);

  const saveProfile = async () => {
    const nextUser = mergeSessionUser({ name: profile.name, phone: profile.phone, email: profile.email });
    localStorage.setItem("profile_info_v1", JSON.stringify(profile));
    if (nextUser?.id) {
      upsertProfileToCloud(nextUser.id, {
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        address: nextUser.address || null,
      }).catch(() => {});
    }
    setSessionTick((x) => x + 1);
  };

  const saveAddress = async () => {
    const nextUser = mergeSessionUser({ address: { ...address } });
    localStorage.setItem("profile_address_v1", JSON.stringify(address));
    if (nextUser?.id) {
      upsertProfileToCloud(nextUser.id, {
        name: nextUser.name || "",
        phone: nextUser.phone || "",
        email: nextUser.email || "",
        address: { ...address },
      }).catch(() => {});
    }
    setSessionTick((x) => x + 1);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const displayName = user?.name || "Pengguna";
  const photoUrl = user?.photo || FALLBACK_AVATAR;
  const tier = user?.jabatanFungsional || user?.jabatan_fungsional || "MEMBER";
  const stats = user?.stats || { foodUploads: 0, activityUploads: 0, coupons: 0 };
  const mcu = user?.mcu;
  const mcuEntries = useMemo(() => {
    if (!mcu || typeof mcu !== "object") return [];
    return Object.entries(mcu).filter(([, value]) => value != null && String(value).trim() !== "");
  }, [mcu]);

  const mcuLabelMap = {
    tanggal: "Tanggal",
    lokasi: "Lokasi",
    gulaDarahPuasa: "Gula darah puasa",
    kolesterolTotal: "Kolesterol total",
    catatan: "Catatan",
    GDP: "GDP",
    Kolesterol: "Kolesterol",
    IMT: "IMT",
    GulaDarahPuasa: "Gula darah puasa (raw)",
    KolesterolTotal: "Kolesterol total (raw)",
    SindromMetabolik: "Sindrom metabolik",
    FraminghamScore: "Framingham score",
  };

  const toReadableLabel = (key) =>
    (mcuLabelMap[key] || key)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .trim();

  return (
    <div className="bg-surface text-on-background min-h-screen pb-32 min-h-[max(884px,100dvh)]">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-emerald-50/80 dark:bg-zinc-950/80 backdrop-blur-xl no-border shadow-none">
        <div className="flex items-center gap-4">
          <Link
            to="/home"
            className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-zinc-800/50 transition-colors p-2 rounded-full active:scale-95 duration-150"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <span className="text-2xl font-black tracking-tighter text-emerald-800 dark:text-emerald-400">Well</span>
        </div>
        <button
          type="button"
          className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-zinc-800/50 transition-colors p-2 rounded-full active:scale-95 duration-150"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto">
        {activeMenu === "profile" && (
          <section className="space-y-4">
            <button type="button" onClick={() => setActiveMenu(null)} className="text-sm font-semibold text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Kembali
            </button>
            <div className="p-5 rounded-[2rem] bg-surface-container-lowest border border-outline-variant/10 space-y-4">
              <h2 className="text-xl font-extrabold">My Profile</h2>
              <input
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container-highest"
                placeholder="Nama lengkap"
              />
              <input
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container-highest"
                placeholder="Nomor telepon"
              />
              <input
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container-highest"
                placeholder="Email"
              />
              <button type="button" onClick={saveProfile} className="w-full h-12 rounded-full bg-primary text-white font-bold">
                Simpan Profile
              </button>
            </div>
          </section>
        )}

        {activeMenu === "address" && (
          <section className="space-y-4">
            <button type="button" onClick={() => setActiveMenu(null)} className="text-sm font-semibold text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Kembali
            </button>
            <div className="p-5 rounded-[2rem] bg-surface-container-lowest border border-outline-variant/10 space-y-4">
              <h2 className="text-xl font-extrabold">Address Book</h2>
              <input
                value={address.label}
                onChange={(e) => setAddress((a) => ({ ...a, label: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container-highest"
                placeholder="Label alamat"
              />
              <textarea
                value={address.detail}
                onChange={(e) => setAddress((a) => ({ ...a, detail: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container-highest min-h-24"
                placeholder="Detail alamat"
              />
              <input
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container-highest"
                placeholder="Kota"
              />
              <button type="button" onClick={saveAddress} className="w-full h-12 rounded-full bg-primary text-white font-bold">
                Simpan Alamat
              </button>
            </div>
          </section>
        )}

        {activeMenu === "orders" && (
          <section className="space-y-4">
            <button type="button" onClick={() => setActiveMenu(null)} className="text-sm font-semibold text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Kembali
            </button>
            <div className="relative flex items-center">
              <span className="absolute left-4 material-symbols-outlined text-on-surface-variant">search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-2xl"
                placeholder="Cari history upload..."
              />
            </div>
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 text-sm text-on-surface-variant">
                  Belum ada history upload.
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="flex gap-3 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/10">
                    <img src={order.image} alt="" className="w-16 h-16 rounded-xl object-cover bg-surface-container-high" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-on-surface">{order.title}</p>
                      <p className="text-xs text-on-surface-variant capitalize">{order.type}</p>
                      <p className="text-xs text-on-surface-variant">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeMenu === "mcu" && (
          <section className="space-y-4">
            <button type="button" onClick={() => setActiveMenu(null)} className="text-sm font-semibold text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Kembali
            </button>
            <div className="p-5 rounded-[2rem] bg-surface-container-lowest border border-outline-variant/10 space-y-4">
              <h2 className="text-xl font-extrabold">Data MCU</h2>
              <p className="text-sm text-on-surface-variant">Riwayat medical check-up</p>
              {mcuEntries.length > 0 ? (
                <dl className="space-y-3 text-sm">
                  {mcuEntries.map(([key, value], index) => {
                    const isLast = index === mcuEntries.length - 1;
                    const isLongText = key.toLowerCase().includes("catatan") || String(value).length > 60;
                    return (
                      <div
                        key={key}
                        className={`flex gap-4 ${isLongText ? "flex-col" : "justify-between"} ${!isLast ? "border-b border-outline-variant/10 pb-2" : ""}`}
                      >
                        <dt className="text-on-surface-variant">{toReadableLabel(key)}</dt>
                        <dd className={`text-on-surface ${isLongText ? "leading-relaxed" : "font-medium text-right"}`}>{value}</dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <p className="text-sm text-on-surface-variant">Belum ada data MCU untuk akun ini.</p>
              )}
            </div>
          </section>
        )}

        {!activeMenu && (
          <>
            <section className="relative mb-8">
              <div className="bg-surface-container-low rounded-3xl p-8 flex flex-col items-center text-center overflow-hidden">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-primary to-primary-fixed shadow-lg shadow-primary/10">
                    <img alt="" className="w-full h-full rounded-full object-cover" src={photoUrl} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMenu("profile")}
                    className="absolute bottom-0 right-0 bg-primary p-2 rounded-full text-on-primary shadow-lg border-2 border-surface-container-low hover:scale-110 transition-transform active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>
                <div className="mt-4">
                  <h1 className="text-2xl font-bold tracking-tight text-on-surface">{displayName}</h1>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="bg-primary/10 text-primary text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        stars
                      </span>
                      {tier}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-8 mt-8 w-full border-t border-outline-variant/10 pt-6">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">75%</p>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium">Score kkal makanan</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">50%</p>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium">⁠⁠score olahraga</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{stats.coupons}</p>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium">Coupons</p>
                  </div>
                </div>
              </div>
            </section>

            {mcu ? (
              <section className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/15">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">MCU terakhir</p>
                    <p className="text-sm font-semibold text-on-surface mt-1">{mcu.tanggal}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{mcu.catatan}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMenu("mcu")}
                    className="shrink-0 text-xs font-bold text-primary px-3 py-2 rounded-full bg-primary/10"
                  >
                    Detail
                  </button>
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-4 px-2">Account Settings</h2>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveMenu("profile")}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl group hover:bg-surface-container-high transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <span className="font-medium text-on-surface">My Profile</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">chevron_right</span>
                </button>

                {/* <button
                  type="button"
                  onClick={() => setActiveMenu("address")}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl group hover:bg-surface-container-high transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                      <span className="material-symbols-outlined">location_on</span>
                    </div>
                    <span className="font-medium text-on-surface">Address Book</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">chevron_right</span>
                </button> */}

                <button
                  type="button"
                  onClick={() => setActiveMenu("mcu")}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl group hover:bg-surface-container-high transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                      <span className="material-symbols-outlined">monitor_heart</span>
                    </div>
                    <span className="font-medium text-on-surface">Data MCU</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">chevron_right</span>
                </button>

                {/* <button
                  type="button"
                  onClick={() => setActiveMenu("orders")}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl group hover:bg-surface-container-high transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                      <span className="material-symbols-outlined">payments</span>
                    </div>
                    <span className="font-medium text-on-surface">Payment Methods</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">chevron_right</span>
                </button> */}

                {/* <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl group hover:bg-surface-container-high transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                      <span className="material-symbols-outlined">history</span>
                    </div>
                    <span className="font-medium text-on-surface">Order History</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">chevron_right</span>
                </button> */}
              </div>

              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mt-8 mb-4 px-2">Support &amp; Legal</h2>
              <div className="space-y-1">
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl group hover:bg-surface-container-high transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">help_center</span>
                    </div>
                    <span className="font-medium text-on-surface">Help Center</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">chevron_right</span>
                </button>

                <Link
                  to="/cognitive-tests"
                  className="w-full flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl group hover:bg-surface-container-high transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                      <span className="material-symbols-outlined">biotech</span>
                    </div>
                    <div className="text-left">
                      <span className="font-medium text-on-surface block">TES PVT</span>
                      <span className="text-xs text-on-surface-variant">Kewaspadaan psikomotor &amp; memori kerja</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 group-hover:text-primary transition-colors">chevron_right</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 p-5 bg-surface-container-low mt-8 rounded-2xl group border border-outline-variant/10 hover:bg-error-container hover:border-error/20 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-error">logout</span>
                  <span className="font-bold text-error tracking-tight">Logout</span>
                </button>
              </div>
            </section>

            <p className="text-center text-[10px] text-on-surface-variant/40 font-medium uppercase tracking-[0.3em] mt-12 mb-8">Well v2.4.1 (Emerald)</p>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-20">
          <Link to="/home" className={navItemClass("/home")} href="#">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${isNavActive("/home") ? 1 : 0}` }}
            >
              grid_view
            </span>
            <span className={navLabelClass("/home")}>Dashboard</span>
          </Link>
          <Link className={navItemClass("/nutrition/insight")} to="/nutrition/insight">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${isNavActive("/nutrition/insight") ? 1 : 0}` }}
            >
              restaurant
            </span>
            <span className={navLabelClass("/nutrition/insight")}>Makanan</span>
          </Link>
          <div className="relative -top-8">
            <Link to="/activity/capture" className="size-14 bg-primary rounded-full text-white shadow-xl shadow-primary/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">add</span>
            </Link>
          </div>
          <Link className={navItemClass("/workout/insight")} to="/workout/insight">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${isNavActive("/workout/insight") ? 1 : 0}` }}
            >
              exercise
            </span>
            <span className={navLabelClass("/workout/insight")}>Olahraga</span>
          </Link>
          <Link className={navItemClass("/profile")} to="/profile">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: `'FILL' ${isNavActive("/profile") ? 1 : 0}` }}
            >
              person
            </span>
            <span className={navLabelClass("/profile")}>Profil</span>
          </Link>
        </nav>
    </div>
  );
}
