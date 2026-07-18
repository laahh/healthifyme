import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

function mapSport(row) {
  if (!row) return null;
  return {
    sport_key: row.sport_key,
    name: row.name,
    icon: row.icon,
    sort_order: Number(row.sort_order) || 0,
    community_count: Number(row.community_count) || 0,
  };
}

function mapCommunity(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    sport_key: row.sport_key,
    sport_name: row.sport_name || null,
    description: row.description || "",
    banner_url: row.banner_url || "",
    logo_url: row.logo_url || "",
    city: row.city || "",
    company: row.company || "",
    created_by_user_id: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    member_count: Number(row.member_count) || 0,
    is_public: Boolean(row.is_public),
    is_popular: Boolean(row.is_popular),
    my_role: row.my_role || null,
    is_member: Boolean(row.is_member),
    created_at: row.created_at,
  };
}

function mapEvent(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    community_id: row.community_id != null ? String(row.community_id) : null,
    community_name: row.community_name || null,
    event_type: row.event_type,
    title: row.title,
    sport_key: row.sport_key,
    sport_name: row.sport_name || null,
    starts_at: row.starts_at,
    place: row.place || "",
    capacity: Number(row.capacity) || 0,
    fee_note: row.fee_note || "",
    status: row.status,
    rsvp_count: Number(row.rsvp_count) || 0,
    joined: Boolean(row.joined),
    created_by_user_id: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
  };
}

export async function listSportsWithCounts() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT s.sport_key, s.name, s.icon, s.sort_order,
            COUNT(c.id) AS community_count
     FROM community_sports s
     LEFT JOIN communities c ON c.sport_key = s.sport_key AND c.is_public = 1
     WHERE s.is_active = 1
     GROUP BY s.sport_key, s.name, s.icon, s.sort_order
     ORDER BY s.sort_order ASC`
  );
  return (Array.isArray(rows) ? rows : []).map(mapSport);
}

/**
 * Pastikan sport ada di community_sports (untuk input manual).
 * @param {string} name
 * @returns {Promise<string>} sport_key
 */
export async function ensureSportByName(name) {
  const label = String(name || "").trim().slice(0, 128);
  if (!label) throw new Error("Sport name empty");
  let key = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
  if (!key) key = `custom_${Date.now().toString(36)}`;
  if (key === "other" || key === "__other__") {
    key = `custom_${Date.now().toString(36)}`;
  }
  const pool = getPool();
  const [existing] = await pool.execute(
    `SELECT sport_key FROM community_sports WHERE sport_key = :key OR LOWER(name) = LOWER(:name) LIMIT 1`,
    { key, name: label }
  );
  if (Array.isArray(existing) && existing[0]?.sport_key) {
    return String(existing[0].sport_key);
  }
  // Hindari bentrok key
  const [byKey] = await pool.execute(
    `SELECT sport_key FROM community_sports WHERE sport_key = :key LIMIT 1`,
    { key }
  );
  if (Array.isArray(byKey) && byKey[0]) {
    key = `${key}_${Date.now().toString(36).slice(-4)}`.slice(0, 64);
  }
  await pool.execute(
    `INSERT INTO community_sports (sport_key, name, icon, sort_order, is_active)
     VALUES (:key, :name, 'sports', 900, 1)`,
    { key, name: label }
  );
  return key;
}

export async function countCommunities() {
  const pool = getPool();
  const [rows] = await pool.execute(`SELECT COUNT(*) AS cnt FROM communities WHERE is_public = 1`);
  return Number(rows?.[0]?.cnt) || 0;
}

/**
 * @param {{ q?: string, sport?: string, popular?: boolean, limit?: number }} opts
 */
export async function listCommunities(opts = {}) {
  const pool = getPool();
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 30));
  const params = { lim: limit };
  let where = `c.is_public = 1`;
  if (opts.sport) {
    where += ` AND c.sport_key = :sport`;
    params.sport = String(opts.sport);
  }
  if (opts.q) {
    where += ` AND (c.name LIKE :q OR c.city LIKE :q OR c.description LIKE :q)`;
    params.q = `%${String(opts.q).trim()}%`;
  }
  if (opts.popular) {
    where += ` AND c.is_popular = 1`;
  }
  const [rows] = await pool.execute(
    `SELECT c.*, s.name AS sport_name
     FROM communities c
     JOIN community_sports s ON s.sport_key = c.sport_key
     WHERE ${where}
     ORDER BY c.is_popular DESC, c.member_count DESC, c.id DESC
     LIMIT ${limit}`,
    params
  );
  return (Array.isArray(rows) ? rows : []).map(mapCommunity);
}

export async function listMyCommunities(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT c.*, s.name AS sport_name, m.role AS my_role, 1 AS is_member
     FROM community_members m
     JOIN communities c ON c.id = m.community_id
     JOIN community_sports s ON s.sport_key = c.sport_key
     WHERE m.user_id = :uid
     ORDER BY m.joined_at DESC`,
    { uid }
  );
  return (Array.isArray(rows) ? rows : []).map(mapCommunity);
}

