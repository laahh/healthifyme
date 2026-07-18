import { NotFoundError, ValidationError, ForbiddenError } from "../domain/errors/AppError.js";
import * as repo from "../repositories/community.repository.js";

export async function getHub(userId, query = {}) {
  const [sports, total, popular, results] = await Promise.all([
    repo.listSportsWithCounts(),
    repo.countCommunities(),
    repo.listCommunities({ popular: true, limit: 12 }),
    repo.listCommunities({
      q: query.q,
      sport: query.sport,
      limit: query.limit ? Number(query.limit) : 30,
    }),
  ]);
  return {
    total_communities: total,
    sports,
    popular,
    communities: results,
  };
}

export async function getSports() {
  return repo.listSportsWithCounts();
}

export async function getMine(userId) {
  return repo.listMyCommunities(userId);
}

export async function getDetail(userId, communityId) {
  const community = await repo.findCommunityById(communityId, userId);
  if (!community) throw new NotFoundError("Komunitas tidak ditemukan.");
  const members = await repo.listMembers(communityId);
  return { community, members };
}

export async function create(userId, body) {
  if (!String(body?.name || "").trim()) throw new ValidationError("Nama komunitas wajib.");
  let sportKey = String(body?.sport_key || "").trim();
  const sportCustom = String(body?.sport_custom || "").trim();
  const isOther = !sportKey || sportKey === "__other__" || sportKey === "other";
  if (isOther) {
    if (!sportCustom) throw new ValidationError("Isi nama olahraga / aktivitas manual.");
    try {
      sportKey = await repo.ensureSportByName(sportCustom);
    } catch {
      throw new ValidationError("Nama olahraga tidak valid.");
    }
  }
  if (!sportKey) throw new ValidationError("Olahraga wajib dipilih.");
  return repo.createCommunity(userId, { ...body, sport_key: sportKey });
}

export async function update(userId, communityId, body) {
  const community = await repo.findCommunityById(communityId, userId);
  if (!community) throw new NotFoundError("Komunitas tidak ditemukan.");
  if (community.my_role !== "owner" && community.my_role !== "admin") {
    throw new ForbiddenError("Hanya owner/admin yang bisa mengubah komunitas.");
  }
  const updated = await repo.updateCommunity(communityId, userId, body || {});
  if (!updated) throw new ForbiddenError("Tidak bisa mengubah komunitas.");
  return updated;
}

export async function join(userId, communityId) {
  const community = await repo.findCommunityById(communityId, userId);
  if (!community) throw new NotFoundError("Komunitas tidak ditemukan.");
  const wasMember = Boolean(community.is_member);
  const updated = await repo.joinCommunity(communityId, userId);
  if (!wasMember) {
    await repo.awardBadgeByCode(userId, "first_join");
  }
  return updated;
}

export async function leave(userId, communityId) {
  const community = await repo.findCommunityById(communityId, userId);
  if (!community) throw new NotFoundError("Komunitas tidak ditemukan.");
  if (community.my_role === "owner") {
    throw new ForbiddenError("Owner tidak bisa keluar. Transfer ownership dulu.");
  }
  await repo.leaveCommunity(communityId, userId);
  return { ok: true };
}

export async function listEvents(userId, { communityId, eventType } = {}) {
  return repo.listEvents({ communityId, eventType, userId });
}

export async function getEvent(userId, eventId) {
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  return event;
}

export async function createEvent(userId, communityId, body) {
  if (!String(body?.title || "").trim()) throw new ValidationError("Judul event wajib.");
  if (!body?.starts_at) throw new ValidationError("Waktu mulai wajib.");
  const startsDate = new Date(body.starts_at);
  if (Number.isNaN(startsDate.getTime())) {
    throw new ValidationError("Waktu mulai tidak valid.");
  }
  let sportKey = String(body?.sport_key || "").trim();
  const sportCustom = String(body?.sport_custom || "").trim();
  const isOther = !sportKey || sportKey === "__other__" || sportKey === "other";
  if (isOther) {
    if (!sportCustom) throw new ValidationError("Isi nama olahraga / aktivitas manual.");
    try {
      sportKey = await repo.ensureSportByName(sportCustom);
    } catch {
      throw new ValidationError("Nama olahraga tidak valid.");
    }
  }
  if (!sportKey) throw new ValidationError("Olahraga / aktivitas wajib dipilih.");
  if (communityId) {
    const community = await repo.findCommunityById(communityId, userId);
    if (!community?.is_member) throw new ForbiddenError("Gabung komunitas dulu untuk buat event.");
  }
  const event = await repo.createEvent(userId, communityId || null, {
    ...body,
    sport_key: sportKey,
    starts_at: startsDate.toISOString(),
  });
  if (communityId) {
    try {
      await repo.upsertPlayerStats(userId, communityId, { level_points: 5 });
    } catch {
      /* jangan gagalkan create event jika stats gagal */
    }
  }
  return event;
}

