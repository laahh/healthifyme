import { apiRequest, isApiBackendEnabled } from "./apiClient";

async function communityRequest(path, options) {
  if (!isApiBackendEnabled()) {
    const err = new Error("API belum dikonfigurasi (VITE_API_URL).");
    err.code = "API_DISABLED";
    throw err;
  }
  return apiRequest(path, options);
}

export function fetchCommunityHub(params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.sport) q.set("sport", params.sport);
  const qs = q.toString();
  return communityRequest(`/community/hub${qs ? `?${qs}` : ""}`);
}

export function fetchCommunitySports() {
  return communityRequest("/community/sports");
}

export function fetchMyCommunities() {
  return communityRequest("/community/mine");
}

export function fetchCommunityDetail(id) {
  return communityRequest(`/community/${id}`);
}

export function createCommunity(body) {
  return communityRequest("/community", { method: "POST", json: body });
}

export function updateCommunity(communityId, body) {
  return communityRequest(`/community/${communityId}`, { method: "PATCH", json: body });
}

export function joinCommunity(id) {
  return communityRequest(`/community/${id}/join`, { method: "POST", json: {} });
}

export function leaveCommunity(id) {
  return communityRequest(`/community/${id}/leave`, { method: "DELETE" });
}

export function fetchCommunityEvents(communityId, type) {
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  return communityRequest(`/community/${communityId}/events${qs}`);
}

export function fetchCommunityLeaderboard(communityId) {
  return communityRequest(`/community/${communityId}/leaderboard`);
}

export function createCommunityEvent(communityId, body) {
  return communityRequest(`/community/${communityId}/events`, { method: "POST", json: body });
}

export function fetchEvent(eventId) {
  return communityRequest(`/community/events/${eventId}`);
}

export function rsvpEvent(eventId, join = true) {
  return communityRequest(`/community/events/${eventId}/rsvp`, { method: "POST", json: { join } });
}

export function fetchPosts(communityId) {
  return communityRequest(`/community/${communityId}/posts`);
}

export function createPost(communityId, body) {
  return communityRequest(`/community/${communityId}/posts`, { method: "POST", json: body });
}

export function togglePostLike(postId) {
  return communityRequest(`/community/posts/${postId}/like`, { method: "POST", json: {} });
}

export function fetchComments(postId) {
  return communityRequest(`/community/posts/${postId}/comments`);
}

export function addComment(postId, body, parentId = null) {
  return communityRequest(`/community/posts/${postId}/comments`, {
    method: "POST",
    json: parentId != null ? { body, parent_id: parentId } : { body },
  });
}

export function fetchChatMessages(communityId, after) {
  const qs = after ? `?after=${encodeURIComponent(after)}` : "";
  return communityRequest(`/community/${communityId}/chat/messages${qs}`);
}

export function sendChatMessage(communityId, body) {
  return communityRequest(`/community/${communityId}/chat/messages`, { method: "POST", json: { body } });
}

export function fetchSparring() {
  return communityRequest("/community/sparring");
}

export function createSparring(body) {
  return communityRequest("/community/sparring", { method: "POST", json: body });
}

export function patchSparring(id, body) {
  return communityRequest(`/community/sparring/${id}`, { method: "PATCH", json: body });
}

export function fetchCoaching() {
  return communityRequest("/community/coaching");
}

export function fetchCompetitions() {
  return communityRequest("/community/competitions");
}

export function fetchCompetitionStandings(id) {
  return communityRequest(`/community/competitions/${id}/standings`);
}

export function fetchLeaderboard() {
  return communityRequest("/community/leaderboard");
}

export function fetchMyBadges() {
  return communityRequest("/community/badges/me");
}

/** Seed fallback UI when API/tables belum ready */
export const FALLBACK_HUB = {
  total_communities: 38300,
  sports: [
    { sport_key: "padel", name: "Padel", icon: "sports_tennis", community_count: 10900 },
    { sport_key: "tennis", name: "Tennis", icon: "sports_tennis", community_count: 8500 },
    { sport_key: "badminton", name: "Badminton", icon: "sports_tennis", community_count: 7200 },
    { sport_key: "mini_soccer", name: "Mini Soccer", icon: "sports_soccer", community_count: 6100 },
    { sport_key: "sepak_bola", name: "Sepak Bola", icon: "sports_soccer", community_count: 5400 },
    { sport_key: "basketball", name: "Basketball", icon: "sports_basketball", community_count: 3200 },
    { sport_key: "futsal", name: "Futsal", icon: "sports_soccer", community_count: 4100 },
    { sport_key: "running", name: "Running", icon: "directions_run", community_count: 2800 },
  ],
  popular: [
    {
      id: "demo-1",
      name: "Tennis BSD Santuy",
      sport_key: "tennis",
      sport_name: "Tennis",
      member_count: 465,
      city: "Kota Tangerang Selatan",
      banner_url: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop&q=80",
      logo_url: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=200&auto=format&fit=crop&q=80",
    },
    {
      id: "demo-2",
      name: "Futsal Jakarta Night",
      sport_key: "futsal",
      sport_name: "Futsal",
      member_count: 312,
      city: "Jakarta Selatan",
      banner_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80",
      logo_url: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=200&auto=format&fit=crop&q=80",
    },
    {
      id: "demo-3",
      name: "Badminton Weekend Club",
      sport_key: "badminton",
      sport_name: "Badminton",
      member_count: 228,
      city: "Bekasi",
      banner_url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
      logo_url: "",
    },
  ],
  communities: [],
};