export async function findCommunityById(communityId, userId = null) {
  const cid = parseBigIntId(communityId);
  if (cid == null) return null;
  const pool = getPool();
  const uid = userId != null ? parseBigIntId(userId) : null;
  const [rows] = await pool.execute(
    `SELECT c.*, s.name AS sport_name,
            m.role AS my_role,
            CASE WHEN m.user_id IS NULL THEN 0 ELSE 1 END AS is_member
     FROM communities c
     JOIN community_sports s ON s.sport_key = c.sport_key
     LEFT JOIN community_members m ON m.community_id = c.id AND m.user_id = :uid
     WHERE c.id = :cid
     LIMIT 1`,
    { cid, uid: uid ?? 0 }
  );
  return mapCommunity(Array.isArray(rows) && rows[0] ? rows[0] : null);
}

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180) || `community-${Date.now()}`;
}

export async function createCommunity(userId, body) {
  const uid = parseBigIntId(userId);
  if (uid == null) throw new Error("Invalid user");
  const pool = getPool();
  const name = String(body.name || "").trim();
  const sportKey = String(body.sport_key || "").trim();
  let slug = slugify(body.slug || name);
  const [existing] = await pool.execute(`SELECT id FROM communities WHERE slug = :slug LIMIT 1`, { slug });
  if (Array.isArray(existing) && existing[0]) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO communities
       (name, slug, sport_key, description, banner_url, logo_url, city, company, created_by_user_id, member_count, is_public)
       VALUES (:name, :slug, :sport, :desc, :banner, :logo, :city, :company, :uid, 1, 1)`,
      {
        name,
        slug,
        sport: sportKey,
        desc: String(body.description || "").trim() || null,
        banner: String(body.banner_url || "").trim() || null,
        logo: String(body.logo_url || "").trim() || null,
        city: String(body.city || "").trim() || null,
        company: String(body.company || "").trim() || null,
        uid,
      }
    );
    const id = result.insertId;
    await conn.execute(
      `INSERT INTO community_members (community_id, user_id, role) VALUES (:cid, :uid, 'owner')`,
      { cid: id, uid }
    );
    await conn.execute(`INSERT INTO community_chat_rooms (community_id) VALUES (:cid)`, { cid: id });
    await conn.commit();
    return findCommunityById(id, userId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateCommunity(communityId, userId, body) {
  const cid = parseBigIntId(communityId);
  const uid = parseBigIntId(userId);
  if (cid == null || uid == null) return null;
  const pool = getPool();
  const [roleRows] = await pool.execute(
    `SELECT role FROM community_members WHERE community_id = :cid AND user_id = :uid LIMIT 1`,
    { cid, uid }
  );
  const role = String(roleRows?.[0]?.role || "").toLowerCase();
  if (role !== "owner" && role !== "admin") return null;

  const sets = [];
  const params = { cid };
  const allow = ["name", "description", "banner_url", "logo_url", "city", "company"];
  for (const key of allow) {
    if (body[key] === undefined) continue;
    const col = key;
    sets.push(`${col} = :${key}`);
    const val = body[key];
    params[key] = val == null || val === "" ? null : String(val);
  }
  if (!sets.length) return findCommunityById(cid, userId);
  await pool.execute(`UPDATE communities SET ${sets.join(", ")} WHERE id = :cid`, params);
  return findCommunityById(cid, userId);
}

export async function joinCommunity(communityId, userId) {
  const cid = parseBigIntId(communityId);
  const uid = parseBigIntId(userId);
  if (cid == null || uid == null) return null;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT IGNORE INTO community_members (community_id, user_id, role) VALUES (:cid, :uid, 'member')`,
      { cid, uid }
    );
    await conn.execute(
      `UPDATE communities SET member_count = (
         SELECT COUNT(*) FROM community_members WHERE community_id = :cid
       ) WHERE id = :cid`,
      { cid }
    );
    await conn.commit();
    return findCommunityById(cid, userId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function leaveCommunity(communityId, userId) {
  const cid = parseBigIntId(communityId);
  const uid = parseBigIntId(userId);
  if (cid == null || uid == null) return;
  const pool = getPool();
  await pool.execute(`DELETE FROM community_members WHERE community_id = :cid AND user_id = :uid AND role <> 'owner'`, {
    cid,
    uid,
  });
  await pool.execute(
    `UPDATE communities SET member_count = (SELECT COUNT(*) FROM community_members WHERE community_id = :cid) WHERE id = :cid`,
    { cid }
  );
}

export async function listMembers(communityId) {
  const cid = parseBigIntId(communityId);
  if (cid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT m.user_id, m.role, m.joined_at, e.nama, e.kode_sid, e.foto, e.avatar_url, e.divisi
     FROM community_members m
     JOIN employee_profiles e ON e.id = m.user_id
     WHERE m.community_id = :cid
     ORDER BY FIELD(m.role, 'owner', 'admin', 'member'), m.joined_at ASC
     LIMIT 100`,
    { cid }
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    user_id: String(r.user_id),
    role: r.role,
    joined_at: r.joined_at,
    name: String(r.nama || r.kode_sid || "Pengguna"),
    sid: String(r.kode_sid || ""),
    photo_url: String(r.avatar_url || r.foto || "").trim() || "",
    division: String(r.divisi || "").trim() || "",
  }));
}

export async function listEvents({ communityId, eventType, userId, limit = 40 } = {}) {
  const pool = getPool();
  const lim = Math.min(100, Math.max(1, Number(limit) || 40));
  const params = {};
  let where = `1=1`;
  if (communityId) {
    where += ` AND e.community_id = :cid`;
    params.cid = parseBigIntId(communityId);
  }
  if (eventType) {
    where += ` AND e.event_type = :etype`;
    params.etype = String(eventType);
  }
  const uid = userId != null ? parseBigIntId(userId) : null;
  const [rows] = await pool.execute(
    `SELECT e.*, s.name AS sport_name, c.name AS community_name,
            (SELECT COUNT(*) FROM community_event_rsvps r WHERE r.event_id = e.id AND r.status = 'joined') AS rsvp_count,
            CASE WHEN EXISTS (
              SELECT 1 FROM community_event_rsvps r2
              WHERE r2.event_id = e.id AND r2.user_id = :uid AND r2.status = 'joined'
            ) THEN 1 ELSE 0 END AS joined
     FROM community_events e
     JOIN community_sports s ON s.sport_key = e.sport_key
     LEFT JOIN communities c ON c.id = e.community_id
     WHERE ${where}
     ORDER BY e.starts_at ASC
     LIMIT ${lim}`,
    { ...params, uid: uid ?? 0 }
  );
  return (Array.isArray(rows) ? rows : []).map(mapEvent);
}

export async function findEventById(eventId, userId = null) {
  const eid = parseBigIntId(eventId);
  if (eid == null) return null;
  const uid = userId != null ? parseBigIntId(userId) : null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT e.*, s.name AS sport_name, c.name AS community_name,
            (SELECT COUNT(*) FROM community_event_rsvps r WHERE r.event_id = e.id AND r.status = 'joined') AS rsvp_count,
            CASE WHEN EXISTS (
              SELECT 1 FROM community_event_rsvps r2
              WHERE r2.event_id = e.id AND r2.user_id = :uid AND r2.status = 'joined'
            ) THEN 1 ELSE 0 END AS joined
     FROM community_events e
     JOIN community_sports s ON s.sport_key = e.sport_key
     LEFT JOIN communities c ON c.id = e.community_id
     WHERE e.id = :eid
     LIMIT 1`,
    { eid, uid: uid ?? 0 }
  );
  return mapEvent(Array.isArray(rows) && rows[0] ? rows[0] : null);
}

export async function createEvent(userId, communityId, body) {
  const uid = parseBigIntId(userId);
  const cid = communityId != null ? parseBigIntId(communityId) : null;
  if (uid == null) throw new Error("Invalid user");
  const startsRaw = body.starts_at;
  const startsDate = startsRaw instanceof Date ? startsRaw : new Date(startsRaw);
  if (Number.isNaN(startsDate.getTime())) {
    throw new Error("Invalid starts_at");
  }
  /** MySQL DATETIME: 'YYYY-MM-DD HH:MM:SS' (bukan ISO dengan Z). */
  const starts = startsDate.toISOString().slice(0, 19).replace("T", " ");
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO community_events
     (community_id, event_type, title, sport_key, starts_at, place, capacity, fee_note, created_by_user_id, status)
     VALUES (:cid, :etype, :title, :sport, :starts, :place, :cap, :fee, :uid, 'open')`,
    {
      cid,
      etype: String(body.event_type || "open_play"),
      title: String(body.title || "").trim(),
      sport: String(body.sport_key || "").trim(),
      starts,
      place: String(body.place || "").trim() || null,
      cap: Number(body.capacity) || 20,
      fee: String(body.fee_note || "").trim() || null,
      uid,
    }
  );
  return findEventById(result.insertId, userId);
}

export async function setEventRsvp(eventId, userId, join = true) {
  const eid = parseBigIntId(eventId);
  const uid = parseBigIntId(userId);
  if (eid == null || uid == null) return null;
  const pool = getPool();
  if (join) {
    await pool.execute(
      `INSERT INTO community_event_rsvps (event_id, user_id, status)
       VALUES (:eid, :uid, 'joined')
       ON DUPLICATE KEY UPDATE status = 'joined'`,
      { eid, uid }
    );
  } else {
    await pool.execute(
      `UPDATE community_event_rsvps SET status = 'cancelled' WHERE event_id = :eid AND user_id = :uid`,
      { eid, uid }
    );
  }
  return findEventById(eid, userId);
}

export async function listPosts(communityId, userId) {
  const cid = parseBigIntId(communityId);
  if (cid == null) return [];
  const uid = parseBigIntId(userId) ?? 0;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT p.*, e.nama AS author_name, e.foto AS author_foto, e.avatar_url AS author_avatar,
            CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS liked_by_me
     FROM community_posts p
     JOIN employee_profiles e ON e.id = p.author_user_id
     LEFT JOIN community_post_likes l ON l.post_id = p.id AND l.user_id = :uid
     WHERE p.community_id = :cid
     ORDER BY p.created_at DESC
     LIMIT 50`,
    { cid, uid }
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    community_id: String(r.community_id),
    author_user_id: String(r.author_user_id),
    author_name: String(r.author_name || "Pengguna"),
    author_photo: String(r.author_avatar || r.author_foto || "").trim() || "",
    body: r.body,
    image_url: r.image_url || "",
    sport_key: r.sport_key || "",
    like_count: Number(r.like_count) || 0,
    comment_count: Number(r.comment_count) || 0,
    liked_by_me: Boolean(r.liked_by_me),
    created_at: r.created_at,
  }));
}

