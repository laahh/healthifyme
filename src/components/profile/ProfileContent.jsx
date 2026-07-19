import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSessionUser, logout, mergeSessionUser } from "../../auth/auth";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";
import { upsertProfileToCloud } from "../../services/supabaseDataService";
import { showConfirm, showError, showSuccess, showToast } from "../../lib/appAlert";
import ProfileHero from "./ProfileHero";
import ProfileTodayCard from "./ProfileTodayCard";
import ProfileMenuGroup from "./ProfileMenuGroup";
import ProfileEditPanel from "./ProfileEditPanel";
import ProfilePasswordPanel from "./ProfilePasswordPanel";

function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ProfileContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const isNavActive = (path) => currentPath === path;
  const navItemClass = (path) =>
    `flex flex-col items-center gap-1 ${isNavActive(path) ? "text-primary" : "text-slate-400"}`;
  const navLabelClass = (path) =>
    `text-[10px] ${isNavActive(path) ? "font-bold" : "font-medium"}`;

  const [, setSessionTick] = useState(0);
  /** @type {null | "edit" | "password"} */
  const [panel, setPanel] = useState(null);
  const [saving, setSaving] = useState(false);
  /** @type {{ loading: boolean, data: object | null, error: string | null }} */
  const [goalDashboard, setGoalDashboard] = useState({
    loading: false,
    data: null,
    error: null,
  });

  const [profile, setProfile] = useState(() => {
    const u = getSessionUser();
    if (u) return { name: u.name || "", phone: u.phone || "", email: u.email || "" };
    try {
      return (
        JSON.parse(localStorage.getItem("profile_info_v1")) || {
          name: "",
          phone: "",
          email: "",
        }
      );
    } catch {
      return { name: "", phone: "", email: "" };
    }
  });

  const user = getSessionUser();
  const onMainView = panel == null;

  useEffect(() => {
    if (!onMainView || !user?.id || !isApiBackendEnabled()) {
      if (!user?.id || !isApiBackendEnabled()) {
        setGoalDashboard({ loading: false, data: null, error: null });
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setGoalDashboard({ loading: true, data: null, error: null });
      try {
        const date = localTodayYmd();
        const data = await apiRequest(`/me/goals/dashboard?date=${encodeURIComponent(date)}`);
        if (!cancelled) setGoalDashboard({ loading: false, data, error: null });
      } catch (e) {
        if (!cancelled) {
          setGoalDashboard({
            loading: false,
            data: null,
            error: e instanceof Error ? e.message : "Gagal memuat goal",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onMainView, user?.id]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const nextUser = mergeSessionUser({
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
      });
      localStorage.setItem("profile_info_v1", JSON.stringify(profile));
      if (nextUser?.id) {
        await upsertProfileToCloud(nextUser.id, {
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        address: nextUser.address || null,
      }).catch(() => {});
    }
    setSessionTick((x) => x + 1);
      showSuccess("Profil disimpan");
      setPanel(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Gagal menyimpan profil", "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (!isApiBackendEnabled()) {
      showError("Tidak tersedia", "Ganti password membutuhkan koneksi ke API server.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        json: { currentPassword, newPassword, confirmPassword },
      });
      showSuccess("Password diubah", "Gunakan password baru saat login berikutnya.");
      setPanel(null);
    } catch (e) {
      showError("Gagal ganti password", e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const ok = await showConfirm("Keluar akun?", "Anda akan keluar dari sesi ini.", "Ya, keluar");
    if (!ok) return;
    await logout();
    navigate("/login", { replace: true });
  };

  const displayName = user?.name || profile.name || "Pengguna";
  const photoUrl = user?.photo || null;
  const tier = user?.jabatanFungsional || user?.jabatan_fungsional || "MEMBER";

  const todayCardProps = useMemo(() => {
    const dash = goalDashboard.data;
    const tgt = dash?.daily_target;
    const act = dash?.actuals;
    const score = dash?.score;
    const hasGoal = Boolean(dash?.active_goal && tgt);

    let caloriePct = null;
    if (hasGoal && Number(tgt.calorie_target) > 0 && act) {
      caloriePct = Math.min(
        100,
        Math.round((Number(act.calorie || 0) / Number(tgt.calorie_target)) * 100)
      );
    }

    let exercisePct = null;
    if (hasGoal && Number(tgt.exercise_duration_target_min) > 0 && act) {
      exercisePct = Math.min(
        100,
        Math.round(
          (Number(act.exercise_min || 0) / Number(tgt.exercise_duration_target_min)) * 100
        )
      );
    }

    return {
      loading: goalDashboard.loading,
      hasGoal,
      error: goalDashboard.error,
      healthScore:
        score?.total_score != null && hasGoal ? Math.round(Number(score.total_score)) : null,
      caloriePct,
      exercisePct,
      calorieTargetKcal:
        hasGoal && tgt?.calorie_target != null ? Math.round(Number(tgt.calorie_target)) : null,
      calorieActual: hasGoal && act ? Number(act.calorie || 0) : null,
      exerciseActualMin: hasGoal && act ? Number(act.exercise_min || 0) : null,
      exerciseTargetMin:
        hasGoal && tgt?.exercise_duration_target_min != null
          ? Math.round(Number(tgt.exercise_duration_target_min))
          : null,
    };
  }, [goalDashboard.data, goalDashboard.loading, goalDashboard.error]);

  const healthMenu = useMemo(
    () => [
      {
        key: "mcu",
        label: "Data MCU",
        subtitle: "Hasil medical check-up",
        icon: "monitor_heart",
        to: "/mcu",
      },
      {
        key: "nutrition",
        label: "Insight Nutrisi",
        subtitle: "Asupan & status kesehatan",
        icon: "restaurant",
        to: "/nutrition/insight",
      },
      {
        key: "workout",
        label: "Insight Olahraga",
        subtitle: "Aktivitas & target menit",
        icon: "exercise",
        to: "/workout/insight",
      },
    ],
    []
  );

  const accountMenu = useMemo(
    () => [
      {
        key: "edit",
        label: "Edit profil",
        subtitle: "Nama, telepon, email",
        icon: "person",
        onClick: () => setPanel("edit"),
      },
      {
        key: "password",
        label: "Ganti password",
        subtitle: "Ubah password login akun",
        icon: "lock",
        onClick: () => setPanel("password"),
      },
      {
        key: "strava",
        label: "Strava",
        subtitle: "Hubungkan & sync aktivitas",
        icon: "directions_run",
        iconClass: "bg-orange-50 text-[#fc4c02]",
        to: "/strava",
      },
      {
        key: "history",
        label: "Riwayat",
        subtitle: "Upload makanan & olahraga",
        icon: "history",
        to: "/history",
      },
      {
        key: "pvt",
        label: "TES PVT",
        subtitle: "Kewaspadaan & memori kerja",
        icon: "biotech",
        to: "/cognitive-tests",
      },
    ],
    []
  );

  return (
    <div className="font-['Public_Sans'] min-h-screen bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden pb-28">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <Link
            to="/home"
            className="flex size-12 shrink-0 items-center justify-center"
            aria-label="Kembali"
          >
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
              arrow_back
            </span>
          </Link>
          <h2 className="flex-1 text-center text-lg font-bold leading-tight tracking-[-0.015em]">
            Profil
          </h2>
          <div className="flex w-12 items-center justify-end">
            <Link
              to="/mcu"
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="MCU"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
                medical_information
              </span>
            </Link>
          </div>
        </div>

        <main className="space-y-5 px-4 py-4">
          {panel === "edit" ? (
            <ProfileEditPanel
              profile={profile}
              onChange={setProfile}
              onSave={saveProfile}
              onBack={() => setPanel(null)}
              saving={saving}
            />
          ) : panel === "password" ? (
            <ProfilePasswordPanel
              onBack={() => setPanel(null)}
              onSubmit={changePassword}
              saving={saving}
            />
          ) : (
            <>
              <ProfileHero
                displayName={displayName}
                photoUrl={photoUrl}
                tier={tier}
                onEdit={() => setPanel("edit")}
              />

              <ProfileTodayCard {...todayCardProps} />

              <ProfileMenuGroup title="Kesehatan" items={healthMenu} />
              <ProfileMenuGroup title="Akun & aplikasi" items={accountMenu} />

                <button
                  type="button"
                  onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-4 font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-red-950/30"
                >
                <span className="material-symbols-outlined">logout</span>
                Keluar
                </button>

              <p className="pb-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                © OHS Division · 2026
              </p>
          </>
        )}
      </main>

        <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-md items-center justify-between border-t border-slate-100 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <Link to="/home" className={navItemClass("/home")}>
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
              style={{
                fontVariationSettings: `'FILL' ${isNavActive("/nutrition/insight") ? 1 : 0}`,
              }}
            >
              restaurant
            </span>
            <span className={navLabelClass("/nutrition/insight")}>Makanan</span>
          </Link>
          <div className="relative -top-8">
            <Link
              to="/activity/capture"
              className="flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30"
            >
              <span className="material-symbols-outlined text-3xl">add</span>
            </Link>
          </div>
          <Link className={navItemClass("/workout/insight")} to="/workout/insight">
            <span
              className="material-symbols-outlined"
              style={{
                fontVariationSettings: `'FILL' ${isNavActive("/workout/insight") ? 1 : 0}`,
              }}
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
    </div>
  );
}
