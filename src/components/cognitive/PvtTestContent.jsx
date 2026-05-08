import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionUser } from "../../auth/auth";
import { appendPvtResult, getCognitiveUserKey } from "../../lib/cognitiveTestStorage";
import { syncPvtResultToBackend } from "../../lib/cognitiveTestSync";

const TRIALS = 18;
const LAPSE_MS = 500;
const MAX_WAIT_MS = 12000;
/** Tes mandiri (/cognitive-tests/pvt): jeda lebih panjang seperti protokol lab. */
const ISI_MIN_STANDALONE = 2000;
const ISI_MAX_STANDALONE = 6500;
const FEEDBACK_MS_STANDALONE = 2000;
const FALSE_START_MS_STANDALONE = 1200;
/** Sesi lengkap: ISI + feedback dipersingkat agar total waktu masuk akal (~setengah menunggu). */
const ISI_MIN_SESSION = 900;
const ISI_MAX_SESSION = 3200;
const FEEDBACK_MS_SESSION = 650;
const FALSE_START_MS_SESSION = 700;

/** Kartu PVT — selaras mockup sesi (tunggu oranye → hijau → hasil gelap). */
function PvtTrialCard({ phase, badgeNum, totalTrials, feedbackRt, feedbackKind, falseStartFlash, fullScreen }) {
  const showBadge = phase !== "intro" && phase !== "done" && phase !== "countdown";
  const badge = `${Math.min(badgeNum, totalTrials)}/${totalTrials}`;

  let bg = "bg-[#2c3444]";
  let title = "";
  let subtitle = "";
  let titleClass = "text-white";
  let subtitleClass = "text-white/85";

  if (falseStartFlash) {
    bg = "bg-[#c94a38]";
    title = "Terlalu cepat!";
    subtitle = "Tunggu layar hijau dulu.";
    titleClass = "text-white";
    subtitleClass = "text-white/90";
  } else if (phase === "wait") {
    bg = "bg-[#E85D3D]";
    title = "Tunggu...";
    subtitle = "Jangan ketuk sebelum layar berubah hijau.";
    titleClass = "text-white";
    subtitleClass = "text-white/90";
  } else if (phase === "stimulus") {
    bg = "bg-[#82E05A]";
    title = "KETUK SEKARANG!";
    subtitle = "Ketuk layar secepat mungkin.";
    titleClass = "text-black font-extrabold";
    subtitleClass = "text-black/80";
  } else if (phase === "feedback") {
    bg = "bg-[#2c3444]";
    titleClass = "text-white font-extrabold";
    subtitleClass = "text-white/80";
    if (feedbackKind === "timeout") {
      title = "Waktu habis";
      subtitle = "Kelalaian tercatat.";
    } else if (feedbackRt != null) {
      title = `${feedbackRt} ms`;
      subtitle = feedbackRt >= LAPSE_MS ? "Lapse terdeteksi." : "Respons tercatat.";
    } else {
      title = "—";
      subtitle = "Kelalaian tercatat.";
    }
  }

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden ${bg} ${
        fullScreen
          ? "min-h-0 flex-1 basis-0 rounded-none px-6 py-10 shadow-none pt-[max(2.75rem,env(safe-area-inset-top)+2.25rem)] pb-[max(2rem,env(safe-area-inset-bottom)+1rem)]"
          : "min-h-[min(420px,72dvh)] max-w-lg rounded-[28px] shadow-xl px-6 py-10"
      }`}
    >
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-white/10" aria-hidden />
      {showBadge ? (
        <div
          className={`absolute z-10 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#1a1a1a] shadow-sm ${
            fullScreen
              ? "right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
              : "right-4 top-4"
          }`}
        >
          {badge}
        </div>
      ) : null}
      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center text-center">
        <h2 className={`max-w-[280px] font-headline text-2xl leading-tight tracking-tight sm:text-3xl ${titleClass}`}>
          {title}
        </h2>
        {subtitle ? (
          <p className={`mt-3 max-w-[300px] text-sm font-medium leading-relaxed sm:text-base ${subtitleClass}`}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function mean(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export default function PvtTestContent({
  chainMode = false,
  onChainComplete,
  skipIntro = false,
  fullScreenSession = false,
  sessionId = null,
  stepLabel,
} = {}) {
  const navigate = useNavigate();
  const userKey = getCognitiveUserKey(getSessionUser());
  const isiMin = fullScreenSession ? ISI_MIN_SESSION : ISI_MIN_STANDALONE;
  const isiMax = fullScreenSession ? ISI_MAX_SESSION : ISI_MAX_STANDALONE;
  const feedbackMs = fullScreenSession ? FEEDBACK_MS_SESSION : FEEDBACK_MS_STANDALONE;
  const falseStartMs = fullScreenSession ? FALSE_START_MS_SESSION : FALSE_START_MS_STANDALONE;
  const autoStartedRef = useRef(false);
  const feedbackTimeoutRef = useRef(null);
  const falseStartTimeoutRef = useRef(null);

  const [phase, setPhase] = useState("intro");
  const [trialBadge, setTrialBadge] = useState(1);
  const [countdownMsg, setCountdownMsg] = useState("");
  const [summary, setSummary] = useState(null);
  const [feedbackRt, setFeedbackRt] = useState(null);
  const [feedbackKind, setFeedbackKind] = useState(null);
  const [falseStartFlash, setFalseStartFlash] = useState(false);

  const trialIdxRef = useRef(0);
  const rtsRef = useRef([]);
  const lapsesRef = useRef(0);
  const falseStartsRef = useRef(0);
  const stimulusAtRef = useRef(0);
  const responseTimeoutRef = useRef(null);
  const isiTimeoutRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
    if (isiTimeoutRef.current) clearTimeout(isiTimeoutRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    if (falseStartTimeoutRef.current) clearTimeout(falseStartTimeoutRef.current);
    responseTimeoutRef.current = null;
    isiTimeoutRef.current = null;
    feedbackTimeoutRef.current = null;
    falseStartTimeoutRef.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const finishBlock = useCallback(() => {
    clearTimers();
    setFalseStartFlash(false);
    const rts = rtsRef.current;
    const valid = rts.filter((x) => x > 0 && x < MAX_WAIT_MS);
    const payload = {
      trials: TRIALS,
      validTrials: valid.length,
      meanRtMs: mean(valid),
      medianRtMs: median(valid),
      lapses: lapsesRef.current,
      falseStarts: falseStartsRef.current,
      ...(sessionId ? { sessionId } : {}),
    };
    if (chainMode && onChainComplete) {
      onChainComplete(payload);
      return;
    }
    const entry = appendPvtResult(userKey, payload);
    void syncPvtResultToBackend(entry);
    setSummary(payload);
    setPhase("done");
  }, [chainMode, clearTimers, onChainComplete, sessionId, userKey]);

  const scheduleNextTrial = useCallback(
    (beginAfterIsi) => {
      if (trialIdxRef.current >= TRIALS) {
        finishBlock();
        return;
      }
      setTrialBadge(trialIdxRef.current + 1);
      setPhase("wait");
      setFeedbackRt(null);
      setFeedbackKind(null);
      const isi = isiMin + Math.random() * (isiMax - isiMin);
      isiTimeoutRef.current = window.setTimeout(() => beginAfterIsi(), isi);
    },
    [finishBlock, isiMax, isiMin],
  );

  const beginStimulus = useCallback(() => {
    clearTimers();
    stimulusAtRef.current = performance.now();
    setTrialBadge(trialIdxRef.current + 1);
    setPhase("stimulus");
    responseTimeoutRef.current = window.setTimeout(() => {
      lapsesRef.current += 1;
      const next = trialIdxRef.current + 1;
      trialIdxRef.current = next;
      setTrialBadge(next);
      setPhase("feedback");
      setFeedbackRt(null);
      setFeedbackKind("timeout");
      feedbackTimeoutRef.current = window.setTimeout(() => {
        if (next >= TRIALS) {
          finishBlock();
          return;
        }
        scheduleNextTrial(beginStimulus);
      }, feedbackMs);
    }, MAX_WAIT_MS);
  }, [clearTimers, feedbackMs, finishBlock, scheduleNextTrial]);

  const scheduleAfterIsi = useCallback(() => {
    clearTimers();
    setTrialBadge(trialIdxRef.current + 1);
    setPhase("wait");
    setFeedbackRt(null);
    setFeedbackKind(null);
    const isi = isiMin + Math.random() * (isiMax - isiMin);
    isiTimeoutRef.current = window.setTimeout(() => beginStimulus(), isi);
  }, [beginStimulus, clearTimers, isiMax, isiMin]);

  const startTest = useCallback(() => {
    clearTimers();
    setFalseStartFlash(false);
    trialIdxRef.current = 0;
    rtsRef.current = [];
    lapsesRef.current = 0;
    falseStartsRef.current = 0;
    setSummary(null);
    setFeedbackRt(null);
    setFeedbackKind(null);
    setTrialBadge(1);

    if (chainMode && skipIntro) {
      scheduleAfterIsi();
      return;
    }

    setPhase("countdown");
    setCountdownMsg("Bersiap…");
    let c = 3;
    const tick = () => {
      if (c > 0) {
        setCountdownMsg(`Mulai dalam ${c}…`);
        c -= 1;
        window.setTimeout(tick, 700);
      } else {
        scheduleAfterIsi();
      }
    };
    window.setTimeout(tick, 300);
  }, [chainMode, clearTimers, scheduleAfterIsi, skipIntro]);

  useEffect(() => {
    if (!chainMode || !skipIntro || autoStartedRef.current) return;
    autoStartedRef.current = true;
    startTest();
  }, [chainMode, skipIntro, startTest]);

  const onTap = () => {
    if (phase === "intro" || phase === "done" || phase === "countdown" || phase === "feedback") return;

    if (falseStartFlash) return;

    if (phase === "wait") {
      falseStartsRef.current += 1;
      if (isiTimeoutRef.current) clearTimeout(isiTimeoutRef.current);
      isiTimeoutRef.current = null;
      setFalseStartFlash(true);
      falseStartTimeoutRef.current = window.setTimeout(() => {
        setFalseStartFlash(false);
        const isi = isiMin + Math.random() * (isiMax - isiMin);
        isiTimeoutRef.current = window.setTimeout(() => beginStimulus(), isi);
      }, falseStartMs);
      return;
    }

    if (phase === "stimulus") {
      clearTimers();
      const rt = Math.round(performance.now() - stimulusAtRef.current);
      rtsRef.current.push(rt);
      if (rt >= LAPSE_MS) lapsesRef.current += 1;
      const next = trialIdxRef.current + 1;
      trialIdxRef.current = next;
      setTrialBadge(next);
      setPhase("feedback");
      setFeedbackRt(rt);
      setFeedbackKind("response");
      feedbackTimeoutRef.current = window.setTimeout(() => {
        if (next >= TRIALS) {
          finishBlock();
          return;
        }
        scheduleNextTrial(beginStimulus);
      }, feedbackMs);
    }
  };

  const validCount = summary ? summary.validTrials : 0;
  const rtsForStats = summary ? rtsRef.current.filter((x) => x > 0 && x < MAX_WAIT_MS) : [];

  const shellBg = chainMode ? "bg-surface" : "bg-slate-900";
  const shellText = chainMode ? "text-on-surface" : "text-white";

  const trialCardPhase = falseStartFlash ? "wait" : phase === "stimulus" ? "stimulus" : phase === "feedback" ? "feedback" : "wait";

  return (
    <div
      className={
        fullScreenSession
          ? "fixed inset-0 z-[100] flex h-[100dvh] w-full max-w-none touch-manipulation flex-col overflow-hidden select-none"
          : `mx-auto min-h-screen max-w-md select-none ${shellBg} ${shellText}`
      }
      onPointerDown={onTap}
      role="presentation"
    >
      {fullScreenSession ? (
        <Link
          to="/cognitive-tests"
          className="pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] z-[110] flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md"
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Kembali ke menu tes"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </Link>
      ) : null}

      {!chainMode && (
        <header className="pointer-events-auto sticky top-0 z-20 flex items-center gap-2 border-b border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-md">
          <Link
            to="/cognitive-tests"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined">close</span>
          </Link>
          <span className="text-sm font-bold text-white">
            {stepLabel ? `${stepLabel} · ` : ""}PVT · {trialBadge}/{TRIALS}
          </span>
        </header>
      )}

      {chainMode && !fullScreenSession && (phase === "intro" || phase === "done") && stepLabel ? (
        <p className="pointer-events-none px-1 pb-2 text-center text-[11px] font-semibold text-on-surface-variant">{stepLabel}</p>
      ) : null}

      <div
        className={
          fullScreenSession
            ? "flex min-h-0 flex-1 flex-col"
            : `flex flex-col items-center justify-center px-4 pb-16 pt-2 ${chainMode ? "min-h-[calc(100dvh-140px)]" : "min-h-[calc(100dvh-52px)]"}`
        }
      >
        {phase === "intro" && !(chainMode && skipIntro) && (
          <div className="pointer-events-auto w-full max-w-lg text-center" onPointerDown={(e) => e.stopPropagation()}>
            <span className={`material-symbols-outlined mb-4 text-5xl ${chainMode ? "text-primary" : "text-emerald-400"}`}>
              touch_app
            </span>
            <h2 className="mb-3 font-headline text-xl font-bold">Tes Kewaspadaan Psikomotor</h2>
            <p className="mb-8 max-w-sm mx-auto text-sm leading-relaxed opacity-80">
              Layar akan berubah hijau setelah jeda acak. Ketuk segera saat hijau. Jangan ketuk saat masih merah/oranye. Ada {TRIALS}{" "}
              percobaan.
            </p>
            <button
              type="button"
              onClick={startTest}
              className={`rounded-full px-8 py-3.5 font-bold shadow-lg ${chainMode ? "bg-primary text-on-primary" : "bg-emerald-500 text-slate-900 shadow-emerald-500/30"}`}
            >
              Mulai tes
            </button>
          </div>
        )}

        {phase === "countdown" && (
          <div
            className={`w-full max-w-lg rounded-[28px] border px-6 py-16 text-center ${
              fullScreenSession
                ? "mx-4 max-w-none flex-1 border-white/15 bg-white/10"
                : chainMode
                  ? "border-outline-variant/20 bg-surface-container-low"
                  : "border-white/15 bg-white/10"
            }`}
          >
            <p
              className={`font-headline text-xl font-bold ${fullScreenSession || !chainMode ? "text-white" : "text-on-surface"}`}
            >
              {countdownMsg}
            </p>
            <p
              className={`mt-2 text-sm ${fullScreenSession || !chainMode ? "text-white/70" : "text-on-surface-variant"}`}
            >
              PVT · {TRIALS} percobaan
            </p>
          </div>
        )}

        {(phase === "wait" || phase === "stimulus" || phase === "feedback") && (
          <PvtTrialCard
            phase={trialCardPhase}
            badgeNum={trialBadge}
            totalTrials={TRIALS}
            feedbackRt={feedbackRt}
            feedbackKind={feedbackKind}
            falseStartFlash={falseStartFlash}
            fullScreen={fullScreenSession}
          />
        )}

        {phase === "done" && summary && !chainMode && (
          <div className="pointer-events-auto w-full max-w-lg" onPointerDown={(e) => e.stopPropagation()}>
            <h2 className="mb-4 font-headline text-xl font-bold text-emerald-400">Selesai</h2>
            <div className="mb-6 space-y-2 rounded-2xl bg-white/10 p-4 text-left text-sm">
              <p>
                <span className="text-white/60">Respons valid:</span>{" "}
                <span className="font-bold">{validCount}</span> / {TRIALS}
              </p>
              <p>
                <span className="text-white/60">RT rata-rata:</span>{" "}
                <span className="font-bold">{mean(rtsForStats)} ms</span>
              </p>
              <p>
                <span className="text-white/60">RT median:</span>{" "}
                <span className="font-bold">{median(rtsForStats)} ms</span>
              </p>
              <p>
                <span className="text-white/60">Kelalaian (≥{LAPSE_MS} ms / tanpa respons):</span>{" "}
                <span className="font-bold">{summary.lapses}</span>
              </p>
              <p>
                <span className="text-white/60">Ketukan terlalu cepat:</span>{" "}
                <span className="font-bold">{summary.falseStarts}</span>
              </p>
            </div>
            <p className="mb-6 text-xs text-white/50">Hasil tersimpan di riwayat tes.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate("/cognitive-tests/results")}
                className="rounded-full bg-white py-3 font-bold text-slate-900"
              >
                Lihat riwayat
              </button>
              <Link
                to="/cognitive-tests"
                className="rounded-full border border-white/30 py-3 text-center font-semibold text-white"
              >
                Kembali ke menu tes
              </Link>
            </div>
          </div>
        )}
      </div>

      {!chainMode && phase !== "intro" && phase !== "done" && (
        <p className="pointer-events-none fixed bottom-6 left-0 right-0 px-4 text-center text-xs text-white/40">
          Ketuk layar saat hijau
        </p>
      )}
    </div>
  );
}