export async function createPost(communityId, userId, body) {
  const cid = parseBigIntId(communityId);
  const uid = parseBigIntId(userId);
  if (cid == null || uid == null) throw new Error("Invalid ids");
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO community_posts (community_id, author_user_id, body, image_url, sport_key)
     VALUES (:cid, :uid, :body, :img, :sport)`,
    {
      cid,
      uid,
      body: String(body.body || "").trim(),
      img: String(body.image_url || "").trim() || null,
      sport: String(body.sport_key || "").trim() || null,
    }
  );
  const posts = await listPosts(cid, userId);
  return posts.find((p) => p.id === String(result.insertId)) || null;
}

export async function togglePostLike(postId, userId) {
  const pid = parseBigIntId(postId);
  const uid = parseBigIntId(userId);
  if (pid == null || uid == null) return null;
  const pool = getPool();
  const [existing] = await pool.execute(
    `SELECT post_id FROM community_post_likes WHERE post_id = :pid AND user_id = :uid LIMIT 1`,
    { pid, uid }
  );
  if (Array.isArray(existing) && existing[0]) {
    await pool.execute(`DELETE FROM community_post_likes WHERE post_id = :pid AND user_id = :uid`, { pid, uid });
  } else {
    await pool.execute(`INSERT INTO community_post_likes (post_id, user_id) VALUES (:pid, :uid)`, { pid, uid });
  }
  await pool.execute(
    `UPDATE community_posts SET like_count = (SELECT COUNT(*) FROM community_post_likes WHERE post_id = :pid) WHERE id = :pid`,
    { pid }
  );
  const [rows] = await pool.execute(`SELECT community_id FROM community_posts WHERE id = :pid LIMIT 1`, { pid });
  const communityId = rows?.[0]?.community_id;
  if (!communityId) return null;
  const posts = await listPosts(communityId, userId);
  return posts.find((p) => p.id === String(pid)) || null;
}

export async function getPostCommunityId(postId) {
  const pid = parseBigIntId(postId);
  if (pid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(`SELECT community_id FROM community_posts WHERE id = :pid LIMIT 1`, { pid });
  return rows?.[0]?.community_id != null ? String(rows[0].community_id) : null;
}

export async function findCommentById(commentId) {
  const cid = parseBigIntId(commentId);
  if (cid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, post_id, parent_id FROM community_post_comments WHERE id = :cid LIMIT 1`,
    { cid }
  );
  const r = rows?.[0];
  if (!r) return null;
  return {
    id: String(r.id),
    post_id: String(r.post_id),
    parent_id: r.parent_id != null ? String(r.parent_id) : null,
  };
}

