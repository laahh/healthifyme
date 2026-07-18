import { Link } from "react-router-dom";

export function CommunityShell({ children, className = "" }) {
  return (
    <div className="bg-surface font-['Public_Sans',sans-serif] text-on-surface h-dvh min-h-dvh overflow-hidden">
      <div className={`max-w-md mx-auto bg-surface-container-lowest h-full shadow-xl flex flex-col overflow-hidden ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function CommunityTopBar({ title, subtitle, backTo = "/community" }) {
  return (
    <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] bg-emerald-50/80 backdrop-blur-md border-b border-slate-100">
      <Link
        to={backTo}
        className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary/10"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </Link>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold leading-tight truncate">{title}</h1>
        {subtitle ? <p className="text-[11px] text-slate-500 truncate">{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function formatMemberCount(n) {
  const num = Number(n) || 0;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1).replace(/\.0$/, "")}k+`;
  return String(num);
}

export function formatCommunityCountLabel(n) {
  const num = Number(n) || 0;
  return `${num.toLocaleString("id-ID")}+`;
}
