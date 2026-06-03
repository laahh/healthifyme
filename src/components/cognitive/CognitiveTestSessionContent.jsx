import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";
import {
  appendCognitiveSession,
  appendMemoryResult,
  appendPvtResult,
  getCognitiveUserKey,
} from "../../lib/cognitiveTestStorage";
import { evaluateFitnessForDuty, evaluateMemory, evaluatePvt } from "../../lib/cognitiveFitnessAssessment";
import {
  syncMemoryResultToBackend,
  syncPvtResultToBackend,
  syncSessionSummaryToBackend,
} from "../../lib/cognitiveTestSync";
import PvtTestContent from "./PvtTestContent";
import WorkingMemoryTestContent from "./WorkingMemoryTestContent";

function newSessionId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ses_${Date.now()}`;
}

function Badge({ ok, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
        ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-500/15 text-red-700 dark:text-red-300"
      }`}
    >
      {children}
    </span>
  );
}

function participantIdentityFromSession(sessionUser) {
  const sid = String(sessionUser?.sid || sessionUser?.username || "").trim();
  const rawName = String(sessionUser?.nama || sessionUser?.name || "").trim();
  const sidLower = sid.toLowerCase();
  const name = rawName && rawName.toLowerCase() !== sidLower ? rawName : sid || "—";
  const company = String(sessionUser?.company || "").trim() || "—";
  return { sid: sid || "—", name, company };
}

