import { Link } from "react-router-dom";
import AppBottomNav from "../layout/AppBottomNav";

export default function SocialHubContent() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-28 font-['Public_Sans',sans-serif] text-on-surface">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary/10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Sosial</h1>
            <p className="text-[11px] text-slate-500">Komunitas &amp; main bareng</p>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 pt-5">
        <p className="text-sm leading-relaxed text-slate-600">
          Temukan komunitas olahraga dan jadwal main bareng di sekitar Anda.
        </p>

        <Link
          to="/community"
          className="flex items-start gap-3 rounded-2xl border-2 border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-transparent p-4 shadow-sm active:scale-[0.99]"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <span className="material-symbols-outlined text-2xl">groups</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-900">Komunitas</p>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
              Gabung grup olahraga, feed, event, dan leaderboard
            </p>
            <span className="mt-2 inline-flex items-center gap-0.5 text-[12px] font-bold text-indigo-600">
              Buka
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </span>
          </div>
        </Link>

        <Link
          to="/open-play"
          className="flex items-start gap-3 rounded-2xl border-2 border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-transparent p-4 shadow-sm active:scale-[0.99]"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <span className="material-symbols-outlined text-2xl">sports_tennis</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-900">Main Bareng</p>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
              Open play — cari lawan, join sesi, atau buat jadwal baru
            </p>
            <span className="mt-2 inline-flex items-center gap-0.5 text-[12px] font-bold text-orange-600">
              Buka
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </span>
          </div>
        </Link>

        <p className="pt-2 text-center text-[10px] text-slate-400">
          Olahraga &amp; insight tetap tersedia dari Beranda atau Profil.
        </p>
      </main>

      <AppBottomNav />
    </div>
  );
}
