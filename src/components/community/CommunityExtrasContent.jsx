import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createSparring,
  fetchCoaching,
  fetchCompetitionStandings,
  fetchCompetitions,
  fetchLeaderboard,
  fetchMyBadges,
  fetchMyCommunities,
  fetchSparring,
  patchSparring,
} from "../../lib/communityApi";
import { CommunityShell, CommunityTopBar } from "./CommunityShell";
import { showError, showSuccess } from "../../lib/appAlert";

export function CommunitySparringContent() {
  const [items, setItems] = useState([]);
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState({
    sport_key: "futsal",
    proposed_at: "",
    place: "",
    from_community_id: "",
  });
  const [error, setError] = useState("");

  const reload = () =>
    fetchSparring()
      .then((d) => setItems(d.sparring || []))
      .catch((e) => setError(e?.message || "Gagal memuat sparring."));

  useEffect(() => {
    reload();
    fetchMyCommunities()
      .then((d) => setMine(d.communities || []))
      .catch(() => {});
  }, []);

  return (
    <CommunityShell>
      <CommunityTopBar title="Sparring" subtitle="Cari lawan & catat skor" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <form
          className="rounded-xl border border-slate-100 bg-white p-3 space-y-2 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createSparring({
                ...form,
                proposed_at: form.proposed_at
                  ? new Date(form.proposed_at).toISOString().slice(0, 19).replace("T", " ")
                  : form.proposed_at,
                from_community_id: form.from_community_id || null,
              });
              setForm((f) => ({ ...f, proposed_at: "", place: "" }));
              reload();
              showSuccess("Sparring diajukan", "Pengajuan sparring berhasil dikirim.");
            } catch (err) {
              setError(err?.message || "Gagal buat sparring.");
              showError("Gagal buat sparring", err?.message || "");
            }
          }}
        >
          <p className="text-sm font-bold">Ajukan Sparring</p>
          <select
            value={form.from_community_id}
            onChange={(e) => setForm((f) => ({ ...f, from_community_id: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Komunitas (opsional)</option>
            {mine.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            required
            type="datetime-local"
            value={form.proposed_at}
            onChange={(e) => setForm((f) => ({ ...f, proposed_at: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="Lokasi"
            value={form.place}
            onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button type="submit" className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-white">
            Kirim Challenge
          </button>
        </form>
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
        {items.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm space-y-2">
            <div className="flex justify-between gap-2">
              <p className="text-sm font-bold">
                {s.from_name || "Open"} vs {s.to_name || "TBA"}
              </p>
              <span className="text-[10px] font-bold uppercase text-primary">{s.status}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {s.sport_name} · {new Date(s.proposed_at).toLocaleString("id-ID")} · {s.place || "-"}
            </p>
            {s.status === "done" ? (
              <p className="text-sm font-semibold">
                Skor {s.score_home ?? "-"} : {s.score_away ?? "-"}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {s.status === "pending" ? (
                <>
                  <button
                    type="button"
                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"
                    onClick={() =>
                      patchSparring(s.id, { status: "accepted" })
                        .then(reload)
                        .then(() => showSuccess("Sparring diterima"))
                        .catch((e) => showError("Gagal update sparring", e?.message || ""))
                    }
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600"
                    onClick={() =>
                      patchSparring(s.id, { status: "declined" })
                        .then(reload)
                        .then(() => showSuccess("Sparring ditolak"))
                        .catch((e) => showError("Gagal update sparring", e?.message || ""))
                    }
                  >
                    Decline
                  </button>
                </>
              ) : null}
              {s.status === "accepted" ? (
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white"
                  onClick={() =>
                    patchSparring(s.id, { status: "done", score_home: 3, score_away: 1 })
                      .then(reload)
                      .then(() => showSuccess("Sparring selesai", "Skor berhasil dicatat."))
                      .catch((e) => showError("Gagal update sparring", e?.message || ""))
                  }
                >
                  Tandai Done (contoh skor)
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </main>
    </CommunityShell>
  );
}

export function CommunityCoachingContent() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCoaching()
      .then((d) => setEvents(d.events || []))
      .catch((e) => setError(e?.message || "Gagal memuat coaching."));
  }, []);

  return (
    <CommunityShell>
      <CommunityTopBar title="Coaching" subtitle="Latihan serius dengan coach" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
        {events.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">
            Belum ada sesi coaching. Buat event bertipe coaching dari komunitas.
          </p>
        ) : (
          events.map((ev) => (
            <Link
              key={ev.id}
              to={`/community/events/${ev.id}`}
              className="block rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
            >
              <p className="text-sm font-bold">{ev.title}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {new Date(ev.starts_at).toLocaleString("id-ID")} · {ev.place || "-"}
              </p>
            </Link>
          ))
        )}
      </main>
    </CommunityShell>
  );
}

export function CommunityCompetitionsContent() {
  const [items, setItems] = useState([]);
  const [standings, setStandings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCompetitions()
      .then((d) => setItems(d.competitions || []))
      .catch((e) => setError(e?.message || "Gagal memuat kompetisi."));
  }, []);

  return (
    <CommunityShell>
      <CommunityTopBar title="Competitions" subtitle="Kompetisi amatir" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setSelected(c.id);
              fetchCompetitionStandings(c.id)
                .then((d) => setStandings(d.standings || []))
                .catch(() => setStandings([]));
            }}
            className={`w-full text-left rounded-xl border p-3 shadow-sm ${
              selected === c.id ? "border-primary bg-primary/5" : "border-slate-100 bg-white"
            }`}
          >
            <p className="text-sm font-bold">{c.name}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {c.sport_name} · {c.status}
            </p>
          </button>
        ))}
        {selected ? (
          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="text-sm font-bold mb-2">Standings</p>
            {standings.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada entri klasemen.</p>
            ) : (
              standings.map((row) => (
                <div key={row.id} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
                  <span>
                    #{row.rank_no} {row.community_name || row.user_name || "-"}
                  </span>
                  <span className="font-bold text-primary">{row.points} pts</span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </main>
    </CommunityShell>
  );
}

export function CommunityLeaderboardContent() {
  const [rows, setRows] = useState([]);
  const [badges, setBadges] = useState({ badges: [], catalog: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchLeaderboard(), fetchMyBadges()])
      .then(([lb, bd]) => {
        setRows(lb.leaderboard || []);
        setBadges(bd);
      })
      .catch((e) => setError(e?.message || "Gagal memuat leaderboard."));
  }, []);

  return (
    <CommunityShell>
      <CommunityTopBar title="Leaderboard" subtitle="Peringkat & badge" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
        <section>
          <h2 className="text-sm font-bold mb-2">Top Players</h2>
          {rows.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada statistik pemain.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={`${r.user_id}-${r.rank}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
                  <span className="text-sm font-black text-primary w-6">#{r.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{r.user_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {r.wins}W / {r.matches}M · {r.goals}G {r.assists}A
                    </p>
                  </div>
                  <span className="text-xs font-bold text-primary">{r.level_points} XP</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-sm font-bold mb-2">Badge Saya</h2>
          {(badges.badges || []).length === 0 ? (
            <p className="text-xs text-slate-500 mb-2">Belum ada badge. Main terus untuk mengumpulkannya.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3">
              {badges.badges.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  <span className="material-symbols-outlined text-[14px]">{b.icon}</span>
                  {b.name}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-500 mb-2">Katalog badge</p>
          <div className="grid grid-cols-2 gap-2">
            {(badges.catalog || []).map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-100 bg-white p-3">
                <span className="material-symbols-outlined text-primary">{b.icon}</span>
                <p className="text-xs font-bold mt-1">{b.name}</p>
                <p className="text-[10px] text-slate-500">{b.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </CommunityShell>
  );
}
