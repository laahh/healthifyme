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
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-28 font-['Public_Sans',sans-serif] text-on-surface">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/cognitive-tests"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Sesi tes lengkap</h1>
            <p className="text-[11px] text-slate-500">PVT lalu memori kerja · satu alur</p>
          </div>
        </div>
        {step === "landing" || step === "summary" || step === "bridge" ? (
          <div className="mt-3 flex items-center gap-2">
            <div
              className={`h-1.5 flex-1 rounded-full ${
                step === "landing" ? "bg-primary" : "bg-primary"
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full ${
                step === "bridge" || step === "summary" ? "bg-rose-500" : "bg-slate-200"
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full ${
                step === "summary" ? "bg-emerald-500" : "bg-slate-200"
              }`}
            />
          </div>
        ) : null}
      </header>

      <main className="px-4 pt-5">
        {step === "landing" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Identitas peserta
              </p>
              <dl className="grid grid-cols-1 gap-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] text-slate-500">Nama</dt>
                  <dd className="truncate font-bold text-slate-900">{participant.name}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] text-slate-500">SID</dt>
                  <dd className="font-mono text-[13px] font-bold tracking-wide text-slate-900">
                    {participant.sid}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] text-slate-500">Perusahaan</dt>
                  <dd className="truncate font-semibold text-slate-800">{participant.company}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-bold text-primary">Alur sesi</p>
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">
                    1
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">PVT</p>
                    <p className="text-[12px] leading-snug text-slate-500">
                      Reaksi terhadap sinyal setelah jeda acak (±18 percobaan)
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[12px] font-bold text-white">
                    2
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">Memori kerja</p>
                    <p className="text-[12px] leading-snug text-slate-500">
                      Ingat pola grid 4×4, lalu tentukan sama atau berbeda (6 babak)
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[12px] font-bold text-slate-700">
                    3
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">Ringkasan</p>
                    <p className="text-[12px] leading-snug text-slate-500">
                      Lulus/gagal skrining + saran layak bekerja (bukan diagnosis)
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900">
              <span className="font-bold">Penting: </span>
              Hasil hanya skrining kewaspadaan singkat. Keputusan medis atau K3 tetap di tangan dokter /
              perusahaan Anda.
            </div>

            <button
              type="button"
              onClick={() => setStep("pvt")}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25"
            >
              Mulai sesi (PVT dulu)
            </button>
            <Link
              to="/cognitive-tests/results"
              className="block w-full rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-700"
            >
              Lihat riwayat hasil
            </Link>
          </div>
        )}

        {step === "bridge" && pvtRaw && pvtEval && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Bagian 1 selesai
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">PVT</h2>
                <Badge ok={pvtEval.pass}>{pvtEval.pass ? "Berhasil skrining" : "Gagal skrining"}</Badge>
              </div>
              <p className="mb-3 text-sm text-slate-600">{pvtEval.label}</p>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-[10px] text-slate-400">Valid</p>
                  <p className="text-sm font-extrabold tabular-nums text-slate-900">
                    {pvtRaw.validTrials}/{pvtRaw.trials}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">RT mean</p>
                  <p className="text-sm font-extrabold tabular-nums text-slate-900">
                    {pvtRaw.meanRtMs}
                    <span className="text-[9px] font-medium text-slate-400"> ms</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Kelalaian</p>
                  <p className="text-sm font-extrabold tabular-nums text-slate-900">{pvtRaw.lapses}</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">{pvtEval.thresholdsHint}</p>
            </div>
            <button
              type="button"
              onClick={() => setStep("memory")}
              className="w-full rounded-2xl bg-rose-600 py-3.5 text-sm font-bold text-white shadow-md"
            >
              Lanjut ke tes memori kerja
            </button>
          </div>
        )}

        {step === "summary" && memRaw && memEval && overall && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">badge</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Identitas peserta
                </p>
              </div>
              <dl className="grid gap-2.5 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nama</dt>
                  <dd className="font-bold leading-snug text-slate-900">{participant.name}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SID</dt>
                  <dd className="font-mono text-sm font-bold tracking-wide text-slate-900">
                    {participant.sid}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Perusahaan
                  </dt>
                  <dd className="font-semibold leading-snug text-slate-800">{participant.company}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Waktu tes
                  </dt>
                  <dd className="text-xs text-slate-500">
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
              <div className="mb-3 flex items-start gap-3">
                <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                  <span className="material-symbols-outlined text-2xl text-slate-700">
                    {overall.color === "emerald"
                      ? "check_circle"
                      : overall.color === "red"
                        ? "warning"
                        : "info"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Kesimpulan skrining
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold leading-snug text-slate-900">
                    {overall.title}
                  </h2>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{overall.subtitle}</p>
              {Array.isArray(overall.recommendations) && overall.recommendations.length > 0 ? (
                <ul className="mt-4 list-disc space-y-1.5 pl-4 text-xs text-slate-600">
                  {overall.recommendations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">bolt</span>
                  <span className="text-[13px] font-bold text-slate-900">PVT</span>
                </div>
                <Badge ok={pvtEval?.pass}>{pvtEval?.pass ? "Berhasil" : "Gagal"}</Badge>
                <p className="mt-2 text-[11px] leading-snug text-slate-500">{pvtEval?.label}</p>
                {pvtRaw?.meanRtMs != null ? (
                  <p className="mt-2 text-[12px] font-bold tabular-nums text-slate-800">
                    {pvtRaw.meanRtMs} ms mean
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">psychology</span>
                  <span className="text-[13px] font-bold text-slate-900">Memori</span>
                </div>
                <Badge ok={memEval.pass}>{memEval.pass ? "Berhasil" : "Gagal"}</Badge>
                <p className="mt-2 text-[11px] leading-snug text-slate-500">{memEval.label}</p>
                {memRaw?.score != null ? (
                  <p className="mt-2 text-[12px] font-bold tabular-nums text-slate-800">
                    Skor {memRaw.score}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[10px] leading-relaxed text-slate-500">
              Parameter &quot;layak bekerja&quot; menggabungkan kewaspadaan + memori. Dua tes lulus → mendukung
              tugas biasa; satu gagal → waspada; dua gagal → hindari tugas berisiko tinggi sampai dievaluasi
              profesional.
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={resetFlow}
                className="rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-md shadow-primary/25"
              >
                Ulangi sesi lengkap
              </button>
              <Link
                to="/cognitive-tests/results"
                className="rounded-2xl border border-slate-200 bg-white py-3.5 text-center text-sm font-semibold text-primary"
              >
                Riwayat hasil
              </Link>
              <Link
                to="/cognitive-tests"
                className="rounded-2xl py-3 text-center text-sm font-medium text-slate-500"
              >
                Kembali ke menu
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