export async function addPostComment(postId, userId, body, parentId = null) {
  const pid = parseBigIntId(postId);
  const uid = parseBigIntId(userId);
  if (pid == null || uid == null) throw new Error("Invalid ids");
  const parent = parentId != null ? parseBigIntId(parentId) : null;
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO community_post_comments (post_id, parent_id, user_id, body)
     VALUES (:pid, :parent, :uid, :body)`,
    { pid, parent, uid, body: String(body || "").trim() }
  );
  await pool.execute(
    `UPDATE community_posts SET comment_count = (SELECT COUNT(*) FROM community_post_comments WHERE post_id = :pid) WHERE id = :pid`,
    { pid }
  );
  const comments = await listPostComments(pid);
  return comments.find((c) => c.id === String(result.insertId)) || {
    id: String(result.insertId),
    post_id: String(pid),
    parent_id: parent != null ? String(parent) : null,
    user_id: String(uid),
    body: String(body || "").trim(),
  };
}

export async function listPostComments(postId) {
  const pid = parseBigIntId(postId);
  if (pid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT c.*, e.nama AS author_name, e.foto AS author_foto, e.avatar_url AS author_avatar
     FROM community_post_comments c
     JOIN employee_profiles e ON e.id = c.user_id
     WHERE c.post_id = :pid
     ORDER BY c.created_at ASC
     LIMIT 300`,
    { pid }
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    post_id: String(r.post_id),
    parent_id: r.parent_id != null ? String(r.parent_id) : null,
    user_id: String(r.user_id),
    author_name: String(r.author_name || "Pengguna"),
    author_photo: String(r.author_avatar || r.author_foto || "").trim() || "",
    body: r.body,
    created_at: r.created_at,
  }));
}