export async function rsvp(userId, eventId, joinFlag) {
  const event = await repo.findEventById(eventId, userId);
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  const wasJoined = Boolean(event.joined);
  const updated = await repo.setEventRsvp(eventId, userId, joinFlag);
  if (joinFlag && !wasJoined && event.community_id) {
    await repo.upsertPlayerStats(userId, event.community_id, {
      matches: 1,
      level_points: 10,
    });
  }
  return updated;
}

export async function listPosts(userId, communityId) {
  return repo.listPosts(communityId, userId);
}

export async function createPost(userId, communityId, body) {
  const community = await repo.findCommunityById(communityId, userId);
  if (!community?.is_member) throw new ForbiddenError("Gabung komunitas dulu untuk posting.");
  if (!String(body?.body || "").trim()) throw new ValidationError("Isi posting wajib.");
  const img = String(body?.image_url || "").trim();
  if (img && !/^(https?:\/\/|data:image\/)/i.test(img)) {
    throw new ValidationError("Gambar harus URL http(s) atau file foto yang di-upload.");
  }
  const post = await repo.createPost(communityId, userId, {
    ...body,
    image_url: img || null,
    sport_key: body?.sport_key || community.sport_key,
  });
  await repo.upsertPlayerStats(userId, communityId, { level_points: 2 });
  return post;
}

export async function toggleLike(userId, postId) {
  const post = await repo.togglePostLike(postId, userId);
  if (!post) throw new NotFoundError("Postingan tidak ditemukan.");
  return post;
}

export async function comment(userId, postId, body, parentId = null) {
  if (!String(body || "").trim()) throw new ValidationError("Komentar kosong.");
  const communityId = await repo.getPostCommunityId(postId);
  if (!communityId) throw new NotFoundError("Postingan tidak ditemukan.");
  const community = await repo.findCommunityById(communityId, userId);
  if (!community?.is_member) throw new ForbiddenError("Gabung komunitas dulu untuk berkomentar.");
  let parent = null;
  if (parentId != null && String(parentId).trim()) {
    const parentComment = await repo.findCommentById(parentId);
    if (!parentComment || parentComment.post_id !== String(postId)) {
      throw new ValidationError("Komentar yang dibalas tidak ditemukan.");
    }
    parent = parentComment.parent_id || parentComment.id;
  }
  return repo.addPostComment(postId, userId, body, parent);
}

export async function listComments(postId) {
  return repo.listPostComments(postId);
}

export async function listChat(userId, communityId, afterId) {
  const community = await repo.findCommunityById(communityId, userId);
  if (!community?.is_member) throw new ForbiddenError("Gabung komunitas dulu untuk chat.");
  return repo.listChatMessages(communityId, afterId);
}

export async function sendChat(userId, communityId, body) {
  const community = await repo.findCommunityById(communityId, userId);
  if (!community?.is_member) throw new ForbiddenError("Gabung komunitas dulu untuk chat.");
  if (!String(body || "").trim()) throw new ValidationError("Pesan kosong.");
  return repo.sendChatMessage(communityId, userId, body);
}

export async function listSparring() {
  return repo.listSparring();
}

export async function createSparring(userId, body) {
  if (!String(body?.sport_key || "").trim()) throw new ValidationError("Olahraga wajib.");
  if (!body?.proposed_at) throw new ValidationError("Jadwal wajib.");
  return repo.createSparring(userId, body);
}

export async function patchSparring(id, body) {
  const updated = await repo.updateSparring(id, body || {});
  if (!updated) throw new NotFoundError("Sparring tidak ditemukan.");
  return updated;
}

export async function listCoaching(userId) {
  return repo.listEvents({ eventType: "coaching", userId });
}

export async function listCompetitions() {
  return repo.listCompetitions();
}

export async function competitionStandings(id) {
  return repo.getCompetitionStandings(id);
}

export async function leaderboard() {
  return repo.listLeaderboard(30);
}

export async function leaderboardForCommunity(communityId) {
  const community = await repo.findCommunityById(communityId, null);
  if (!community) throw new NotFoundError("Komunitas tidak ditemukan.");
  return repo.listLeaderboard(30, communityId);
}

export async function myBadges(userId) {
  const [mine, all] = await Promise.all([repo.listMyBadges(userId), repo.listAllBadges()]);
  return { badges: mine, catalog: all };
}
