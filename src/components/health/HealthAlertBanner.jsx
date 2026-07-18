import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const DISMISS_KEY = "health_alert_banner_dismiss_v1";

function toneForSeverity(severity) {
  if (severity === "high") {
    return {
      wrap: "border-red-200 bg-red-50 text-red-900",
      icon: "warning",
      iconWrap: "bg-red-100 text-red-700",
      chip: "bg-red-100 text-red-800",
    };
  }
  if (severity === "warning") {
    return {
      wrap: "border-orange-200 bg-orange-50 text-orange-950",
      icon: "report",
      iconWrap: "bg-orange-100 text-orange-800",
      chip: "bg-orange-100 text-orange-900",
    };
  }
  return {
    wrap: "border-amber-200 bg-amber-50 text-amber-950",
    icon: "info",
    iconWrap: "bg-amber-100 text-amber-800",
    chip: "bg-amber-100 text-amber-900",
  };
}

/**
 * @param {{
 *   healthAlert?: {
 *     severity?: string | null,
 *     primary?: { title?: string, message?: string, severity?: string } | null,
 *     alerts?: Array<{ title?: string, message?: string, severity?: string }>,
 *     riskyMealCount?: number,
 *   } | null,
 *   dismissible?: boolean,
 *   className?: string,
 *   compact?: boolean,
 * }} props
 */
export default function HealthAlertBanner({
  healthAlert,
  dismissible = true,
  className = "",
  compact = false,
}) {
  const primary = healthAlert?.primary || healthAlert?.alerts?.[0] || null;
  const severity = healthAlert?.severity || primary?.severity || "info";
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissible || !primary) {
      setDismissed(false);
      return;
    }
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const key = `${healthAlert?.date || ""}:${primary.title || ""}:${severity}`;
      setDismissed(parsed?.key === key);
    } catch {
      setDismissed(false);
    }
  }, [dismissible, primary, healthAlert?.date, severity]);

  if (!primary || dismissed) return null;

  const tone = toneForSeverity(severity);
  const title = primary.title || "Peringatan terkait MCU";
  const message = String(primary.message || "").trim();
  const shortMessage =
    compact && message.length > 140 ? `${message.slice(0, 137)}…` : message;

  const onDismiss = () => {
    const key = `${healthAlert?.date || ""}:${title}:${severity}`;
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify({ key }));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${tone.wrap} ${className}`}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
        >
          <span className="material-symbols-outlined text-[18px]">{tone.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[13px] font-bold leading-snug">{title}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
              {severity === "high" ? "Penting" : severity === "warning" ? "Perhatian" : "Info"}
            </span>
          </div>
          {shortMessage ? (
            <p className="mt-1 text-[12px] leading-relaxed opacity-90">{shortMessage}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              to="/mcu"
              className="text-[11px] font-semibold underline underline-offset-2 opacity-90 hover:opacity-100"
            >
              Lihat MCU
            </Link>
            <Link
              to="/nutrition/insight"
              className="text-[11px] font-semibold underline underline-offset-2 opacity-90 hover:opacity-100"
            >
              Insight nutrisi
            </Link>
          </div>
        </div>
        {dismissible ? (
          <button
            type="button"
            onClick={onDismiss}
            className="flex size-7 shrink-0 items-center justify-center rounded-full opacity-60 hover:bg-black/5 hover:opacity-100"
            aria-label="Tutup peringatan"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
