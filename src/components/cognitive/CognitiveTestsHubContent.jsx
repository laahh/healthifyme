import { Link, useLocation } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";

export default function CognitiveTestsHubContent() {
  const location = useLocation();
  const user = getSessionUser();
  const name = String(user?.name || user?.nama || "Pengguna").trim().split(/\s+/)[0] || "Pengguna";

  return (
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-outline-variant/20 bg-surface/95 px-4 py-3 backdrop-blur-md">
        <Link
          to="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-primary/10"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div>
          <h1 className="font-headline text-lg font-bold tracking-tight">TES PVT</h1>
          <p className="text-[11px] text-on-surface-variant">Tes kewaspadaan &amp; memori kerja</p>
        </div>
      </header>

      <main className="px-4 pt-6">
        <p className="mb-5 text-sm leading-relaxed text-on-surface-variant">
          Halo <span className="font-semibold text-on-surface">{name}</span>, pilih alur di bawah. Hasil disimpan per akun di perangkat ini.
        </p>

        <Link
          to="/cognitive-tests/session"
          className="mb-5 flex w-full flex-col gap-3 overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-4 shadow-md transition-colors hover:from-primary/16 active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
                <span className="material-symbols-outlined text-2xl">fact_check</span>
              </div>
              <div className="text-left">
                <p className="font-headline text-base font-bold text-on-surface">Tes PVT dan Tes Memori Kerja</p>
                <p className="text-xs text-on-surface-variant">PVT → memori pola (sama/berbeda) + ringkasan layak bekerja</p>
              </div>
            </div>
            <span className="material-symbols-outlined shrink-0 text-primary">chevron_right</span>
          </div>
          <span className="inline-flex w-fit rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Alur utama
          </span>
        </Link>

        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Riwayat Tes</p>
        <div className="space-y-3">
          {/* <Link
            to="/cognitive-tests/pvt"
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm transition-colors hover:bg-surface-container-high active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <span className="material-symbols-outlined text-2xl">schedule</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-on-surface">Hanya PVT</p>
                <p className="text-xs text-on-surface-variant">Reaksi terhadap sinyal setelah jeda acak</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/50">chevron_right</span>
          </Link> */}
{/* 
          <Link
            to="/cognitive-tests/memory"
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm transition-colors hover:bg-surface-container-high active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-tertiary/12 text-tertiary">
                <span className="material-symbols-outlined text-2xl">psychology</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-on-surface">Hanya memori kerja</p>
                <p className="text-xs text-on-surface-variant">Grid 4×4: ingat pola, bandingkan sama atau berbeda</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/50">chevron_right</span>
          </Link> */}

          <Link
            to="/cognitive-tests/results"
            state={{ from: location.pathname }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/8 py-3.5 text-sm font-bold text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            Lihat riwayat hasil saya
          </Link>
        </div>
      </main>
    </div>
  );
}