export async function ensureChatRoom(communityId) {
  const cid = parseBigIntId(communityId);
  if (cid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(`SELECT id FROM community_chat_rooms WHERE community_id = :cid LIMIT 1`, { cid });
  if (Array.isArray(rows) && rows[0]) return String(rows[0].id);
  const [result] = await pool.execute(`INSERT INTO community_chat_rooms (community_id) VALUES (:cid)`, { cid });
  return String(result.insertId);
}

export async function listChatMessages(communityId, afterId = null) {
  const roomId = await ensureChatRoom(communityId);
  if (!roomId) return [];
  const rid = parseBigIntId(roomId);
  const pool = getPool();
  const params = { rid };
  let where = `m.room_id = :rid`;
  if (afterId) {
    where += ` AND m.id > :aid`;
    params.aid = parseBigIntId(afterId);
  }
  const [rows] = await pool.execute(
    `SELECT m.*, e.nama AS sender_name
     FROM community_chat_messages m
     JOIN employee_profiles e ON e.id = m.sender_user_id
     WHERE ${where}
     ORDER BY m.created_at ASC
     LIMIT 100`,
    params
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    room_id: String(r.room_id),
    sender_user_id: String(r.sender_user_id),
    sender_name: String(r.sender_name || "Pengguna"),
    body: r.body,
    created_at: r.created_at,
  }));
}