export default function CognitiveTestSessionContent() {
  const sessionUser = getSessionUser();
  const participant = participantIdentityFromSession(sessionUser);
  const userKey = getCognitiveUserKey(sessionUser);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [step, setStep] = useState("landing");

  const [pvtRaw, setPvtRaw] = useState(null);
  const [pvtEval, setPvtEval] = useState(null);
  const [memRaw, setMemRaw] = useState(null);
  const [memEval, setMemEval] = useState(null);
  const [overall, setOverall] = useState(null);
  const [summaryCompletedAt, setSummaryCompletedAt] = useState(null);

  const pvtEvalRef = useRef(null);
  const pvtRawRef = useRef(null);

  /** Samakan ref dengan state agar handler memori selalu punya snapshot PVT (ref saja kadang kosong di edge case). */
  useEffect(() => {
    if (pvtEval) pvtEvalRef.current = pvtEval;
  }, [pvtEval]);
  useEffect(() => {
    if (pvtRaw) pvtRawRef.current = pvtRaw;
  }, [pvtRaw]);

  useEffect(() => {
    if (step === "summary") {
      setSummaryCompletedAt((prev) => prev ?? new Date());
    } else {
      setSummaryCompletedAt(null);
    }
  }, [step]);

  const resetFlow = useCallback(() => {
    setSessionId(newSessionId());
    setStep("landing");
    setPvtRaw(null);
    setPvtEval(null);
    setMemRaw(null);
    setMemEval(null);
    setOverall(null);
    pvtEvalRef.current = null;
    pvtRawRef.current = null;
  }, []);

  const onPvtChainDone = useCallback(
    (payload) => {
      const ev = evaluatePvt(payload);
      const pvtEntry = appendPvtResult(userKey, {
        ...payload,
        passed: ev.pass,
        evaluationLabel: ev.label,
        sessionId,
      });
      void syncPvtResultToBackend(pvtEntry);
      pvtRawRef.current = payload;
      pvtEvalRef.current = ev;
      setPvtRaw(payload);
      setPvtEval(ev);
      setStep("bridge");
    },
    [sessionId, userKey],
  );

  const onMemChainDone = useCallback(
    (payload) => {
      const ev = evaluateMemory(payload);
      const pvtE = pvtEvalRef.current ?? pvtEval;
      const pvtPayload = pvtRawRef.current ?? pvtRaw;

      const memEntry = appendMemoryResult(userKey, {
        ...payload,
        passed: ev.pass,
        evaluationLabel: ev.label,
        sessionId,
      });
      void syncMemoryResultToBackend(memEntry);

      if (!pvtE || !pvtPayload) {
        console.warn("[cognitive-session] Snapshot PVT hilang saat memori selesai; lompat ke ringkasan terbatas.");
        setMemRaw(payload);
        setMemEval(ev);
        setOverall({
          level: "waspada",
          title: "Memori kerja tersimpan",
          subtitle:
            "Data PVT untuk sesi ini tidak terbaca di memori aplikasi. Hasil memori tetap ada di riwayat; ulangi sesi jika perlu ringkasan gabungan.",
          recommendations: [
            "Ulangi sesi lengkap dari menu tes kognitif jika Anda memerlukan skor gabungan.",
            "Periksa riwayat hasil untuk detail tes memori.",
          ],
          color: "amber",
        });
        setStep("summary");
        return;
      }

      try {
        const fitness = evaluateFitnessForDuty(pvtE, ev);
        const sessionEntry = appendCognitiveSession(userKey, {
          sessionId,
          pvt: { raw: pvtPayload, evaluation: pvtE },
          memory: { raw: payload, evaluation: ev },
          overall: fitness,
        });
        void syncSessionSummaryToBackend({
          sessionId,
          at: sessionEntry.at,
          overall: fitness,
          pvt: { raw: pvtPayload, evaluation: pvtE },
          memory: { raw: payload, evaluation: ev },
        });
        setMemRaw(payload);
        setMemEval(ev);
        setOverall(fitness);
        setStep("summary");
      } catch (err) {
        console.error("[cognitive-session] Gagal menyimpan ringkasan sesi:", err);
        setMemRaw(payload);
        setMemEval(ev);
        setOverall({
          level: "waspada",
          title: "Ringkasan sebagian",
          subtitle: err?.message ? String(err.message) : "Terjadi kesalahan saat menyimpan sesi gabungan.",
          recommendations: ["Coba ulangi sesi.", "Hasil memori kerja biasanya sudah tersimpan di riwayat."],
          color: "amber",
        });
        setStep("summary");
      }
    },
    [sessionId, userKey, pvtEval, pvtRaw],
  );

  const overallCardClass =
    overall?.color === "emerald"
      ? "border-emerald-500/35 bg-emerald-500/[0.08]"
      : overall?.color === "red"
        ? "border-red-500/35 bg-red-500/[0.08]"
        : "border-amber-500/35 bg-amber-500/[0.08]";

  return (
    <>
    {step !== "pvt" && step !== "memory" && (
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-10 border-b border-outline-variant/20 bg-surface/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/cognitive-tests"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline text-lg font-bold tracking-tight">Sesi tes lengkap</h1>
            <p className="text-[11px] text-on-surface-variant">PVT lalu memori kerja · satu alur</p>
          </div>
        </div>
        {step !== "landing" && step !== "summary" && (
          <div className="mt-3 flex gap-1.5">
            <div
              className={`h-1 flex-1 rounded-full ${step === "pvt" || step === "bridge" ? "bg-primary" : "bg-outline-variant/25"}`}
            />
            <div className={`h-1 flex-1 rounded-full ${step === "memory" ? "bg-tertiary" : "bg-outline-variant/25"}`} />
          </div>
        )}
      </header>

      <main className="px-4 pt-5">
        {step === "landing" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
              <p className="mb-3 text-sm font-bold text-primary">Alur skrining</p>
              <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-on-surface-variant">
                <li>
                  <strong className="text-on-surface">PVT</strong> — reaksi terhadap sinyal setelah jeda acak (±18 percobaan).
                </li>
                <li>
                  <strong className="text-on-surface">Memori kerja</strong> — ingat pola grid 4×4, lalu tentukan sama atau berbeda dengan pola berikutnya (6 babak).
                </li>
                <li>Ringkasan <strong className="text-on-surface">lulus/gagal skrining</strong> per tes dan saran &quot;layak bekerja&quot; berbasis ambang konservatif (bukan diagnosis dokter).</li>
              </ol>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-on-surface-variant">
              <span className="font-bold text-amber-800 dark:text-amber-200">Penting: </span>
              Hasil hanya skrining kewaspadaan singkat. Keputusan medis atau K3 tetap di tangan dokter / perusahaan Anda.
            </div>
            <button
              type="button"
              onClick={() => setStep("pvt")}
              className="w-full rounded-2xl bg-primary py-3.5 font-bold text-on-primary shadow-md"
            >
              Mulai sesi (PVT dulu)
            </button>
            <Link
              to="/cognitive-tests/results"
              className="block w-full rounded-2xl border border-outline-variant/25 py-3 text-center text-sm font-semibold text-primary"
            >
              Lihat riwayat hasil
            </Link>
          </div>
        )}

        {step === "bridge" && pvtRaw && pvtEval && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Bagian 1 selesai</p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-headline text-lg font-bold">PVT</h2>
                <Badge ok={pvtEval.pass}>{pvtEval.pass ? "Berhasil skrining" : "Gagal skrining"}</Badge>
              </div>
              <p className="mb-3 text-sm text-on-surface-variant">{pvtEval.label}</p>
              <div className="space-y-1.5 rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
                <p>
                  Respons valid <strong className="text-on-surface">{pvtRaw.validTrials}</strong> / {pvtRaw.trials} · RT mean{" "}
                  <strong className="text-on-surface">{pvtRaw.meanRtMs}</strong> ms · kelalaian{" "}
                  <strong className="text-on-surface">{pvtRaw.lapses}</strong>
                </p>
                <p className="text-[10px] opacity-90">{pvtEval.thresholdsHint}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep("memory")}
              className="w-full rounded-2xl bg-tertiary py-3.5 font-bold text-white shadow-md"
            >
              Lanjut ke tes memori kerja
            </button>
          </div>
        )}

        {step === "summary" && memRaw && memEval && overall && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-primary/25 bg-surface-container-lowest p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-2">
                <span className="material-symbols-outlined shrink-0 text-primary text-xl">badge</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Identitas peserta</p>
                  {/* <p className="mt-0.5 text-[10px] leading-relaxed text-on-surface-variant/80">
                    Hasil terikat akun login ini. Tangkapan layar tanpa blok ini tidak dapat diverifikasi.
                  </p> */}
                </div>
              </div>
              <dl className="grid gap-2.5 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Nama</dt>
                  <dd className="font-bold leading-snug text-on-surface">{participant.name}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">SID</dt>
                  <dd className="font-mono text-sm font-bold tracking-wide text-on-surface">{participant.sid}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Perusahaan</dt>
                  <dd className="font-semibold leading-snug text-on-surface">{participant.company}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Waktu tes</dt>
                  <dd className="text-xs text-on-surface-variant">
                    {(summaryCompletedAt ?? new Date()).toLocaleString("id-ID", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </dd>
                </div>
              </dl>
            </div>

            <div className={`rounded-2xl border-2 p-5 ${overallCardClass}`}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Kesimpulan skrining</p>
              <h2 className="mb-2 font-headline text-lg font-bold leading-snug">{overall.title}</h2>
              <p className="text-sm leading-relaxed text-on-surface-variant">{overall.subtitle}</p>
              <ul className="mt-4 list-disc space-y-1.5 pl-4 text-xs text-on-surface-variant">
                {overall.recommendations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                  <span className="font-bold">PVT</span>
                  <Badge ok={pvtEval?.pass}>{pvtEval?.pass ? "Berhasil" : "Gagal"}</Badge>
                </div>
                <p className="text-xs text-on-surface-variant">{pvtEval?.label}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-xl">psychology</span>
                  <span className="font-bold">Memori kerja</span>
                  <Badge ok={memEval.pass}>{memEval.pass ? "Berhasil" : "Gagal"}</Badge>
                </div>
                <p className="text-xs text-on-surface-variant">{memEval.label}</p>
                <p className="mt-2 text-[10px] text-on-surface-variant/80">{memEval.thresholdsHint}</p>
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 text-[10px] leading-relaxed text-on-surface-variant">
              Parameter &quot;layak bekerja&quot; menggabungkan dua domain (kewaspadaan + memori). Dua tes lulus → skrining mendukung tugas
              biasa; satu gagal → waspada; dua gagal → hindari tugas berisiko tinggi sampai kondisi membaik atau dievaluasi profesional.
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button type="button" onClick={resetFlow} className="rounded-2xl bg-primary py-3.5 font-bold text-on-primary">
                Ulangi sesi lengkap
              </button>
              <Link
                to="/cognitive-tests/results"
                className="rounded-2xl border border-outline-variant/30 py-3.5 text-center font-semibold text-primary"
              >
                Riwayat hasil
              </Link>
              <Link to="/cognitive-tests" className="rounded-2xl py-3 text-center text-sm text-on-surface-variant">
                Menu tes
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
    )}

    {step === "pvt" && (
      <PvtTestContent
        chainMode
        skipIntro
        fullScreenSession
        sessionId={sessionId}
        stepLabel="Langkah 1/2"
        onChainComplete={onPvtChainDone}
      />
    )}

    {step === "memory" && (
      <WorkingMemoryTestContent
        key={`${sessionId}-memory`}
        chainMode
        skipIntro
        fullScreenSession
        sessionId={sessionId}
        stepLabel="Langkah 2/2"
        onChainComplete={onMemChainDone}
      />
    )}
    </>
  );
}
