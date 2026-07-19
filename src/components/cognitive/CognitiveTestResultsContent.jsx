import { Link } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";
import { getCognitiveResultsForUser, getCognitiveUserKey } from "../../lib/cognitiveTestStorage";

function formatAt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function sessionTone(color) {
  if (color === "emerald") {
    return {
      wrap: "border-emerald-200 bg-emerald-50/80",
      chip: "bg-emerald-100 text-emerald-800",
      label: "Lulus",
    };
  }
  if (color === "red") {
    return {
      wrap: "border-red-200 bg-red-50/80",
      chip: "bg-red-100 text-red-800",
      label: "Perhatian",
    };
  }
  return {
    wrap: "border-amber-200 bg-amber-50/80",
    chip: "bg-amber-100 text-amber-900",
    label: "Waspada",
  };
}

function PassChip({ ok, label }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
      }`}
    >
      {label}: {ok ? "berhasil" : "gagal"}
    </span>
  );
}

export default function CognitiveTestResultsContent() {
  const user = getSessionUser();
  const userKey = getCognitiveUserKey(user);
  const { pvt, memory, sessions } = getCognitiveResultsForUser(userKey);
  const pvtList = [...pvt].reverse();
  const memList = [...memory].reverse();
  const sessionList = [...sessions].reverse();
  const accountLabel = String(user?.username || user?.email || userKey);
  const emptyAll = sessionList.length === 0 && pvtList.length === 0 && memList.length === 0;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-24 font-['Public_Sans',sans-serif] text-on-surface">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <Link
          to="/cognitive-tests"
          className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary/10"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Riwayat tes</h1>
          <p className="text-[11px] text-slate-500">PVT &amp; memori · perangkat ini</p>
        </div>
      </header>

      <main className="space-y-6 px-4 pt-5">
        {emptyAll ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl">psychology</span>
            </div>
            <p className="text-sm font-bold text-slate-800">Belum ada hasil</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Mulai sesi lengkap untuk menyimpan riwayat PVT dan memori kerja.
            </p>
            <Link
              to="/cognitive-tests/session"
              className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-[12px] font-bold text-white"
            >
              Mulai sesi
            </Link>
          </div>
        ) : null}

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Sesi lengkap
            </h2>
            <span className="text-[11px] tabular-nums text-slate-400">{sessionList.length}</span>
          </div>
          {sessionList.length === 0 ? (
            !emptyAll ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-[13px] text-slate-500">
                Belum ada sesi gabungan. Mulai dari{" "}
                <Link to="/cognitive-tests/session" className="font-bold text-primary">
                  sesi lengkap
                </Link>
                .
              </p>
            ) : null
          ) : (
            <ul className="space-y-3">
              {sessionList.map((row) => {
                const o = row.overall;
                const tone = sessionTone(o?.color);
                const pPass = row.pvt?.evaluation?.pass;
                const mPass = row.memory?.evaluation?.pass;
                const meanRt = row.pvt?.raw?.meanRtMs;
                const memScore = row.memory?.raw?.score;
                return (
                  <li key={row.id} className={`rounded-2xl border p-4 shadow-sm ${tone.wrap}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-500">{formatAt(row.at)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.chip}`}>
                        {tone.label}
                      </span>
                    </div>
                    <p className="font-bold leading-snug text-slate-900">{o?.title || "Sesi kognitif"}</p>
                    {o?.subtitle ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{o.subtitle}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <PassChip ok={Boolean(pPass)} label="PVT" />
                      <PassChip ok={Boolean(mPass)} label="Memori" />
                    </div>
                    {(meanRt != null || memScore != null) && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {meanRt != null ? (
                          <div className="rounded-xl bg-white/70 px-2.5 py-2 text-center">
                            <p className="text-[10px] font-semibold uppercase text-slate-400">RT mean</p>
                            <p className="text-sm font-extrabold tabular-nums text-slate-900">
                              {meanRt}
                              <span className="text-[10px] font-semibold text-slate-400"> ms</span>
                            </p>
                          </div>
                        ) : null}
                        {memScore != null ? (
                          <div className="rounded-xl bg-white/70 px-2.5 py-2 text-center">
                            <p className="text-[10px] font-semibold uppercase text-slate-400">Skor memori</p>
                            <p className="text-sm font-extrabold tabular-nums text-slate-900">{memScore}</p>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              PVT (tunggal)
            </h2>
            <span className="text-[11px] tabular-nums text-slate-400">{pvtList.length}</span>
          </div>
          {pvtList.length === 0 ? (
            !emptyAll ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-4 text-[13px] text-slate-500">
                Belum ada hasil PVT tunggal.
              </p>
            ) : null
          ) : (
            <ul className="space-y-2">
              {pvtList.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-slate-400">{formatAt(row.at)}</p>
                    {typeof row.passed === "boolean" ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          row.passed
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {row.passed ? "Lulus" : "Tidak lulus"}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400">Mean</p>
                      <p className="text-[13px] font-bold tabular-nums text-slate-900">
                        {row.meanRtMs}
                        <span className="text-[9px] font-medium text-slate-400"> ms</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Median</p>
                      <p className="text-[13px] font-bold tabular-nums text-slate-900">
                        {row.medianRtMs}
                        <span className="text-[9px] font-medium text-slate-400"> ms</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Valid</p>
                      <p className="text-[13px] font-bold tabular-nums text-slate-900">
                        {row.validTrials}/{row.trials}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Kelalaian {row.lapses} · terlalu cepat {row.falseStarts}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Memori (tunggal)
            </h2>
            <span className="text-[11px] tabular-nums text-slate-400">{memList.length}</span>
          </div>
          {memList.length === 0 ? (
            !emptyAll ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-4 text-[13px] text-slate-500">
                Belum ada hasil memori tunggal.
              </p>
            ) : null
          ) : (
            <ul className="space-y-2">
              {memList.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-slate-400">{formatAt(row.at)}</p>
                    {typeof row.passed === "boolean" ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          row.passed
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {row.passed ? "Lulus" : "Tidak lulus"}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400">Skor</p>
                      <p className="text-[13px] font-bold tabular-nums text-slate-900">{row.score}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Benar</p>
                      <p className="text-[13px] font-bold tabular-nums text-slate-900">
                        {row.roundsCorrect}/{row.rounds}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Span</p>
                      <p className="text-[13px] font-bold tabular-nums text-slate-900">{row.maxSpan}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="pb-2 text-center text-[10px] text-slate-400">
          Data lokal · {accountLabel.length > 28 ? `${accountLabel.slice(0, 28)}…` : accountLabel}
        </p>
      </main>
    </div>
  );
}