export async function sendChatMessage(communityId, userId, body) {
  const roomId = await ensureChatRoom(communityId);
  const rid = parseBigIntId(roomId);
  const uid = parseBigIntId(userId);
  if (rid == null || uid == null) throw new Error("Invalid ids");
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO community_chat_messages (room_id, sender_user_id, body) VALUES (:rid, :uid, :body)`,
    { rid, uid, body: String(body || "").trim() }
  );
  const msgs = await listChatMessages(communityId);
  return msgs.find((m) => m.id === String(result.insertId)) || null;
}

export async function listSparring() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT sp.*, s.name AS sport_name,
            fc.name AS from_name, tc.name AS to_name
     FROM community_sparring_requests sp
     JOIN community_sports s ON s.sport_key = sp.sport_key
     LEFT JOIN communities fc ON fc.id = sp.from_community_id
     LEFT JOIN communities tc ON tc.id = sp.to_community_id
     ORDER BY sp.proposed_at DESC
     LIMIT 50`
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    from_community_id: r.from_community_id != null ? String(r.from_community_id) : null,
    to_community_id: r.to_community_id != null ? String(r.to_community_id) : null,
    from_name: r.from_name || null,
    to_name: r.to_name || null,
    sport_key: r.sport_key,
    sport_name: r.sport_name,
    proposed_at: r.proposed_at,
    place: r.place || "",
    status: r.status,
    score_home: r.score_home,
    score_away: r.score_away,
  }));
}

export async function createSparring(userId, body) {
  const uid = parseBigIntId(userId);
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO community_sparring_requests
     (from_community_id, to_community_id, sport_key, proposed_at, place, status, created_by_user_id)
     VALUES (:fromId, :toId, :sport, :proposed, :place, 'pending', :uid)`,
    {
      fromId: body.from_community_id ? parseBigIntId(body.from_community_id) : null,
      toId: body.to_community_id ? parseBigIntId(body.to_community_id) : null,
      sport: String(body.sport_key || "").trim(),
      proposed: body.proposed_at,
      place: String(body.place || "").trim() || null,
      uid,
    }
  );
  const list = await listSparring();
  return list.find((s) => s.id === String(result.insertId)) || null;
}

export async function updateSparring(id, patch) {
  const sid = parseBigIntId(id);
  if (sid == null) return null;
  const pool = getPool();
  const fields = [];
  const params = { sid };
  if (patch.status != null) {
    fields.push(`status = :status`);
    params.status = String(patch.status);
  }
  if (patch.score_home != null) {
    fields.push(`score_home = :sh`);
    params.sh = Number(patch.score_home);
  }
  if (patch.score_away != null) {
    fields.push(`score_away = :sa`);
    params.sa = Number(patch.score_away);
  }
  if (!fields.length) return null;
  await pool.execute(`UPDATE community_sparring_requests SET ${fields.join(", ")} WHERE id = :sid`, params);
  const list = await listSparring();
  return list.find((s) => s.id === String(sid)) || null;
}

export async function listCompetitions() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT c.*, s.name AS sport_name FROM community_competitions c
     JOIN community_sports s ON s.sport_key = c.sport_key
     ORDER BY c.starts_at ASC`
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    name: r.name,
    sport_key: r.sport_key,
    sport_name: r.sport_name,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    status: r.status,
  }));
}

