import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";
import {
  createCommunityEvent,
  fetchChatMessages,
  fetchCommunityDetail,
  fetchCommunityEvents,
  fetchCommunityLeaderboard,
  fetchPosts,
  joinCommunity,
  leaveCommunity,
  sendChatMessage,
  updateCommunity,
  FALLBACK_HUB,
} from "../../lib/communityApi";
import { CommunityShell, formatMemberCount } from "./CommunityShell";
import { showConfirm, showError, showSuccess } from "../../lib/appAlert";
import { compressDataUrlForAi } from "../../lib/imageCompressForAi";
import CommunityCreateEventSheet from "./CommunityCreateEventSheet";
import CommunityActivityDetailSheet from "./CommunityActivityDetailSheet";
import CommunityFeedPanel from "./CommunityFeedPanel";
import CommunityLeaderboardPanel from "./CommunityLeaderboardPanel";

const ACCENT = "#8B1E2D";

const BOTTOM_TABS = [
  { key: "profile", label: "Profile", icon: "home" },
  { key: "activities", label: "Activities", icon: "calendar_month" },
  { key: "members", label: "Members", icon: "group" },
  { key: "chat", label: "Chat", icon: "forum" },
  { key: "feed", label: "Feed", icon: "dynamic_feed" },
  { key: "rank", label: "Rank", icon: "emoji_events" },
];

function demoCommunity(id) {
  const fromPopular = (FALLBACK_HUB.popular || []).find((c) => String(c.id) === String(id));
  if (fromPopular) {
    return {
      ...fromPopular,
      description:
        "Located nearby · Train with coaches · Beginner friendly coaching & mabar. Join us for weekly open play!",
      is_public: true,
      is_member: false,
      my_role: null,
      member_count: fromPopular.member_count || 0,
    };
  }
  return {
    id: String(id),
    name: "Community",
    sport_key: "badminton",
    sport_name: "Badminton",
    city: "Indonesia",
    banner_url:
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=900&auto=format&fit=crop&q=80",
    logo_url: "",
    description: "Komunitas olahraga WELL.",
    is_public: true,
    is_member: false,
    member_count: 0,
  };
}

function memberInitial(name) {
  return (name || "?").slice(0, 1).toUpperCase();
}

