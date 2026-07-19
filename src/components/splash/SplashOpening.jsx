import { useEffect, useState } from "react";

/**
 * Opening brand Well — satu composition: atmosfer + mark + wordmark + tagline.
 * Motion via phase state; respects prefers-reduced-motion.
 */
export default function SplashOpening() {
  const [phase, setPhase] = useState("idle"); // idle | in | hold
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setPhase("hold");
      return;
    }
    const t0 = requestAnimationFrame(() => setPhase("in"));
    const t1 = setTimeout(() => setPhase("hold"), 1400);
    return () => {
      cancelAnimationFrame(t0);
      clearTimeout(t1);
    };
  }, [reduceMotion]);

  const show = phase !== "idle";
  const settled = phase === "hold" || reduceMotion;

  return (
    <div className="relative flex h-dvh min-h-dvh w-full items-center justify-center overflow-hidden bg-[#003d24]">
      {/* Atmosfer */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out ${
          show || reduceMotion ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "linear-gradient(165deg, #003d24 0%, #006a3f 48%, #058651 100%)",
        }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-[42%] size-[min(120vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 ${
          show || reduceMotion ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[20%] -top-[10%] size-[70%] rounded-full bg-white/[0.04] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[15%] -right-[25%] size-[75%] rounded-full bg-[#003d24]/50 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center px-8 text-center">
        {/* Mark */}
        <div
          className={`mb-6 flex size-16 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            show || reduceMotion
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-2 scale-90 opacity-0"
          }`}
          style={{
            transitionDelay: reduceMotion ? "0ms" : "120ms",
          }}
        >
          <span
            className="material-symbols-outlined text-[32px] text-white"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            ecg_heart
          </span>
        </div>

        {/* Wordmark */}
        <h1
          className={`select-none font-headline font-extrabold leading-none tracking-tight text-white transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            show || reduceMotion
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-[0.92] opacity-0"
          }`}
          style={{
            fontSize: "clamp(3.75rem, 18vw, 5.5rem)",
            letterSpacing: "-0.04em",
            transitionDelay: reduceMotion ? "0ms" : "220ms",
          }}
        >
          Well
        </h1>

        {/* Tagline */}
        <p
          className={`mt-4 max-w-[16rem] text-[13px] font-medium leading-relaxed text-white/75 transition-all duration-700 ease-out ${
            show || reduceMotion
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0"
          }`}
          style={{
            transitionDelay: reduceMotion ? "0ms" : "650ms",
          }}
        >
          Kesehatan dalam genggaman
        </p>
      </div>

      {/* Soft bottom cue */}
      <div
        aria-hidden
        className={`absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-0 right-0 flex justify-center transition-opacity duration-500 ${
          settled ? "opacity-40" : "opacity-0"
        }`}
      >
        <span className="h-1 w-8 rounded-full bg-white/80" />
      </div>
    </div>
  );
}
