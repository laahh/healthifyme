import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiRequest, isApiBackendEnabled } from "../../lib/apiClient";

export default function WorkoutExerciseDetailContent() {
  const { id } = useParams();

  const [exercise, setExercise] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isApiBackendEnabled()) {
      setLoading(false);
      setError("Backend belum di-set (VITE_API_URL).");
      return;
    }
    const exerciseId = Number(id);
    if (!Number.isFinite(exerciseId) || exerciseId < 1) {
      setLoading(false);
      setError("ID latihan tidak valid.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(`/exercises/${exerciseId}`);
        if (!cancelled && data?.exercise) setExercise(data.exercise);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat latihan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const joinNames = (arr) =>
    Array.isArray(arr) && arr.length ? arr.map((x) => x.name).filter(Boolean).join(" · ") : "—";

  if (!loading && !error && !exercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="text-center">
          <p className="mb-4 text-on-surface-variant">Latihan tidak ditemukan.</p>
          <Link to="/workout/insight" className="rounded-full bg-primary px-5 py-2 font-semibold text-on-primary">
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-screen max-w-[375px] bg-surface pb-32 text-on-surface antialiased">
      <header className="fixed left-0 top-0 z-50 mx-auto flex w-full max-w-[375px] items-center justify-between bg-emerald-50/80 px-6 py-4 shadow-none backdrop-blur-xl">
        <Link
          to="/workout/insight"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 hover:bg-emerald-100/50 active:scale-95"
        >
          <span className="material-symbols-outlined text-emerald-700">arrow_back</span>
        </Link>
        <span className="text-2xl font-black tracking-tighter text-emerald-800">Detail</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 hover:bg-emerald-100/50 active:scale-95">
          <span className="material-symbols-outlined text-emerald-700">exercise</span>
        </span>
      </header>

      <main className="pt-20">
        {loading && (
          <div className="px-6">
            <div className="mb-4 h-[320px] w-full animate-pulse rounded-none bg-slate-200" />
            <div className="-mt-8 space-y-3 rounded-t-[32px] bg-surface px-0 pt-8">
              <div className="h-8 w-[80%] animate-pulse rounded-lg bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="px-6 py-10">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm">
              {error}
            </div>
            <Link
              to="/workout/insight"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-white"
            >
              Kembali
            </Link>
          </div>
        )}

        {!loading && !error && exercise && (
          <>
            <div className="relative h-[320px] w-full overflow-hidden bg-black">
              {exercise.gifUrl ? (
                <>
                  <img
                    src={exercise.gifUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-700 text-white">
                  <span className="material-symbols-outlined text-[5rem] opacity-90">fitness_center</span>
                  <p className="mt-2 text-sm font-semibold">Visual gerakan</p>
                </div>
              )}
            </div>

            <section className="relative z-10 -mt-8 rounded-t-[32px] bg-surface px-6 pt-8">
              <div className="mb-4 flex items-start justify-between">
                <h1 className="max-w-[72%] text-2xl font-extrabold leading-tight tracking-tight text-on-surface">
                  {exercise.name}
                </h1>
                <span className="rounded-full bg-tertiary/10 px-2 py-1 text-xs font-bold uppercase tracking-widest text-tertiary">
                  Gerakan
                </span>
              </div>

              <p className="mb-4 line-clamp-4 text-on-surface-variant body-md leading-relaxed">
                Ikuti langkah di bawah dengan form yang aman. Sesuaikan set dan repetisi dengan kondisi Anda. Periksa
                ringkasan bagian tubuh dan alat sebelum mulai.
              </p>

              {exercise.exerciseCode ? (
                <div className="mb-6 rounded-2xl bg-surface-container-low p-3">
                  <p className="text-[11px] text-on-surface-variant">Kode latihan</p>
                  <p className="font-mono text-sm font-semibold text-on-surface">{exercise.exerciseCode}</p>
                </div>
              ) : null}

              <div className="mb-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Ringkasan latihan</p>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {[
                      { label: "Bagian tubuh", value: joinNames(exercise.bodyParts) },
                      { label: "Peralatan", value: joinNames(exercise.equipments) },
                      { label: "Otot utama", value: joinNames(exercise.targetMuscles) },
                      ...(exercise.secondaryMuscles?.length
                        ? [{ label: "Otot sekunder", value: joinNames(exercise.secondaryMuscles) }]
                        : []),
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                      >
                        <span className="text-[13px] font-medium text-slate-600">{row.label}</span>
                        <span className="max-w-[55%] shrink-0 text-right text-[13px] font-bold text-slate-900">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {(exercise.bodyParts || []).length > 0 || (exercise.equipments || []).length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Tag</p>
                    <div className="flex flex-wrap gap-2">
                      {(exercise.bodyParts || []).map((p) => (
                        <span
                          key={`bp-${p.id}`}
                          className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                        >
                          {p.name}
                        </span>
                      ))}
                      {(exercise.equipments || []).map((p) => (
                        <span
                          key={`eq-${p.id}`}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {(exercise.instructions || []).length > 0 ? (
                <div className="mb-6">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Langkah-langkah</p>
                  <div className="space-y-2">
                    {exercise.instructions.map((step) => (
                      <div key={step.stepOrder} className="rounded-2xl bg-surface-container-low p-3">
                        <p className="mb-1 text-[11px] font-bold text-primary">Langkah {step.stepOrder}</p>
                        <p className="text-sm font-semibold text-on-surface">{step.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 pb-12">
                <div className="rounded-2xl bg-surface-container-low p-3">
                  <p className="text-[11px] text-on-surface-variant">Gerakan dari katalog</p>
                  <p className="text-sm font-semibold text-on-surface">Latihan terstruktur · instruksi langkah demi langkah</p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {!loading && !error && exercise ? (
        <footer className="fixed bottom-0 left-0 z-50 mx-auto w-full max-w-[375px] border-t border-zinc-100/10 bg-white/80 px-6 pb-8 pt-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/workout/exercises"
              className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-surface-container-low px-5 font-bold text-on-surface"
            >
              <span className="material-symbols-outlined">list</span>
              Daftar
            </Link>
            <Link
              to="/workout/insight"
              className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-bold text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)] duration-150 active:scale-95"
            >
              <span className="material-symbols-outlined">check_circle</span>
              Selesai
            </Link>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
