import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSessionUser } from "../../auth/auth";
import {
  decideOpenPlayParticipant,
  fetchOpenPlayChat,
  fetchOpenPlayDetail,
  joinOpenPlay,
  leaveOpenPlay,
  sendOpenPlayChat,
  updateOpenPlay,
  FALLBACK_OPEN_PLAY,
} from "../../lib/openPlayApi";
import { compressDataUrlForAi } from "../../lib/imageCompressForAi";
import { resolveOpenPlayCover } from "../../lib/openPlayCovers";
import { CommunityShell } from "../community/CommunityShell";
import { showConfirm, showError, showSuccess } from "../../lib/appAlert";

const ACCENT = "#8B1E2D";

const BOTTOM_TABS = [
  { key: "profile", label: "Profile", icon: "home" },
  { key: "schedule", label: "Schedule", icon: "calendar_month" },
  { key: "members", label: "Players", icon: "group" },
  { key: "chat", label: "Chat Group", icon: "forum" },
  { key: "gallery", label: "Gallery", icon: "image" },
];

function formatWhen(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortWhen(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function demoDetail(id) {
  const base = (FALLBACK_OPEN_PLAY.events || []).find((e) => String(e.id) === String(id));
  const event = base || {
    id: String(id),
    title: "Main Bareng Demo",
    sport_key: "badminton",
    sport_name: "Badminton",
    starts_at: new Date(Date.now() + 3600_000).toISOString(),
    place: "Lapangan A",
    city: "Jakarta",
    capacity: 8,
    approved_count: 2,
    spots_left: 6,
    status: "open",
    my_status: null,
    is_host: false,
    fee_note: "",
    description: "Demo event — jalankan migrate 008 untuk data nyata.",
    host_name: "Host",
    skill_level: "all",
  };
  return {
    event,
    participants: [
      { user_id: "1", name: event.host_name || "Host", status: "approved" },
      { user_id: "2", name: "Pemain A", status: "approved" },
    ],
    pending: [],
    waitlist: [],
    chat_state: "open",
    can_chat: false,
  };
}

function statusLabel(event) {
  if (event.is_host) return "Host";
  if (event.my_status === "approved") return "Joined";
  if (event.my_status === "pending") return "Pending";
  if (event.my_status === "waitlist") return "Waitlist";
  return "Join";
}

export default function OpenPlayDetailContent() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("profile");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatState, setChatState] = useState("open");
  const [chatInput, setChatInput] = useState("");
  const [chatImage, setChatImage] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatEndRef = useRef(null);
  const chatFileRef = useRef(null);
  const sessionUser = getSessionUser();
  const myUserId = sessionUser?.id != null ? String(sessionUser.id) : "";

  const reload = useCallback(async () => {
    try {
      const d = await fetchOpenPlayDetail(eventId);
      setData(d);
      if (d.chat_state) setChatState(d.chat_state);
      setError("");
    } catch (e) {
      setData(demoDetail(eventId));
      setError(e?.message || "Mode demo — API/DB belum siap.");
    }
  }, [eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const event = data?.event;
  const canChat = Boolean(data?.can_chat);

  useEffect(() => {
    if (!canChat || tab !== "chat") {
      if (!canChat) setMessages([]);
      return undefined;
    }
    let cancelled = false;
    const load = () =>
      fetchOpenPlayChat(eventId)
        .then((d) => {
          if (cancelled) return;
          setMessages(d.messages || []);
          setChatState(d.chat_state || "open");
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
  }, [canChat, eventId, tab]);

  useEffect(() => {
    if (tab === "gallery" && canChat && messages.length === 0) {
      fetchOpenPlayChat(eventId)
        .then((d) => {
          setMessages(d.messages || []);
          setChatState(d.chat_state || "open");
        })
        .catch(() => {});
    }
  }, [tab, canChat, eventId, messages.length]);

  useEffect(() => {
    if (tab === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, tab]);

  const galleryPhotos = useMemo(
    () => (messages || []).filter((m) => m.image_url),
    [messages]
  );

  const onJoin = async () => {
    if (!event) return;
    setBusy(true);
    try {
      await joinOpenPlay(eventId, note ? { note } : {});
      setNote("");
      await reload();
      showSuccess("Request terkirim", "Permintaan join berhasil dikirim.");
    } catch (e) {
      showError("Gagal request join", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onLeave = async () => {
    if (!event) return;
    const label =
      event.my_status === "approved" ? "Keluar dari event ini?" : "Batalkan request join?";
    const ok = await showConfirm("Konfirmasi", label, "Ya, lanjut");
    if (!ok) return;
    setBusy(true);
    try {
      await leaveOpenPlay(eventId);
      await reload();
      showSuccess("Berhasil", "Anda keluar / membatalkan request join.");
    } catch (e) {
      showError("Gagal membatalkan", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onJoinToggle = async () => {
    if (!event || event.is_host) return;
    if (event.my_status === "approved" || event.my_status === "pending" || event.my_status === "waitlist") {
      await onLeave();
    } else {
      await onJoin();
    }
  };

  const onDecide = async (userId, decision) => {
    setBusy(true);
    try {
      await decideOpenPlayParticipant(eventId, userId, decision);
      await reload();
    } catch (e) {
      showError("Gagal update peserta", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onCancelEvent = async () => {
    const ok = await showConfirm("Batalkan event?", "Event Main Bareng ini akan dibatalkan.", "Ya, batalkan");
    if (!ok) return;
    setBusy(true);
    try {
      await updateOpenPlay(eventId, { status: "cancelled" });
      await reload();
      showSuccess("Event dibatalkan", "Event Main Bareng berhasil dibatalkan.");
    } catch (e) {
      showError("Gagal membatalkan event", e?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onPickChatImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setChatError("Pilih file gambar (JPG/PNG).");
      return;
    }
    setChatError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressed = await compressDataUrlForAi(String(reader.result || ""), {
          maxEdge: 960,
          quality: 0.72,
        });
        setChatImage(compressed);
      } catch {
        setChatError("Gagal memproses gambar.");
      }
    };
    reader.onerror = () => setChatError("Gagal membaca gambar.");
    reader.readAsDataURL(file);
  };

  const onSendChat = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if ((!text && !chatImage) || chatSending) return;
    setChatSending(true);
    setChatError("");
    try {
      const { message } = await sendOpenPlayChat(eventId, {
        ...(text ? { body: text } : {}),
        ...(chatImage ? { image_url: chatImage } : {}),
      });
      setMessages((prev) => [...prev, message]);
      setChatInput("");
      setChatImage("");
    } catch (err) {
      setChatError(err?.message || "Gagal kirim pesan.");
      showError("Gagal kirim pesan", err?.message || "");
    } finally {
      setChatSending(false);
    }
  };

  if (!event) {
    return (
      <CommunityShell>
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Memuat…</div>
      </CommunityShell>
    );
  }

  const cover = resolveOpenPlayCover(event);
  const joinedLike = event.is_host || event.my_status === "approved";
  const joinBtnLabel = statusLabel(event);
  const skillLabel =
    event.skill_level === "beginner"
      ? "Beginner"
      : event.skill_level === "intermediate"
        ? "Intermediate"
        : "Semua level";

  return (
    <CommunityShell className="bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto bg-white pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {/* Banner + logo — pola komunitas */}
        <div className="relative">
          <div className="relative h-[168px] overflow-hidden bg-slate-800">
            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-3 pt-[max(0.65rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={() => navigate("/open-play")}
                className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <p className="max-w-[55%] truncate text-sm font-semibold text-white drop-shadow">
                {event.title}
              </p>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: event.title, url: window.location.href }).catch(() => {});
                  }
                }}
              >
                <span className="material-symbols-outlined">ios_share</span>
              </button>
            </div>
          </div>
          <div className="absolute left-1/2 top-[168px] z-20 size-[72px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-white bg-white shadow-md">
            <div
              className="flex size-full items-center justify-center text-lg font-black text-white"
              style={{ backgroundColor: ACCENT }}
            >
              {(event.title || "MB").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Header info */}
        <div className="px-4 pt-12 text-center">
          <h1 className="text-[22px] font-extrabold leading-tight text-slate-900">{event.title}</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">
            {event.sport_name || event.sport_key} · Main Bareng · {event.city || "Indonesia"}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={busy || event.is_host || event.status === "cancelled"}
              onClick={onJoinToggle}
              className={`h-11 flex-1 max-w-[140px] rounded-xl text-sm font-bold disabled:opacity-60 ${
                joinedLike && !event.is_host
                  ? "border-2 bg-white text-[#8B1E2D]"
                  : event.is_host || event.my_status === "pending" || event.my_status === "waitlist"
                    ? "border-2 bg-white text-[#8B1E2D]"
                    : "text-white"
              }`}
              style={
                joinedLike || event.is_host || event.my_status === "pending" || event.my_status === "waitlist"
                  ? { borderColor: ACCENT }
                  : { backgroundColor: ACCENT }
              }
            >
              {joinBtnLabel}
            </button>
            <button
              type="button"
              onClick={() => setTab("schedule")}
              className="h-11 flex-1 max-w-[140px] rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800"
            >
              Schedule
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
            <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
              {error}
            </p>
          ) : null}

          {!event.is_host && !event.my_status && event.status !== "cancelled" ? (
            <label className="mt-3 block text-left">
              <span className="text-xs font-semibold text-slate-600">Catatan untuk host (opsional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Level saya intermediate…"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
              />
            </label>
          ) : null}
        </div>

        {/* Tab panels */}
        <div className="px-4 pt-5 pb-4">
          {tab === "profile" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white py-3 text-center">
                <div className="px-1">
                  <p className="text-[13px] font-bold text-slate-900">
                    {event.approved_count}/{event.capacity} Players
                  </p>
                </div>
                <div className="px-1">
                  <p className="text-[13px] font-bold text-slate-900">
                    {event.spots_left} Spots
                  </p>
                </div>
                <div className="flex items-center justify-center gap-0.5 px-1">
                  <span
                    className="material-symbols-outlined text-[16px] text-amber-400"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <p className="text-[13px] font-bold capitalize text-slate-900">
                    {event.status === "full" ? "Full" : event.status}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-[15px] font-bold text-slate-900">
                  {event.sport_name ? `${event.sport_name} ${event.title}` : event.title}
                </p>
                <ul className="mt-3 space-y-2 text-[13px] text-slate-600">
                  <li className="flex gap-2">
                    <span>🏠</span>
                    <span>
                      {event.place || "Lokasi menyusul"}
                      {event.city ? ` · ${event.city}` : ""}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span>🕐</span>
                    <span>{formatShortWhen(event.starts_at)}</span>
                  </li>
                  <li className="flex gap-2">
                    <span>👟</span>
                    <span>{skillLabel} · Host: {event.host_name || "—"}</span>
                  </li>
                  {event.fee_note ? (
                    <li className="flex gap-2">
                      <span>💸</span>
                      <span>{event.fee_note}</span>
                    </li>
                  ) : null}
                  {event.description ? (
                    <li className="flex gap-2">
                      <span>👋</span>
                      <span>{event.description}</span>
                    </li>
                  ) : null}
                </ul>
              </div>

              {event.is_host && event.status !== "cancelled" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancelEvent}
                  className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600"
                >
                  Batalkan Event
                </button>
              ) : null}
            </div>
          )}

          {tab === "schedule" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="inline-flex rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  Main Bareng
                </span>
                <p className="mt-2 text-[15px] font-bold leading-snug text-slate-900">{event.title}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-500">
                  <span className="material-symbols-outlined text-[16px]">sports_tennis</span>
                  {event.sport_name || event.sport_key} · {skillLabel}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
                  <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                  {formatWhen(event.starts_at)}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  <span className="truncate">
                    {event.place || "-"}
                    {event.city ? ` · ${event.city}` : ""}
                  </span>
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex -space-x-2">
                    {Array.from({ length: Math.min(6, event.capacity || 6) }).map((_, i) => (
                      <span
                        key={i}
                        className={`size-7 rounded-full border-2 border-white ${
                          i < (event.approved_count || 0)
                            ? "bg-slate-300"
                            : "border-dashed border-slate-300 bg-transparent"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[12px] font-semibold text-slate-500">
                    {event.approved_count}/{event.capacity}
                  </span>
                </div>
              </div>
              {chatState === "archived" ? (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                  Event ini sudah berlalu — chat diarsipkan.
                </p>
              ) : null}
            </div>
          )}

          {tab === "members" && (
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-[14px] font-bold text-slate-900">
                  Pemain ({data.participants?.length || 0})
                </h3>
                <div className="space-y-2">
                  {(data.participants || []).length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-slate-400">Belum ada pemain.</p>
                  ) : (
                    (data.participants || []).map((p) => (
                      <div
                        key={p.user_id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5"
                      >
                        <div
                          className="flex size-10 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: ACCENT }}
                        >
                          {(p.name || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800">{p.name}</p>
                          <p className="text-[11px] capitalize text-slate-500">
                            {String(p.user_id) === String(event.host_user_id) ? "host" : "player"}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-emerald-600">OK</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {event.is_host ? (
                <>
                  <div>
                    <h3 className="mb-2 text-[14px] font-bold text-slate-900">
                      Permintaan ({data.pending?.length || 0})
                    </h3>
                    {(data.pending || []).length === 0 ? (
                      <p className="text-[12px] text-slate-400">Tidak ada permintaan.</p>
                    ) : (
                      <div className="space-y-2">
                        {data.pending.map((p) => (
                          <div
                            key={p.user_id}
                            className="rounded-xl border border-slate-100 bg-white px-3 py-2.5"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-700">
                                {(p.name || "?").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{p.name}</p>
                                {p.note ? <p className="text-[11px] text-slate-500">{p.note}</p> : null}
                              </div>
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onDecide(p.user_id, "approved")}
                                className="flex-1 rounded-lg py-2 text-[12px] font-bold text-white disabled:opacity-60"
                                style={{ backgroundColor: ACCENT }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onDecide(p.user_id, "rejected")}
                                className="flex-1 rounded-lg border border-slate-200 py-2 text-[12px] font-bold text-slate-700"
                              >
                                Tolak
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 text-[14px] font-bold text-slate-900">
                      Waitlist ({data.waitlist?.length || 0})
                    </h3>
                    {(data.waitlist || []).length === 0 ? (
                      <p className="text-[12px] text-slate-400">Waitlist kosong.</p>
                    ) : (
                      <div className="space-y-2">
                        {data.waitlist.map((p) => (
                          <div
                            key={p.user_id}
                            className="rounded-xl border border-slate-100 bg-white px-3 py-2.5"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                {(p.name || "?").slice(0, 2).toUpperCase()}
                              </div>
                              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</p>
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                disabled={busy || event.spots_left <= 0}
                                onClick={() => onDecide(p.user_id, "approved")}
                                className="flex-1 rounded-lg py-2 text-[12px] font-bold text-white disabled:opacity-60"
                                style={{ backgroundColor: ACCENT }}
                              >
                                Naikkan
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onDecide(p.user_id, "rejected")}
                                className="flex-1 rounded-lg border border-slate-200 py-2 text-[12px] font-bold text-slate-700"
                              >
                                Tolak
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {tab === "chat" && (
            <div className="flex min-h-[420px] flex-col">
              {!canChat ? (
                <div className="px-4 py-14 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300">forum</span>
                  <p className="mt-3 text-sm font-bold text-slate-800">Join to chat</p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Request join dan tunggu di-approve host untuk ikut chat group.
                  </p>
                  {!event.is_host && !event.my_status ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onJoin}
                      className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Request Join
                    </button>
                  ) : null}
                  {event.my_status === "pending" || event.my_status === "waitlist" ? (
                    <p className="mt-3 text-[12px] font-semibold text-amber-700">
                      Status: {event.my_status} — menunggu host.
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-semibold text-slate-700">
                          Chat Group · {event.title}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {chatState === "archived"
                            ? "Arsip — event sudah berlalu"
                            : "Pesan group — refresh otomatis"}
                        </p>
                      </div>
                      {chatState === "archived" ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          <span className="material-symbols-outlined text-[13px]">archive</span>
                          Arsip
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="max-h-[320px] flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-slate-100 bg-[#f7f7f8] p-3">
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
                              className={`max-w-[82%] overflow-hidden rounded-2xl text-[13px] leading-snug ${
                                mine
                                  ? "rounded-br-md text-white"
                                  : "rounded-bl-md border border-slate-100 bg-white text-slate-800"
                              }`}
                              style={mine ? { backgroundColor: ACCENT } : undefined}
                            >
                              {m.image_url ? (
                                <img src={m.image_url} alt="" className="max-h-56 w-full object-cover" />
                              ) : null}
                              {m.body ? <p className="px-3 py-2">{m.body}</p> : null}
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
                  {chatError ? <p className="mt-1.5 text-[11px] text-red-500">{chatError}</p> : null}
                  {chatState !== "archived" ? (
                    <>
                      {chatImage ? (
                        <div className="relative mt-2 inline-block">
                          <img
                            src={chatImage}
                            alt=""
                            className="h-20 rounded-xl object-cover ring-1 ring-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => setChatImage("")}
                            className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-slate-800 text-white"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      ) : null}
                      <form className="mt-3 flex gap-2" onSubmit={onSendChat}>
                        <button
                          type="button"
                          onClick={() => chatFileRef.current?.click()}
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
                        >
                          <span className="material-symbols-outlined">image</span>
                        </button>
                        <input
                          ref={chatFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={onPickChatImage}
                        />
                        <input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Tulis pesan group…"
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8B1E2D]/40"
                        />
                        <button
                          type="submit"
                          disabled={chatSending || (!chatInput.trim() && !chatImage)}
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50"
                          style={{ backgroundColor: ACCENT }}
                        >
                          <span className="material-symbols-outlined">send</span>
                        </button>
                      </form>
                    </>
                  ) : (
                    <p className="mt-3 text-center text-[12px] text-slate-500">
                      Chat diarsipkan — hanya bisa dibaca.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "gallery" && (
            <div>
              {!canChat ? (
                <div className="py-14 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300">image</span>
                  <p className="mt-3 text-sm font-bold text-slate-800">Gallery pemain</p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Foto dari chat muncul di sini setelah kamu di-approve.
                  </p>
                </div>
              ) : galleryPhotos.length === 0 ? (
                <div className="py-14 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300">photo_library</span>
                  <p className="mt-3 text-sm text-slate-500">Belum ada foto. Share di Chat Group!</p>
                  <button
                    type="button"
                    onClick={() => setTab("chat")}
                    className="mt-3 text-[13px] font-semibold"
                    style={{ color: ACCENT }}
                  >
                    Buka Chat
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {galleryPhotos.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="overflow-hidden rounded-xl bg-slate-100"
                      onClick={() => setTab("chat")}
                    >
                      <img src={m.image_url} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom tabs ala komunitas */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
        <div className="flex items-stretch justify-around px-1">
          {BOTTOM_TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5"
              >
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    active ? "text-[#8B1E2D]" : "text-slate-400"
                  }`}
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {t.icon}
                </span>
                <span
                  className={`truncate text-[10px] font-semibold ${
                    active ? "text-[#8B1E2D]" : "text-slate-400"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </CommunityShell>
  );
}