export async function getCompetitionStandings(competitionId) {
  const cid = parseBigIntId(competitionId);
  if (cid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT e.*, co.name AS community_name, ep.nama AS user_name
     FROM community_competition_entries e
     LEFT JOIN communities co ON co.id = e.community_id
     LEFT JOIN employee_profiles ep ON ep.id = e.user_id
     WHERE e.competition_id = :cid
     ORDER BY e.points DESC, e.rank_no ASC`,
    { cid }
  );
  return (Array.isArray(rows) ? rows : []).map((r, i) => ({
    id: String(r.id),
    community_id: r.community_id != null ? String(r.community_id) : null,
    community_name: r.community_name || null,
    user_id: r.user_id != null ? String(r.user_id) : null,
    user_name: r.user_name || null,
    points: Number(r.points) || 0,
    rank_no: r.rank_no != null ? Number(r.rank_no) : i + 1,
  }));
}

export async function listLeaderboard(limit = 20, communityId = null) {
  const lim = Math.min(50, Math.max(1, Number(limit) || 20));
  const pool = getPool();
  const cid = communityId != null ? parseBigIntId(communityId) : null;
  const where = cid != null ? "WHERE ps.community_id = :cid" : "";
  const [rows] = await pool.execute(
    `SELECT ps.*, e.nama AS user_name, c.name AS community_name
     FROM community_player_stats ps
     JOIN employee_profiles e ON e.id = ps.user_id
     LEFT JOIN communities c ON c.id = ps.community_id
     ${where}
     ORDER BY ps.level_points DESC, ps.wins DESC
     LIMIT ${lim}`,
    cid != null ? { cid } : {}
  );
  return (Array.isArray(rows) ? rows : []).map((r, i) => ({
    rank: i + 1,
    user_id: String(r.user_id),
    user_name: String(r.user_name || "Pengguna"),
    community_id: r.community_id != null ? String(r.community_id) : null,
    community_name: r.community_name || null,
    matches: Number(r.matches) || 0,
    wins: Number(r.wins) || 0,
    goals: Number(r.goals) || 0,
    assists: Number(r.assists) || 0,
    level_points: Number(r.level_points) || 0,
  }));
}

/**
 * Upsert community_player_stats with deltas.
 * @param {string|number} userId
 * @param {string|number|null} communityId
 * @param {{ matches?: number, wins?: number, goals?: number, assists?: number, level_points?: number }} delta
 */
export async function upsertPlayerStats(userId, communityId, delta = {}) {
  const uid = parseBigIntId(userId);
  const cid = communityId != null ? parseBigIntId(communityId) : null;
  if (uid == null || cid == null) return;
  const matches = Number(delta.matches) || 0;
  const wins = Number(delta.wins) || 0;
  const goals = Number(delta.goals) || 0;
  const assists = Number(delta.assists) || 0;
  const levelPoints = Number(delta.level_points) || 0;
  const pool = getPool();
  await pool.execute(
    `INSERT INTO community_player_stats
       (user_id, community_id, matches, wins, goals, assists, level_points)
     VALUES (:uid, :cid, :matches, :wins, :goals, :assists, :points)
     ON DUPLICATE KEY UPDATE
       matches = matches + VALUES(matches),
       wins = wins + VALUES(wins),
       goals = goals + VALUES(goals),
       assists = assists + VALUES(assists),
       level_points = level_points + VALUES(level_points)`,
    {
      uid,
      cid,
      matches,
      wins,
      goals,
      assists,
      points: levelPoints,
    }
  );
}

export async function awardBadgeByCode(userId, badgeCode) {
  const uid = parseBigIntId(userId);
  if (uid == null || !badgeCode) return;
  const pool = getPool();
  const [badges] = await pool.execute(
    `SELECT id FROM community_badges WHERE code = :code LIMIT 1`,
    { code: String(badgeCode) }
  );
  const badgeId = Array.isArray(badges) && badges[0]?.id != null ? Number(badges[0].id) : null;
  if (badgeId == null) return;
  await pool.execute(
    `INSERT IGNORE INTO community_user_badges (user_id, badge_id) VALUES (:uid, :bid)`,
    { uid, bid: badgeId }
  );
}

export async function listMyBadges(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT b.*, ub.awarded_at
     FROM community_user_badges ub
     JOIN community_badges b ON b.id = ub.badge_id
     WHERE ub.user_id = :uid
     ORDER BY ub.awarded_at DESC`,
    { uid }
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    code: r.code,
    name: r.name,
    description: r.description || "",
    icon: r.icon,
    awarded_at: r.awarded_at,
  }));
}

export async function listAllBadges() {
  const pool = getPool();
  const [rows] = await pool.execute(`SELECT * FROM community_badges ORDER BY id`);
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    code: r.code,
    name: r.name,
    description: r.description || "",
    icon: r.icon,
  }));
}
