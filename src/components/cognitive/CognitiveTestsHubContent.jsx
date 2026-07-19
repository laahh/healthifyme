import { Link, useLocation } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";
import { getCognitiveResultsForUser, getCognitiveUserKey } from "../../lib/cognitiveTestStorage";

function formatAt(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function lastSessionTone(color) {
  if (color === "emerald") {
    return {
      wrap: "border-emerald-200 bg-emerald-50",
      chip: "bg-emerald-100 text-emerald-800",
      label: "Lulus skrining",
    };
  }
  if (color === "red") {
    return {
      wrap: "border-red-200 bg-red-50",
      chip: "bg-red-100 text-red-800",
      label: "Perlu perhatian",
    };
  }
  if (color === "amber") {
    return {
      wrap: "border-amber-200 bg-amber-50",
      chip: "bg-amber-100 text-amber-900",
      label: "Waspada",
    };
  }
  return {
    wrap: "border-slate-200 bg-slate-50",
    chip: "bg-slate-200 text-slate-700",
    label: "Belum ada hasil",
  };
}

export default function CognitiveTestsHubContent() {
  const location = useLocation();
  const user = getSessionUser();
  const name =
    String(user?.name || user?.nama || "Pengguna")
      .trim()
      .split(/\s+/)[0] || "Pengguna";

  const userKey = getCognitiveUserKey(user);
  const { sessions } = getCognitiveResultsForUser(userKey);
  const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const tone = lastSessionTone(lastSession?.overall?.color);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-28 font-['Public_Sans',sans-serif] text-on-surface">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <Link
          to="/profile"
          className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary/10"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">Tes Kognitif</h1>
          <p className="text-[11px] text-slate-500">Kewaspadaan &amp; memori kerja</p>
        </div>
        <Link
          to="/cognitive-tests/results"
          state={{ from: location.pathname }}
          className="flex size-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          aria-label="Riwayat hasil"
        >
          <span className="material-symbols-outlined">analytics</span>
        </Link>
      </header>

      <main className="space-y-5 px-4 pt-5">
        <section>
          <p className="text-sm leading-relaxed text-slate-600">
            Halo <span className="font-semibold text-slate-900">{name}</span> — skrining singkat untuk
            memantau kewaspadaan (PVT) dan memori kerja sebelum tugas.
          </p>
        </section>

        <section className={`rounded-2xl border px-4 py-4 ${tone.wrap}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Hasil sesi terakhir
              </p>
              {lastSession ? (
                <>
                  <p className="mt-1 text-[15px] font-bold leading-snug text-slate-900">
                    {lastSession.overall?.title || "Sesi kognitif"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">{formatAt(lastSession.at)}</p>
                </>
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  Belum ada sesi. Mulai tes untuk melihat status di sini.
                </p>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${tone.chip}`}>
              {tone.label}
            </span>
          </div>
          {lastSession ? (
            <Link
              to="/cognitive-tests/results"
              state={{ from: location.pathname }}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-primary"
            >
              Lihat riwayat
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          ) : null}
        </section>

        <Link
          to="/cognitive-tests/session"
          className="flex w-full flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-4 shadow-sm transition active:scale-[0.99]"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <span className="material-symbols-outlined text-2xl">fact_check</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-base font-bold text-slate-900">Mulai sesi lengkap</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                PVT → memori kerja → ringkasan layak bekerja
              </p>
            </div>
            <span className="material-symbols-outlined shrink-0 text-primary">chevron_right</span>
          </div>
          <span className="inline-flex w-fit rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Alur utama
          </span>
        </Link>

        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Apa yang diuji
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[20px]">bolt</span>
              </div>
              <p className="text-[13px] font-bold text-slate-900">PVT</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Reaksi terhadap sinyal setelah jeda acak
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <span className="material-symbols-outlined text-[20px]">psychology</span>
              </div>
              <p className="text-[13px] font-bold text-slate-900">Memori</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Ingat pola grid, bandingkan sama/berbeda
              </p>
            </div>
          </div>
        </section>

        <Link
          to="/cognitive-tests/results"
          state={{ from: location.pathname }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">history</span>
          Riwayat hasil
        </Link>

        <p className="pb-2 text-center text-[10px] leading-relaxed text-slate-400">
          Hasil disimpan per akun di perangkat ini. Bukan diagnosis medis.
        </p>
      </main>
    </div>
  );
}
