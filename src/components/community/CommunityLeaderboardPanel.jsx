const ACCENT = "#8B1E2D";

export default function CommunityLeaderboardPanel({ rows, myUserId, loading }) {
  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-500">Memuat ranking…</p>;
  }

  if (!rows?.length) {
    return (
      <div className="py-14 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-300">emoji_events</span>
        <p className="mt-3 text-sm font-bold text-slate-800">Belum ada poin</p>
        <p className="mt-1 text-[12px] text-slate-500 px-6">
          Join event atau posting di feed untuk naik rank.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const mine = myUserId && String(r.user_id) === String(myUserId);
        return (
          <div
            key={`${r.user_id}-${r.rank}`}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${
              mine ? "border-[#8B1E2D]/40 bg-[#8B1E2D]/5" : "border-slate-100 bg-white"
            }`}
          >
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
              style={{ backgroundColor: r.rank <= 3 ? ACCENT : "#94a3b8" }}
            >
              {r.rank}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">
                {r.user_name}
                {mine ? <span className="ml-1 text-[10px] font-semibold text-[#8B1E2D]">(Anda)</span> : null}
              </p>
              <p className="text-[11px] text-slate-500">
                {r.matches || 0} match · {r.wins || 0} win
              </p>
            </div>
            <p className="text-sm font-extrabold tabular-nums" style={{ color: ACCENT }}>
              {r.level_points || 0}
              <span className="ml-0.5 text-[10px] font-semibold text-slate-400">pts</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
