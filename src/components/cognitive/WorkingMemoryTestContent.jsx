import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getSessionUser } from "../../auth/auth";
import { appendMemoryResult, getCognitiveUserKey } from "../../lib/cognitiveTestStorage";
import { syncMemoryResultToBackend } from "../../lib/cognitiveTestSync";

const ROUNDS = 6;
const GRID = 16;
const MEMORIZE_MS_STANDALONE = 2800;
const FEEDBACK_MS_STANDALONE = 900;
/** Sesi lengkap: fase ingat pola + jeda antar babak lebih singkat. */
const MEMORIZE_MS_SESSION = 1500;
const FEEDBACK_MS_SESSION = 550;

/** Jumlah sel aktif naik tiap babak (miri kompleksitas span digit). */
function filledCellsForRound(roundIndex) {
  return Math.min(10, 4 + roundIndex);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomPattern(numFilled) {
  const n = Math.min(Math.max(2, numFilled), GRID);
  const idx = Array.from({ length: GRID }, (_, i) => i);
  shuffleInPlace(idx);
  const cells = new Array(GRID).fill(false);
  for (let i = 0; i < n; i += 1) cells[idx[i]] = true;
  return cells;
}

function copyPattern(p) {
  return [...p];
}

function differentFrom(p) {
  const q = copyPattern(p);
  const k = Math.floor(Math.random() * GRID);
  q[k] = !q[k];
  return q;
}

function countFilled(p) {
  return p.reduce((s, v) => s + (v ? 1 : 0), 0);
}

/**
 * @param {{ gradient?: "vertical" | "horizontal", fullScreen?: boolean }} props
 * Gradien 2 henti (tidak “smooth” panjang): biru → biru langit.
 */
function MemoryTaskPanel({ children, className = "", gradient = "vertical", fullScreen = false }) {
  const bgStyle =
    gradient === "vertical"
      ? "linear-gradient(180deg, #2563eb 0%, #60a5fa 100%)"
      : "linear-gradient(90deg, #2563eb 0%, #93c5fd 100%)";

  const shell = fullScreen
    ? "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none shadow-none"
    : "relative w-full max-w-[20.5rem] overflow-hidden rounded-[28px] shadow-[0_12px_28px_-12px_rgba(37,99,235,0.25)] sm:max-w-[21rem]";

  return (
    <div className={`${shell} ${className}`} style={{ background: bgStyle }}>
      {/* Aksen mockup: setengah lingkaran kanan-bawah, tanpa blur */}
      <div
        className="pointer-events-none absolute -bottom-8 -right-10 h-44 w-44 rounded-full bg-sky-200/35"
        aria-hidden
      />
      {children}
    </div>
  );
}

function RoundBadge({ text, fullScreen = false }) {
  return (
    <div
      className={`z-10 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold tracking-tight text-slate-900 shadow-sm sm:px-3 sm:py-1.5 sm:text-xs ${
        fullScreen
          ? "absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))]"
          : "absolute right-5 top-5"
      }`}
    >
      {text}
    </div>
  );
}

/** Fase ingat pola: grid lingkaran — outline tipis vs putih solid (mockup iPhone). */
function PatternGridCircles({ cells }) {
  return (
    <div className="grid w-full max-w-[15.5rem] grid-cols-4 gap-3 sm:max-w-[16.25rem] sm:gap-3.5">
      {cells.map((on, i) => (
        <div key={i} className="flex aspect-square items-center justify-center">
          <div
            className={`rounded-full ${
              on
                ? "h-9 w-9 bg-white sm:h-10 sm:w-10"
                : "h-9 w-9 border-2 border-white/60 bg-transparent sm:h-10 sm:w-10"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

/** Fase bandingkan: kotak rounded besar; aktif putih + border biru + lingkaran berongga di tengah. */
function PatternGridSquares({ cells }) {
  return (
    <div className="grid w-full max-w-[16.25rem] grid-cols-4 gap-2.5 sm:max-w-[17.25rem] sm:gap-3">
      {cells.map((on, i) => (
        <div
          key={i}
          className={`flex aspect-square items-center justify-center rounded-xl border transition-[background-color,border-color] duration-200 ${
            on
              ? "border-[#3b82f6] bg-white"
              : "border-sky-200/70 bg-white/20"
          }`}
        >
          {on ? (
            <div className="h-[28%] min-h-[12px] w-[28%] min-w-[12px] rounded-full border-2 border-[#3b82f6] bg-transparent" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function WorkingMemoryTestContent({
  chainMode = false,
  onChainComplete,
  skipIntro = false,
  fullScreenSession = false,
  sessionId = null,
  stepLabel,
} = {}) {
  const navigate = useNavigate();
  const userKey = getCognitiveUserKey(getSessionUser());
  const memorizeDurationMs = fullScreenSession ? MEMORIZE_MS_SESSION : MEMORIZE_MS_STANDALONE;
  const memFeedbackMs = fullScreenSession ? FEEDBACK_MS_SESSION : FEEDBACK_MS_STANDALONE;
  const progressRafRef = useRef(null);
  /** Diisi setelah startTest didefinisikan; dipakai layout effect tanpa deps pada startTest. */
  const startTestRef = useRef(() => {});

  const [phase, setPhase] = useState("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [referencePattern, setReferencePattern] = useState(() => new Array(GRID).fill(false));
  const [comparePattern, setComparePattern] = useState(() => new Array(GRID).fill(false));
  const [truthSame, setTruthSame] = useState(false);
  const [roundFilledCount, setRoundFilledCount] = useState(4);
  const [feedbackText, setFeedbackText] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [maxSpan, setMaxSpan] = useState(0);
  const [sumLengths, setSumLengths] = useState(0);
  const [finalStats, setFinalStats] = useState(null);
  const [memorizeProgress, setMemorizeProgress] = useState(100);

  const clearMemorizeTimer = useCallback(() => {
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }, []);

  useEffect(() => () => clearMemorizeTimer(), [clearMemorizeTimer]);

  const startRound = useCallback(
    (rIdx) => {
      clearMemorizeTimer();
      const k = filledCellsForRound(rIdx);
      const ref = randomPattern(k);
      const same = Math.random() < 0.5;
      const cmp = same ? copyPattern(ref) : differentFrom(ref);
      setReferencePattern(ref);
      setComparePattern(cmp);
      setTruthSame(same);
      setRoundFilledCount(countFilled(ref));
      setFeedbackText("");
      setMemorizeProgress(100);
      setPhase("memorize");
      const startAt = performance.now();
      const ms = Math.max(400, Number(memorizeDurationMs) || MEMORIZE_MS_STANDALONE);
      const tick = (now) => {
        const elapsed = now - startAt;
        const p = Math.max(0, 100 - (elapsed / ms) * 100);
        setMemorizeProgress(p);
        if (elapsed >= ms) {
          progressRafRef.current = null;
          setPhase("compare");
          setMemorizeProgress(0);
          return;
        }
        progressRafRef.current = requestAnimationFrame(tick);
      };
      progressRafRef.current = requestAnimationFrame(tick);
    },
    [clearMemorizeTimer, memorizeDurationMs],
  );

  const startTest = useCallback(() => {
    clearMemorizeTimer();
    setRoundIndex(0);
    setCorrectCount(0);
    setMaxSpan(0);
    setSumLengths(0);
    setFinalStats(null);
    startRound(0);
  }, [clearMemorizeTimer, startRound]);

  startTestRef.current = startTest;

  /** Satu kali per mount saat sesi berantai — jangan depend on startTest agar tidak “skip” start setelah RAF dibersihkan. */
  useLayoutEffect(() => {
    if (!chainMode || !skipIntro) return;
    startTestRef.current();
  }, [chainMode, skipIntro]);

  const advanceOrFinish = useCallback(
    (nextCorrect, nextMax, nextSum, nextRound) => {
      window.setTimeout(() => {
        if (nextRound >= ROUNDS) {
          const score = nextCorrect * 20 + nextSum;
          const payload = {
            rounds: ROUNDS,
            roundsCorrect: nextCorrect,
            maxSpan: nextMax,
            sumCorrectLengths: nextSum,
            score,
            task: "grid_same_different",
            ...(sessionId ? { sessionId } : {}),
          };
          if (chainMode && onChainComplete) {
            onChainComplete(payload);
            return;
          }
          const memEntry = appendMemoryResult(userKey, payload);
          void syncMemoryResultToBackend(memEntry);
          setFinalStats({ roundsCorrect: nextCorrect, maxSpan: nextMax, sumCorrectLengths: nextSum, score });
          setPhase("done");
          return;
        }
        setRoundIndex(nextRound);
        startRound(nextRound);
      }, memFeedbackMs);
    },
    [chainMode, memFeedbackMs, onChainComplete, sessionId, startRound, userKey],
  );

  const answer = (userSaysSame) => {
    if (phase !== "compare") return;
    const ok = userSaysSame === truthSame;
    const nextCorrect = correctCount + (ok ? 1 : 0);
    const nextMax = ok ? Math.max(maxSpan, roundFilledCount) : maxSpan;
    const nextSum = sumLengths + (ok ? roundFilledCount : 0);
    setCorrectCount(nextCorrect);
    setMaxSpan(nextMax);
    setSumLengths(nextSum);
    setFeedbackText(ok ? "Benar ✓" : "Kurang tepat");
    setPhase("feedback");
    advanceOrFinish(nextCorrect, nextMax, nextSum, roundIndex + 1);
  };

  const roundLabel = roundIndex + 1;
  const badgeText = `${Math.min(roundLabel, ROUNDS)}/${ROUNDS}`;
  const overlayZ = fullScreenSession ? "z-[100]" : "z-[40]";
  const fs = fullScreenSession;

  const panelPad = fs
    ? "px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top)+2.5rem)] sm:px-6"
    : "px-5 pb-6 pt-8 text-center sm:px-7 sm:pb-7 sm:pt-9";

  const mainInner = (
    <div className={`flex min-h-0 flex-1 flex-col ${fs ? "" : "items-center justify-center"}`}>
      {phase === "intro" && !(chainMode && skipIntro) && (
        <MemoryTaskPanel gradient="vertical" fullScreen={fs}>
          <div className={`relative z-[1] flex flex-col items-center ${panelPad} ${fs ? "justify-center text-center" : "text-center"}`}>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/40">
              <span className="material-symbols-outlined text-3xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                grid_view
              </span>
            </div>
            <h2 className="font-headline text-xl font-bold tracking-tight text-white sm:text-2xl">
              Memori pola
            </h2>
            <p className="mt-3 max-w-[17rem] text-sm font-normal leading-relaxed text-white/90">
              Ingat pola pertama, lalu pilih apakah pola berikutnya <span className="font-medium text-white/[0.95]">sama</span> atau{" "}
              <span className="font-medium text-white/[0.95]">berbeda</span>. {ROUNDS} babak.
            </p>
            <button
              type="button"
              onClick={startTest}
              className="mt-8 w-full max-w-sm rounded-2xl bg-white py-3.5 font-headline text-sm font-bold text-slate-900 shadow-sm transition-transform duration-200 active:scale-[0.98]"
            >
              Mulai tes
            </button>
          </div>
        </MemoryTaskPanel>
      )}

      {phase === "memorize" && (
        <MemoryTaskPanel className="relative" gradient="vertical" fullScreen={fs}>
          <RoundBadge text={badgeText} fullScreen={fs} />
          <div
            className={`relative z-[1] flex flex-col items-center ${fs ? `${panelPad} flex-1 justify-center text-center` : "px-5 pb-7 pt-10 text-center sm:px-7 sm:pt-11"}`}
          >
            <h2 className="font-headline text-lg font-bold tracking-tight text-white sm:text-xl">Ingat pola ini</h2>
            <p className="mt-2 text-[15px] font-normal text-white/90">Ini adalah pola pertama.</p>
            <div className="mt-10 flex justify-center sm:mt-11">
              <PatternGridCircles cells={referencePattern} />
            </div>
            <div className="mt-10 w-full max-w-[15.5rem] sm:mt-11">
              <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
                Lanjut otomatis{" "}
                <span className="text-white/85">{Math.max(0, Math.ceil((memorizeProgress / 100) * (memorizeDurationMs / 1000)))} dtk</span>
              </p>
              <div className="h-0.5 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
                  style={{ width: `${memorizeProgress}%` }}
                />
              </div>
            </div>
          </div>
        </MemoryTaskPanel>
      )}

      {(phase === "compare" || phase === "feedback") &&
        (fs ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <MemoryTaskPanel className="relative min-h-0" gradient="horizontal" fullScreen>
              <RoundBadge text={badgeText} fullScreen />
              <div
                className={`relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center ${panelPad} text-center`}
              >
                <h2 className="max-w-[18rem] font-headline text-lg font-bold leading-snug tracking-tight text-white sm:text-xl">
                  Sama atau Berbeda?
                </h2>
                <p className="mt-2 max-w-[17rem] text-[15px] font-medium text-white/95">
                  Bandingkan dengan pola pertama.
                </p>
                <div className="mt-8 flex justify-center sm:mt-9">
                  <PatternGridSquares cells={comparePattern} />
                </div>
              </div>
            </MemoryTaskPanel>

            <div className="relative z-20 shrink-0 space-y-3 bg-[#f0f4f8] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 pointer-events-auto">
              {phase === "compare" ? (
                <>
                  <div className="rounded-2xl bg-[#d9f99d] py-3.5 text-center text-sm font-bold text-slate-700">
                    Pilih Jawaban
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => answer(true)}
                      className="min-h-[3.25rem] rounded-2xl border border-slate-200 bg-white py-3.5 text-center font-headline text-[13px] font-bold leading-snug text-slate-900 shadow-sm transition-transform duration-200 active:scale-[0.98] sm:text-sm"
                    >
                      Keduanya sama
                    </button>
                    <button
                      type="button"
                      onClick={() => answer(false)}
                      className="min-h-[3.25rem] rounded-2xl border border-slate-200 bg-white py-3.5 text-center font-headline text-sm font-bold text-slate-900 shadow-sm transition-transform duration-200 active:scale-[0.98]"
                    >
                      Berbeda
                    </button>
                  </div>
                </>
              ) : (
                <div
                  className={`rounded-2xl py-3.5 text-center text-sm font-bold ${
                    feedbackText.includes("Benar") ? "bg-[#d9f99d] text-slate-800" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {feedbackText}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-[20.5rem] flex-col gap-3.5 sm:max-w-[21rem]">
            <MemoryTaskPanel className="relative" gradient="horizontal" fullScreen={false}>
              <RoundBadge text={badgeText} fullScreen={false} />
              <div className="relative z-[1] flex flex-col items-center px-5 pb-6 pt-10 text-center sm:px-7 sm:pt-11">
                <h2 className="max-w-[18rem] font-headline text-lg font-bold leading-snug tracking-tight text-white sm:text-[1.4rem]">
                  Sama atau Berbeda?
                </h2>
                <p className="mt-2 max-w-[17rem] text-[15px] font-normal leading-relaxed text-white">
                  Bandingkan dengan pola pertama.
                </p>
                <div className="mt-9 flex justify-center sm:mt-10">
                  <PatternGridSquares cells={comparePattern} />
                </div>
              </div>
            </MemoryTaskPanel>

            {phase === "compare" ? (
              <>
                <div className="rounded-2xl bg-[#d9f99d] py-3.5 text-center text-sm font-bold text-slate-700">
                  Pilih Jawaban
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => answer(true)}
                    className="min-h-[3.4rem] rounded-2xl border border-slate-200 bg-white py-4 text-center font-headline text-[13px] font-bold leading-snug text-slate-900 shadow-sm transition-transform duration-200 active:scale-[0.98] sm:text-sm"
                  >
                    Keduanya sama
                  </button>
                  <button
                    type="button"
                    onClick={() => answer(false)}
                    className="min-h-[3.4rem] rounded-2xl border border-slate-200 bg-white py-4 text-center font-headline text-sm font-bold text-slate-900 shadow-sm transition-transform duration-200 active:scale-[0.98]"
                  >
                    Berbeda
                  </button>
                </div>
              </>
            ) : (
              <div
                className={`rounded-2xl py-3.5 text-center text-sm font-bold ${
                  feedbackText.includes("Benar") ? "bg-[#d9f99d] text-slate-800" : "bg-amber-100 text-amber-900"
                }`}
              >
                {feedbackText}
              </div>
            )}
          </div>
        ))}

      {phase === "done" && finalStats && !chainMode && (
        <MemoryTaskPanel gradient="vertical" fullScreen={fs}>
          <div
            className={`relative z-[1] ${fs ? `${panelPad} flex min-h-0 flex-1 flex-col justify-center` : "px-5 pb-6 pt-8 sm:px-7"}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-center font-headline text-xl font-semibold text-white">Selesai</h2>
            <ul className="mb-6 space-y-2.5 text-left text-sm text-white/90">
              <li>
                Babak benar: <strong className="font-semibold text-white">{finalStats.roundsCorrect}</strong> / {ROUNDS}
              </li>
              <li>
                Kompleksitas pola maks.: <strong className="font-semibold text-white">{finalStats.maxSpan}</strong> sel
              </li>
              <li>
                Skor: <strong className="font-semibold text-white">{finalStats.score}</strong>
              </li>
            </ul>
            <p className="mb-5 text-center text-xs text-white/70">Hasil disimpan di riwayat tes.</p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => navigate("/cognitive-tests/results")}
                className="rounded-xl bg-white py-3.5 font-semibold text-sky-900 shadow-sm transition-transform duration-300 active:scale-[0.99]"
              >
                Lihat riwayat
              </button>
              <Link
                to="/cognitive-tests"
                className="rounded-xl py-3.5 text-center font-medium text-white ring-1 ring-inset ring-white/35 transition-opacity hover:opacity-90"
              >
                Menu tes
              </Link>
            </div>
          </div>
        </MemoryTaskPanel>
      )}
    </div>
  );

  return (
    <div
      className={`fixed inset-0 ${overlayZ} flex h-[100dvh] w-full max-w-none touch-manipulation flex-col overflow-hidden antialiased selection:bg-white/20`}
    >
      {!fullScreenSession ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-0 bg-[#f0f4f8]" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-80"
            style={{
              background: "radial-gradient(ellipse 120% 80% at 50% 20%, rgba(200, 220, 240, 0.35), transparent 55%)",
            }}
            aria-hidden
          />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 z-0 bg-[#f0f4f8]" aria-hidden />
      )}

      <Link
        to="/cognitive-tests"
        className={`pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] z-[120] flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200 active:scale-95 ${
          fullScreenSession
            ? "bg-black/35 text-white shadow-sm backdrop-blur-md"
            : "bg-white text-slate-500 shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
        }`}
        aria-label="Kembali ke menu tes"
      >
        <span className="material-symbols-outlined text-[22px]">arrow_back</span>
      </Link>

      {!fullScreenSession ? (
        stepLabel ? (
          <p className="pointer-events-none pt-[max(2.85rem,env(safe-area-inset-top)+2.1rem)] text-center text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {stepLabel}
          </p>
        ) : (
          <p className="pointer-events-none pt-[max(2.85rem,env(safe-area-inset-top)+2.1rem)] text-center text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Memori kerja
          </p>
        )
      ) : null}

      <div
        className={`relative z-10 flex min-h-0 flex-1 flex-col ${
          fullScreenSession
            ? "min-h-0 px-0 pb-0 pt-0"
            : "items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        }`}
      >
        {mainInner}
      </div>
    </div>
  );
}
