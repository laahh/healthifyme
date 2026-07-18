import { Link } from "react-router-dom";

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   subtitle?: string,
 *   icon: string,
 *   iconClass?: string,
 *   to?: string,
 *   onClick?: () => void,
 * }} MenuItem
 */

/**
 * @param {{ title: string, items: MenuItem[] }} props
 */
export default function ProfileMenuGroup({ title, items }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const rowClass = `flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
            !isLast ? "border-b border-slate-100 dark:border-slate-800" : ""
          }`;
          const body = (
            <>
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                  item.iconClass || "bg-slate-50 text-primary dark:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                  {item.label}
                </p>
                {item.subtitle ? (
                  <p className="text-[11px] text-slate-500">{item.subtitle}</p>
                ) : null}
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </>
          );

          if (item.to) {
            return (
              <Link key={item.key} to={item.to} className={rowClass}>
                {body}
              </Link>
            );
          }

          return (
            <button key={item.key} type="button" onClick={item.onClick} className={rowClass}>
              {body}
            </button>
          );
        })}
      </div>
    </section>
  );
}