function MemberAvatar({ member, size = "size-8" }) {
  if (member?.photo_url) {
    return (
      <img
        src={member.photo_url}
        alt=""
        className={`${size} rounded-full object-cover border-2 border-white bg-slate-200`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold`}
      style={{ backgroundColor: ACCENT }}
    >
      {memberInitial(member?.name)}
    </div>
  );
}

function ActivityCard({ event, onOpen }) {
  const when = event.starts_at
    ? new Date(event.starts_at).toLocaleString("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
  const joined = Number(event.rsvp_count) || 0;
  const cap = Number(event.capacity) || 17;
  const slots = Math.min(6, cap);
  const typeLabel = event.event_type === "coaching" ? "Coaching" : "Open Play";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm active:scale-[0.99] transition-transform"
    >
      <p className="text-[15px] font-bold text-slate-900 leading-snug">{event.title}</p>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-500">
        <span className="material-symbols-outlined text-[16px]">sports_tennis</span>
        {event.sport_name || event.sport_key} · Newbie - Advanced
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
        <span className="material-symbols-outlined text-[16px]">calendar_month</span>
        {when}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
        <span className="material-symbols-outlined text-[16px]">location_on</span>
        <span className="truncate">{event.place || "Lokasi menyusul"}</span>
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="inline-flex rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
          {typeLabel}
        </span>
        {event.status ? (
          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 capitalize">
            {event.status}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex -space-x-2">
          {Array.from({ length: slots }).map((_, i) => (
            <span
              key={i}
              className={`size-7 rounded-full border-2 border-white ${
                i < joined ? "bg-slate-300" : "border-dashed border-slate-300 bg-transparent"
              }`}
            />
          ))}
        </div>
        <span className="text-[12px] font-semibold text-slate-500">
          {joined}/{cap}
        </span>
      </div>
    </button>
  );
}

export default function CommunityDetailContent() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("profile");
  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activityFilter, setActivityFilter] = useState("open_play");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [detailEventId, setDetailEventId] = useState(null);
  const [expandedMemberId, setExpandedMemberId] = useState("");
  const [mediaBusy, setMediaBusy] = useState("");
  const bannerFileRef = useRef(null);
  const logoFileRef = useRef(null);
  const chatEndRef = useRef(null);
  const sessionUser = getSessionUser();
  const myUserId = sessionUser?.id != null ? String(sessionUser.id) : "";

  const reload = useCallback(async () => {
    try {
      const data = await fetchCommunityDetail(communityId);
      setCommunity(data.community);
      setMembers(data.members || []);
      setError("");
    } catch (e) {
      setCommunity(demoCommunity(communityId));
      setMembers([]);
      setError(e?.message || "Mode demo — API/DB belum siap.");
    }
  }, [communityId]);

  const reloadEvents = useCallback(async () => {
    try {
      const d = await fetchCommunityEvents(communityId);
      setEvents(d.events || []);
    } catch {
      setEvents([]);
    }
  }, [communityId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!community) return;
    reloadEvents();
  }, [community, reloadEvents]);

  useEffect(() => {
    if (!community || tab !== "feed") return;
    fetchPosts(communityId)
      .then((d) => setPosts(d.posts || []))
      .catch(() => setPosts([]));
  }, [tab, community, communityId]);

  useEffect(() => {
    if (!community || tab !== "rank") return;
    setLbLoading(true);
    fetchCommunityLeaderboard(communityId)
      .then((d) => setLeaderboard(d.leaderboard || []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false));
  }, [tab, community, communityId]);

  useEffect(() => {
    if (!community || tab !== "chat") return undefined;
    if (!community.is_member) {
      setMessages([]);
      return undefined;
    }
    let cancelled = false;
    const load = () =>
      fetchChatMessages(communityId)
        .then((d) => {
          if (!cancelled) setMessages(d.messages || []);
        })
        .catch(() => {
          if (!cancelled) setMessages([]);
        });
    load();
    const timer = setInterval(load, 7000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tab, community, communityId]);

  useEffect(() => {
    if (tab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, tab]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const typeOk =
        activityFilter === "all" || (e.event_type || "open_play") === activityFilter;
      const statusOk = statusFilter === "all" || (e.status || "open") === statusFilter;
      return typeOk && statusOk;
    });
  }, [events, activityFilter, statusFilter]);

  const previewMembers = useMemo(() => members.slice(0, 8), [members]);

  const onJoinToggle = async () => {
    if (!community) return;
    if (community.my_role === "owner") return;
    if (community.is_member) {
      const ok = await showConfirm("Keluar komunitas?", `Keluar dari "${community.name}"?`, "Keluar");
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (community.is_member) {
        await leaveCommunity(communityId);
        showSuccess("Berhasil keluar", `Anda keluar dari ${community.name}.`);
      } else {
        await joinCommunity(communityId);
        showSuccess("Berhasil join", `Selamat bergabung di ${community.name}!`);
      }
      await reload();
    } catch (e) {
      showError("Gagal update membership", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onCreateEvent = async (payload) => {
    setCreateBusy(true);
    try {
      await createCommunityEvent(communityId, payload);
      await reloadEvents();
      setCreateOpen(false);
      setTab("activities");
      showSuccess("Aktivitas dibuat", "Aktivitas komunitas berhasil dibuat.");
    } finally {
      setCreateBusy(false);
    }
  };

  const canEditMedia =
    community && (community.my_role === "owner" || community.my_role === "admin");

  const onPickCommunityMedia = async (e, field) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canEditMedia) return;
    if (!file.type.startsWith("image/")) {
      showError("File tidak valid", "Pilih file gambar (JPG/PNG).");
      return;
    }
    setMediaBusy(field);
    try {
      const raw = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Gagal membaca gambar."));
        reader.readAsDataURL(file);
      });
      const compressed = await compressDataUrlForAi(raw, {
        maxEdge: field === "banner_url" ? 1400 : 512,
        quality: field === "banner_url" ? 0.72 : 0.8,
      });
      const { community: next } = await updateCommunity(communityId, { [field]: compressed });
      setCommunity(next);
      showSuccess(
        field === "banner_url" ? "Background diperbarui" : "Logo diperbarui",
        "Perubahan tampilan komunitas berhasil disimpan."
      );
    } catch (err) {
      const msg = err?.message || "Gagal mengunggah gambar.";
      const friendly = /Data too long|banner_url|logo_url|ER_DATA_TOO_LONG/i.test(msg)
        ? "Gambar terlalu besar untuk DB. Jalankan migrate 016_community_banner_logo_text.sql."
        : msg;
      showError("Gagal unggah", friendly);
    } finally {
      setMediaBusy("");
    }
  };

  if (!community) {
    return (
      <CommunityShell>
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Memuat…</div>
      </CommunityShell>
    );
  }

  const visibility = community.is_public !== false ? "Public" : "Private";
  const isMember = Boolean(community.is_member);

  return (
    <CommunityShell className="bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto bg-white pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <div className="relative">
          <div className="relative h-[180px] overflow-hidden bg-slate-800">
            {community.banner_url ? (
              <img src={community.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-600 to-[#8B1E2D]/50" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-3 pt-[max(0.65rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={() => navigate("/community")}
                className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <p className="max-w-[55%] truncate text-sm font-semibold text-white drop-shadow">
                {community.name}
              </p>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: community.name, url: window.location.href }).catch(() => {});
                  }
                }}
              >
                <span className="material-symbols-outlined">ios_share</span>
              </button>
            </div>
            {canEditMedia ? (
              <button
                type="button"
                disabled={Boolean(mediaBusy)}
                onClick={() => bannerFileRef.current?.click()}
                className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                {mediaBusy === "banner_url" ? "…" : "Background"}
              </button>
            ) : null}
          </div>

          {/* Logo overlapping bottom center of banner */}
          <div className="absolute left-1/2 top-[180px] z-20 -translate-x-1/2 -translate-y-1/2">
            <div
              className="relative size-[88px] overflow-hidden rounded-full border-[3px] border-white shadow-lg"
              style={{ backgroundColor: ACCENT }}
            >
              {community.logo_url ? (
                <img src={community.logo_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-xl font-black text-white">
                  {(community.name || "C").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            {canEditMedia ? (
              <button
                type="button"
                disabled={Boolean(mediaBusy)}
                onClick={() => logoFileRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-2 border-white text-white shadow disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
                aria-label="Ubah logo"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {mediaBusy === "logo_url" ? "progress_activity" : "photo_camera"}
                </span>
              </button>
            ) : null}
          </div>

          <input
            ref={bannerFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickCommunityMedia(e, "banner_url")}
          />
          <input
            ref={logoFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickCommunityMedia(e, "logo_url")}
          />
        </div>

        <div className="px-4 pt-14 text-center">
          <h1 className="text-[22px] font-extrabold leading-tight text-slate-900">{community.name}</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">
            {community.sport_name || community.sport_key} · {visibility} · {community.city || "Indonesia"}
            {community.company ? ` · ${community.company}` : ""}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={busy || community.my_role === "owner"}
              onClick={onJoinToggle}
              className={`h-11 flex-1 max-w-[140px] rounded-xl text-sm font-bold disabled:opacity-60 ${
                isMember && community.my_role !== "owner"
                  ? "border-2 text-[#8B1E2D] bg-white"
                  : "text-white"
              }`}
              style={
                isMember && community.my_role !== "owner"
                  ? { borderColor: ACCENT }
                  : { backgroundColor: ACCENT }
              }
            >
              {isMember ? (community.my_role === "owner" ? "Owner" : "Joined") : "Join"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/community/sparring")}
              className="h-11 flex-1 max-w-[140px] rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800"
            >
              Challenge
            </button>
            <button
              type="button"
              onClick={() => setTab("chat")}
              className="flex size-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700"
            >
              <span className="material-symbols-outlined">chat_bubble</span>
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
              {error}
            </p>
          ) : null}
        </div>

        <div className="px-4 pt-5 pb-4">
          {tab === "profile" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white py-3 text-center">
                <button type="button" className="px-1" onClick={() => setTab("members")}>
                  <p className="text-[13px] font-bold text-slate-900">
                    {formatMemberCount(community.member_count || members.length)} Members
                  </p>
                </button>
                <button type="button" className="px-1" onClick={() => setTab("activities")}>
                  <p className="text-[13px] font-bold text-slate-900">{events.length || 0} Activities</p>
                </button>
                <button type="button" className="px-1 flex items-center justify-center gap-0.5" onClick={() => setTab("rank")}>
                  <span className="material-symbols-outlined text-[16px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  <p className="text-[13px] font-bold text-slate-900">Rank</p>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-bold text-slate-900">Members</p>
                  <button
                    type="button"
                    onClick={() => setTab("members")}
                    className="text-[13px] font-bold"
                    style={{ color: ACCENT }}
                  >
                    See all
                  </button>
                </div>
                {previewMembers.length === 0 ? (
                  <p className="mt-3 text-[12px] text-slate-500">Belum ada member. Jadilah yang pertama join.</p>
                ) : (
                  <div className="mt-3 flex items-center">
                    <div className="flex -space-x-2">
                      {previewMembers.map((m) => (
                        <MemberAvatar key={m.user_id} member={m} />
                      ))}
                    </div>
                    <p className="ml-3 text-[12px] font-semibold text-slate-600">
                      {formatMemberCount(community.member_count || members.length)} bergabung
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-[15px] font-bold text-slate-900">
                  {community.sport_name ? `${community.sport_name} ${community.name}` : community.name}
                </p>
                <ul className="mt-3 space-y-2 text-[13px] text-slate-600">
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">home</span>
                    <span>Located in {community.city || "area nearby"}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">sports</span>
                    <span>Train with coaches &amp; friends</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">waving_hand</span>
                    <span>{community.description || "Beginner friendly coaching & mabar."}</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {tab === "activities" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="flex-1 rounded-full border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
                >
                  <option value="open_play">Open Play</option>
                  <option value="coaching">Coaching</option>
                  <option value="all">Semua Tipe</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 rounded-full border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
                >
                  <option value="all">Semua Status</option>
                  <option value="open">Open</option>
                  <option value="full">Full</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {isMember ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  Buat aktivitas
                </button>
              ) : (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-center text-[12px] text-slate-500">
                  Join komunitas untuk membuat aktivitas.
                </p>
              )}

              {filteredEvents.length === 0 ? (
                <div className="py-14 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300">event_busy</span>
                  <p className="mt-3 text-sm font-bold text-slate-800">No activities yet</p>
                  <p className="mt-1 text-[12px] text-slate-500 px-6">
                    Open play dan coaching komunitas akan muncul di sini.
                  </p>
                  {isMember ? (
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-4 rounded-xl px-4 py-2 text-sm font-bold text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Buat aktivitas pertama
                    </button>
                  ) : null}
                </div>
              ) : (
                filteredEvents.map((ev) => (
                  <ActivityCard
                    key={ev.id}
                    event={ev}
                    onOpen={() => setDetailEventId(ev.id)}
                  />
                ))
              )}
            </div>
          )}

          {tab === "members" && (
            <div className="space-y-2">
              {members.length === 0 ? (
                <div className="py-14 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300">group_off</span>
                  <p className="mt-3 text-sm font-bold text-slate-800">Belum ada member</p>
                  <p className="mt-1 text-[12px] text-slate-500">Join untuk bergabung ke komunitas ini.</p>
                  {!isMember ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onJoinToggle}
                      className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Join Community
                    </button>
                  ) : null}
                </div>
              ) : (
                members.map((m) => {
                  const open = expandedMemberId === String(m.user_id);
                  return (
                    <div key={m.user_id} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMemberId(open ? "" : String(m.user_id))
                        }
                        className="flex w-full items-center gap-3 p-3 text-left"
                      >
                        <MemberAvatar member={m} size="size-11" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{m.name}</p>
                          <p className="text-[11px] text-slate-500 capitalize">{m.role}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 text-[20px]">
                          {open ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 text-[12px] text-slate-600 space-y-1.5">
                          {m.sid ? (
                            <p>
                              <span className="font-semibold text-slate-700">SID:</span> {m.sid}
                            </p>
                          ) : null}
                          {m.division ? (
                            <p>
                              <span className="font-semibold text-slate-700">Divisi:</span> {m.division}
                            </p>
                          ) : null}
                          <p>
                            <span className="font-semibold text-slate-700">Role:</span>{" "}
                            <span className="capitalize">{m.role}</span>
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Joined:</span>{" "}
                            {m.joined_at
                              ? new Date(m.joined_at).toLocaleString("id-ID")
                              : "—"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "chat" && (
            <div className="flex flex-col min-h-[420px]">
              {!isMember ? (
                <div className="py-14 text-center px-4">
                  <span className="material-symbols-outlined text-5xl text-slate-300">forum</span>
                  <p className="mt-3 text-sm font-bold text-slate-800">Join to chat</p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Gabung komunitas dulu untuk ikut chat group.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onJoinToggle}
                    className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                    style={{ backgroundColor: ACCENT }}
                  >
                    Join Community
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[12px] font-semibold text-slate-700">Chat Group · {community.name}</p>
                    <p className="text-[11px] text-slate-500">Pesan group — refresh otomatis tiap beberapa detik</p>
                  </div>
                  <div className="flex-1 max-h-[320px] overflow-y-auto space-y-2.5 rounded-2xl border border-slate-100 bg-[#f7f7f8] p-3">
                    {messages.length === 0 ? (
                      <p className="py-10 text-center text-[12px] text-slate-400">
                        Belum ada pesan. Mulai percakapan!
                      </p>
                    ) : (
                      messages.map((m) => {
                        const mine = myUserId && String(m.sender_user_id) === myUserId;
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                          >
                            {!mine ? (
                              <p className="mb-0.5 px-1 text-[10px] font-bold text-slate-500">
                                {m.sender_name}
                              </p>
                            ) : null}
                            <div
                              className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                                mine
                                  ? "rounded-br-md text-white"
                                  : "rounded-bl-md bg-white text-slate-800 border border-slate-100"
                              }`}
                              style={mine ? { backgroundColor: ACCENT } : undefined}
                            >
                              {m.body}
                            </div>
                            <p className="mt-0.5 px-1 text-[9px] text-slate-400">
                              {m.created_at
                                ? new Date(m.created_at).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </p>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const text = chatInput.trim();
                      if (!text || chatSending) return;
                      setChatSending(true);
                      setError("");
                      try {
                        const { message } = await sendChatMessage(communityId, text);
                        setMessages((prev) => [...prev, message]);
                        setChatInput("");
                      } catch (err) {
                        showError("Gagal kirim pesan", err?.message || "");
                      } finally {
                        setChatSending(false);
                      }
                    }}
                  >
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Tulis pesan group…"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
                    />
                    <button
                      type="submit"
                      disabled={chatSending || !chatInput.trim()}
                      className="flex size-11 items-center justify-center rounded-xl text-white disabled:opacity-50"
                      style={{ backgroundColor: ACCENT }}
                    >
                      <span className="material-symbols-outlined">send</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {tab === "feed" && (
            <CommunityFeedPanel
              communityId={communityId}
              posts={posts}
              setPosts={setPosts}
              isMember={isMember}
              onNeedJoin={onJoinToggle}
              communityName={community.name}
              communityCity={community.city}
            />
          )}

          {tab === "rank" && (
            <CommunityLeaderboardPanel
              rows={leaderboard}
              myUserId={myUserId}
              loading={lbLoading}
            />
          )}
        </div>
      </div>

      <nav className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-stretch justify-between">
          {BOTTOM_TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="flex flex-1 flex-col items-center gap-0.5 py-1 min-w-0"
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    color: active ? ACCENT : "#94a3b8",
                    fontVariationSettings: active ? "'FILL' 1" : undefined,
                  }}
                >
                  {t.icon}
                </span>
                <span
                  className="text-[9px] font-semibold truncate max-w-full px-0.5"
                  style={{ color: active ? ACCENT : "#94a3b8" }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <CommunityCreateEventSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreateEvent}
        defaultSportKey={community.sport_key}
        busy={createBusy}
      />
      <CommunityActivityDetailSheet
        open={Boolean(detailEventId)}
        eventId={detailEventId}
        onClose={() => setDetailEventId(null)}
        onChanged={() => {
          reloadEvents();
        }}
      />
    </CommunityShell>
  );
}
