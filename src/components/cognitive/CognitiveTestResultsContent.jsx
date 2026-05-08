import { Link } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";
import { getCognitiveResultsForUser, getCognitiveUserKey } from "../../lib/cognitiveTestStorage";

function formatAt(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CognitiveTestResultsContent() {
  const user = getSessionUser();
  const userKey = getCognitiveUserKey(user);
  const { pvt, memory, sessions } = getCognitiveResultsForUser(userKey);
  const pvtList = [...pvt].reverse();
  const memList = [...memory].reverse();
  const sessionList = [...sessions].reverse();

  return (
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-24 text-on-surface">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-outline-variant/20 bg-surface/95 px-4 py-3 backdrop-blur-md">
        <Link to="/cognitive-tests" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-primary/10">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div>
          <h1 className="font-headline text-lg font-bold tracking-tight">Riwayat tes</h1>
          <p className="text-[11px] text-on-surface-variant">PVT &amp; memori kerja · perangkat ini</p>
        </div>
      </header>

      <main className="space-y-8 px-4 pt-6">
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">Sesi lengkap</h2>
          {sessionList.length === 0 ? (
            <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
              Belum ada sesi PVT + memori. Mulai dari menu → <strong className="text-on-surface">Sesi lengkap</strong>.
            </p>
          ) : (
            <ul className="space-y-3">
              {sessionList.map((row) => {
                const o = row.overall;
                const tone =
                  o?.color === "emerald"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : o?.color === "red"
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-amber-500/30 bg-amber-500/5";
                const pPass = row.pvt?.evaluation?.pass;
                const mPass = row.memory?.evaluation?.pass;
                return (
                  <li
                    key={row.id}
                    className={`rounded-2xl border p-4 text-sm shadow-sm ${tone}`}
                  >
                    <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">{formatAt(row.at)}</p>
                    <p className="mb-2 font-bold leading-snug text-on-surface">{o?.title || "Sesi kognitif"}</p>
                    <p className="mb-3 text-xs text-on-surface-variant">{o?.subtitle}</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${
                          pPass ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200" : "bg-red-500/20 text-red-800 dark:text-red-200"
                        }`}
                      >
                        PVT: {pPass ? "berhasil" : "gagal"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${
                          mPass ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200" : "bg-red-500/20 text-red-800 dark:text-red-200"
                        }`}
                      >
                        Memori: {mPass ? "berhasil" : "gagal"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">PVT (percobaan tunggal)</h2>
          {pvtList.length === 0 ? (
            <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Belum ada hasil PVT.</p>
          ) : (
            <ul className="space-y-2">
              {pvtList.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm shadow-sm"
                >
                  <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">{formatAt(row.at)}</p>
                  <p>
                    RT rata-rata <strong>{row.meanRtMs}</strong> ms · median <strong>{row.medianRtMs}</strong> ms
                  </p>
                  <p className="text-on-surface-variant">
                    Valid {row.validTrials}/{row.trials} · kelalaian {row.lapses} · terlalu cepat {row.falseStarts}
                    {typeof row.passed === "boolean" && (
                      <span className={`ml-2 font-bold ${row.passed ? "text-emerald-600" : "text-red-600"}`}>
                        · skrining: {row.passed ? "lulus" : "tidak lulus"}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">Memori kerja (percobaan tunggal)</h2>
          {memList.length === 0 ? (
            <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Belum ada hasil memori.</p>
          ) : (
            <ul className="space-y-2">
              {memList.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm shadow-sm"
                >
                  <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">{formatAt(row.at)}</p>
                  <p>
                    Skor <strong>{row.score}</strong> · benar <strong>{row.roundsCorrect}</strong>/{row.rounds} babak
                  </p>
                  <p className="text-on-surface-variant">
                    Rentang maks. {row.maxSpan} digit · total panjang benar {row.sumCorrectLengths}
                    {typeof row.passed === "boolean" && (
                      <span className={`ml-2 font-bold ${row.passed ? "text-emerald-600" : "text-red-600"}`}>
                        · skrining: {row.passed ? "lulus" : "tidak lulus"}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-[10px] text-on-surface-variant/70">
          Data disimpan lokal untuk akun: {String(user?.username || user?.email || userKey).slice(0, 24)}
          {(String(user?.username || user?.email || userKey).length > 24 ? "…" : "")}
        </p>
      </main>
    </div>
  );
}
