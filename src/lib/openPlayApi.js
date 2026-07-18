import { apiRequest, isApiBackendEnabled } from "./apiClient";

async function openPlayRequest(path, options) {
  if (!isApiBackendEnabled()) {
    const err = new Error("API belum dikonfigurasi (VITE_API_URL).");
    err.code = "API_DISABLED";
    throw err;
  }
  return apiRequest(path, options);
}

export const FALLBACK_OPEN_PLAY = {
  sports: [
    { sport_key: "badminton", name: "Badminton", icon: "sports_tennis", event_count: 2 },
    { sport_key: "futsal", name: "Futsal", icon: "sports_soccer", event_count: 1 },
    { sport_key: "tennis", name: "Tennis", icon: "sports_tennis", event_count: 0 },
    { sport_key: "padel", name: "Padel", icon: "sports_tennis", event_count: 0 },
    { sport_key: "basketball", name: "Basketball", icon: "sports_basketball", event_count: 0 },
    { sport_key: "running", name: "Running", icon: "directions_run", event_count: 0 },
  ],
  events: [
    {
      id: "demo-1",
      title: "Mabar Badminton Siang",
      sport_key: "badminton",
      sport_name: "Badminton",
      sport_icon: "sports_tennis",
      cover_url: "",
      starts_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
      place: "Lapangan A",
      city: "Jakarta",
      capacity: 8,
      approved_count: 3,
      pending_count: 1,
      waitlist_count: 0,
      spots_left: 5,
      skill_level: "all",
      fee_note: "Shuttle share",
      status: "open",
      my_status: null,
      is_host: false,
      host_name: "Demo Host",
    },
    {
      id: "demo-2",
      title: "Futsal Malam Receh",
      sport_key: "futsal",
      sport_name: "Futsal",
      sport_icon: "sports_soccer",
      cover_url: "",
      starts_at: new Date(Date.now() + 26 * 3600_000).toISOString(),
      place: "GOR Sentral",
      city: "Jakarta",
      capacity: 10,
      approved_count: 10,
      pending_count: 0,
      waitlist_count: 2,
      spots_left: 0,
      skill_level: "intermediate",
      fee_note: "Rp 35rb / orang",
      status: "full",
      my_status: null,
      is_host: false,
      host_name: "Coach Budi",
    },
  ],
};

export function fetchOpenPlayHub(params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.sport) q.set("sport", params.sport);
  if (params.city) q.set("city", params.city);
  const qs = q.toString();
  return openPlayRequest(`/open-play/hub${qs ? `?${qs}` : ""}`);
}

export function fetchMyOpenPlays() {
  return openPlayRequest("/open-play/mine");
}

export function fetchOpenPlayDetail(id) {
  return openPlayRequest(`/open-play/${id}`);
}

export function createOpenPlay(body) {
  return openPlayRequest("/open-play", { method: "POST", json: body });
}

export function updateOpenPlay(id, body) {
  return openPlayRequest(`/open-play/${id}`, { method: "PATCH", json: body });
}

export function joinOpenPlay(id, body = {}) {
  return openPlayRequest(`/open-play/${id}/join`, { method: "POST", json: body });
}

export function leaveOpenPlay(id) {
  return openPlayRequest(`/open-play/${id}/join`, { method: "DELETE" });
}

export function fetchOpenPlayChat(eventId, afterId) {
  const qs = afterId ? `?after=${encodeURIComponent(afterId)}` : "";
  return openPlayRequest(`/open-play/${eventId}/chat/messages${qs}`);
}

export function sendOpenPlayChat(eventId, body) {
  return openPlayRequest(`/open-play/${eventId}/chat/messages`, {
    method: "POST",
    json: body,
  });
}

export function decideOpenPlayParticipant(eventId, userId, decision) {
  return openPlayRequest(`/open-play/${eventId}/participants/${userId}/decide`, {
    method: "POST",
    json: { decision },
  });
}
