import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchMyCommunities } from "../../lib/communityApi";
import { CommunityShell, CommunityTopBar, formatMemberCount } from "./CommunityShell";
import CommunityCreateSheet from "./CommunityCreateSheet";

export function CommunityCreateContent() {
  const navigate = useNavigate();

  return (
    <CommunityShell>
      <CommunityTopBar title="Create Community" subtitle="Buat komunitas olahraga baru" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-center text-sm text-slate-500 py-8">Membuka form…</p>
      </main>
      <CommunityCreateSheet
        open
        onClose={() => navigate("/community", { replace: true })}
      />
    </CommunityShell>
  );
}

export function CommunityManageContent() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchMyCommunities()
      .then((d) => setItems(d.communities || []))
      .catch((e) => setError(e?.message || "Gagal memuat."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = items.filter((c) => {
    const role = String(c.my_role || "member").toLowerCase();
    if (filter === "owned") return role === "owner" || role === "admin";
    if (filter === "joined") return role === "member";
    return true;
  });

  return (
    <CommunityShell>
      <CommunityTopBar title="My Communities" subtitle="Komunitas yang kamu ikuti atau kelola" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Create Community
        </button>

        <div className="flex gap-2">
          {[
            { key: "all", label: "All" },
            { key: "owned", label: "Owned" },
            { key: "joined", label: "Joined" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                filter === f.key
                  ? "bg-[#8B1E2D] text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-8">Memuat…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
            <p className="text-sm text-slate-500">
              {items.length === 0
                ? "Belum join komunitas. Cari di hub atau buat yang baru."
                : "Tidak ada komunitas di filter ini."}
            </p>
            <Link to="/community" className="mt-3 inline-block text-[13px] font-semibold text-primary">
              Jelajahi komunitas
            </Link>
          </div>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              to={`/community/${c.id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
            >
              <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden">
                {c.logo_url ? (
                  <img src={c.logo_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined">groups</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{c.name}</p>
                <p className="text-[11px] text-slate-500">
                  {c.my_role} · {formatMemberCount(c.member_count)} members
                  {c.company ? ` · ${c.company}` : ""}
                </p>
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </Link>
          ))
        )}
      </main>

      <CommunityCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => reload()}
      />
    </CommunityShell>
  );
}
