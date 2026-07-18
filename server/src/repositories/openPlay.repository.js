import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

/** MySQL DATETIME(3) rejects ISO strings with T/Z — convert to `YYYY-MM-DD HH:mm:ss.SSS`. */
function toMysqlDateTime(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`
  );
}

function mapEvent(row, extra = {}) {
  if (!row) return null;
  const capacity = Number(row.capacity) || 0;
  const approvedCount = Number(row.approved_count ?? extra.approved_count) || 0;
  const pendingCount = Number(row.pending_count ?? extra.pending_count) || 0;
  const waitlistCount = Number(row.waitlist_count ?? extra.waitlist_count) || 0;
  return {
    id: String(row.id),
    title: row.title,
    sport_key: row.sport_key,
    sport_name: row.sport_name || null,
    sport_icon: row.sport_icon || null,
    starts_at: row.starts_at,
    ends_at: row.ends_at || null,
    place: row.place || "",
    city: row.city || "",
    address_note: row.address_note || "",
    capacity,
    skill_level: row.skill_level || "all",
    fee_note: row.fee_note || "",
    description: row.description || "",
    cover_url: row.cover_url || "",
    host_user_id: row.host_user_id != null ? String(row.host_user_id) : null,
    host_name: row.host_name || null,
    status: row.status,
    approved_count: approvedCount,
    pending_count: pendingCount,
    waitlist_count: waitlistCount,
    spots_left: Math.max(0, capacity - approvedCount),
    my_status: row.my_status || extra.my_status || null,
    is_host: Boolean(row.is_host ?? extra.is_host),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapParticipant(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    event_id: String(row.event_id),
    user_id: String(row.user_id),
    name: String(row.nama || row.kode_sid || "Pengguna"),
    status: row.status,
    note: row.note || "",
    decided_by_user_id: row.decided_by_user_id != null ? String(row.decided_by_user_id) : null,
    decided_at: row.decided_at || null,
    created_at: row.created_at,
  };
}

const COUNT_SELECT = `
  (SELECT COUNT(*) FROM open_play_participants p
    WHERE p.event_id = e.id AND p.status = 'approved') AS approved_count,
  (SELECT COUNT(*) FROM open_play_participants p
    WHERE p.event_id = e.id AND p.status = 'pending') AS pending_count,
  (SELECT COUNT(*) FROM open_play_participants p
    WHERE p.event_id = e.id AND p.status = 'waitlist') AS waitlist_count
`;

/**
 * @param {{ q?: string, sport?: string, city?: string, limit?: number }} opts
 * @param {string|number|bigint} userId
 */
export async function listHubEvents(opts = {}, userId) {
  const pool = getPool();
  const uid = parseBigIntId(userId);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 40));
  const params = { lim: limit, uid };
  let where = `e.status IN ('open', 'full') AND e.starts_at >= UTC_TIMESTAMP(3)`;
  if (opts.sport) {
    where += ` AND e.sport_key = :sport`;
    params.sport = String(opts.sport);
  }
  if (opts.city) {
    where += ` AND e.city LIKE :city`;
    params.city = `%${String(opts.city).trim()}%`;
  }
  if (opts.q) {
    where += ` AND (e.title LIKE :q OR e.place LIKE :q OR e.city LIKE :q OR e.description LIKE :q)`;
    params.q = `%${String(opts.q).trim()}%`;
  }
  const [rows] = await pool.execute(
    `SELECT e.*, s.name AS sport_name, s.icon AS sport_icon, h.nama AS host_name,
            ${COUNT_SELECT},
            (SELECT p.status FROM open_play_participants p
              WHERE p.event_id = e.id AND p.user_id = :uid LIMIT 1) AS my_status,
            CASE WHEN e.host_user_id = :uid THEN 1 ELSE 0 END AS is_host
     FROM open_play_events e
     JOIN community_sports s ON s.sport_key = e.sport_key
     LEFT JOIN employee_profiles h ON h.id = e.host_user_id
     WHERE ${where}
     ORDER BY e.starts_at ASC
     LIMIT ${limit}`,
    params
  );
  return (Array.isArray(rows) ? rows : []).map((r) => mapEvent(r));
}

export async function listSports() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT s.sport_key, s.name, s.icon, s.sort_order,
            COUNT(e.id) AS event_count
     FROM community_sports s
     LEFT JOIN open_play_events e
       ON e.sport_key = s.sport_key AND e.status IN ('open', 'full') AND e.starts_at >= UTC_TIMESTAMP(3)
     WHERE s.is_active = 1
     GROUP BY s.sport_key, s.name, s.icon, s.sort_order
     ORDER BY s.sort_order ASC`
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    sport_key: r.sport_key,
    name: r.name,
    icon: r.icon,
    sort_order: Number(r.sort_order) || 0,
    event_count: Number(r.event_count) || 0,
  }));
}

export async function listMine(userId) {
  const pool = getPool();
  const uid = parseBigIntId(userId);
  if (uid == null) return { hosting: [], joined: [], pending: [] };

  const [hostingRows] = await pool.execute(
    `SELECT e.*, s.name AS sport_name, s.icon AS sport_icon, h.nama AS host_name,
            ${COUNT_SELECT},
            'approved' AS my_status,
            1 AS is_host
     FROM open_play_events e
     JOIN community_sports s ON s.sport_key = e.sport_key
     LEFT JOIN employee_profiles h ON h.id = e.host_user_id
     WHERE e.host_user_id = :uid AND e.status <> 'cancelled'
     ORDER BY e.starts_at ASC`,
    { uid }
  );

  const [partRows] = await pool.execute(
    `SELECT e.*, s.name AS sport_name, s.icon AS sport_icon, h.nama AS host_name,
            ${COUNT_SELECT},
            p.status AS my_status,
            0 AS is_host
     FROM open_play_participants p
     JOIN open_play_events e ON e.id = p.event_id
     JOIN community_sports s ON s.sport_key = e.sport_key
     LEFT JOIN employee_profiles h ON h.id = e.host_user_id
     WHERE p.user_id = :uid
       AND e.host_user_id <> :uid
       AND p.status IN ('approved', 'pending', 'waitlist')
       AND e.status <> 'cancelled'
     ORDER BY e.starts_at ASC`,
    { uid }
  );

  const hosting = (Array.isArray(hostingRows) ? hostingRows : []).map((r) => mapEvent(r));
  const parts = (Array.isArray(partRows) ? partRows : []).map((r) => mapEvent(r));
  return {
    hosting,
    joined: parts.filter((e) => e.my_status === "approved"),
    pending: parts.filter((e) => e.my_status === "pending" || e.my_status === "waitlist"),
  };
}

export async function findEventById(eventId, userId) {
  const eid = parseBigIntId(eventId);
  const uid = parseBigIntId(userId);
  if (eid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT e.*, s.name AS sport_name, s.icon AS sport_icon, h.nama AS host_name,
            ${COUNT_SELECT},
            (SELECT p.status FROM open_play_participants p
              WHERE p.event_id = e.id AND p.user_id = :uid LIMIT 1) AS my_status,
            CASE WHEN e.host_user_id = :uid THEN 1 ELSE 0 END AS is_host
     FROM open_play_events e
     JOIN community_sports s ON s.sport_key = e.sport_key
     LEFT JOIN employee_profiles h ON h.id = e.host_user_id
     WHERE e.id = :eid
     LIMIT 1`,
    { eid, uid }
  );
  return mapEvent(rows?.[0]);
}

export async function listParticipants(eventId, { includePending = false } = {}) {
  const eid = parseBigIntId(eventId);
  if (eid == null) return [];
  const pool = getPool();
  const statuses = includePending
    ? `('approved', 'pending', 'waitlist')`
    : `('approved')`;
  const [rows] = await pool.execute(
    `SELECT p.*, e.nama, e.kode_sid
     FROM open_play_participants p
     JOIN employee_profiles e ON e.id = p.user_id
     WHERE p.event_id = :eid AND p.status IN ${statuses}
     ORDER BY
       FIELD(p.status, 'approved', 'pending', 'waitlist'),
       p.created_at ASC`,
    { eid }
  );
  return (Array.isArray(rows) ? rows : []).map(mapParticipant);
}

export async function createEvent(hostUserId, body) {
  const uid = parseBigIntId(hostUserId);
  if (uid == null) return null;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const capacity = Math.min(500, Math.max(2, Number(body.capacity) || 8));
    const [result] = await conn.execute(
      `INSERT INTO open_play_events
        (title, sport_key, starts_at, ends_at, place, city, address_note,
         capacity, skill_level, fee_note, description, cover_url, host_user_id, status)
       VALUES
        (:title, :sport_key, :starts_at, :ends_at, :place, :city, :address_note,
         :capacity, :skill_level, :fee_note, :description, :cover_url, :host_user_id, 'open')`,
      {
        title: String(body.title).trim(),
        sport_key: String(body.sport_key).trim(),
        starts_at: toMysqlDateTime(body.starts_at),
        ends_at: toMysqlDateTime(body.ends_at),
        place: body.place ? String(body.place).trim() : null,
        city: body.city ? String(body.city).trim() : null,
        address_note: body.address_note ? String(body.address_note).trim() : null,
        capacity,
        skill_level: body.skill_level || "all",
        fee_note: body.fee_note ? String(body.fee_note).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        cover_url: body.cover_url ? String(body.cover_url).trim() : null,
        host_user_id: uid,
      }
    );
    const eventId = result?.insertId;
    await conn.execute(
      `INSERT INTO open_play_participants (event_id, user_id, status)
       VALUES (:eid, :uid, 'approved')`,
      { eid: eventId, uid }
    );
    await conn.commit();
    return findEventById(eventId, hostUserId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateEvent(eventId, hostUserId, patch) {
  const eid = parseBigIntId(eventId);
  const uid = parseBigIntId(hostUserId);
  if (eid == null || uid == null) return null;
  const pool = getPool();
  const fields = [];
  const params = { eid, uid };
  const allowed = [
    "title",
    "sport_key",
    "starts_at",
    "ends_at",
    "place",
    "city",
    "address_note",
    "capacity",
    "skill_level",
    "fee_note",
    "description",
    "cover_url",
    "status",
  ];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = :${key}`);
      if (key === "starts_at" || key === "ends_at") {
        params[key] = toMysqlDateTime(patch[key]);
      } else {
        params[key] = patch[key];
      }
    }
  }
  if (!fields.length) return findEventById(eventId, hostUserId);
  await pool.execute(
    `UPDATE open_play_events SET ${fields.join(", ")}
     WHERE id = :eid AND host_user_id = :uid`,
    params
  );
  return findEventById(eventId, hostUserId);
}

export async function countApproved(eventId) {
  const eid = parseBigIntId(eventId);
  if (eid == null) return 0;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM open_play_participants
     WHERE event_id = :eid AND status = 'approved'`,
    { eid }
  );
  return Number(rows?.[0]?.cnt) || 0;
}

export async function refreshEventCapacityStatus(eventId) {
  const eid = parseBigIntId(eventId);
  if (eid == null) return;
  const pool = getPool();
  await pool.execute(
    `UPDATE open_play_events e
     SET e.status = CASE
       WHEN e.status IN ('cancelled', 'done') THEN e.status
       WHEN (
         SELECT COUNT(*) FROM open_play_participants p
         WHERE p.event_id = e.id AND p.status = 'approved'
       ) >= e.capacity THEN 'full'
       ELSE 'open'
     END
     WHERE e.id = :eid`,
    { eid }
  );
}

export async function getParticipant(eventId, userId) {
  const eid = parseBigIntId(eventId);
  const uid = parseBigIntId(userId);
  if (eid == null || uid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT p.*, e.nama, e.kode_sid
     FROM open_play_participants p
     JOIN employee_profiles e ON e.id = p.user_id
     WHERE p.event_id = :eid AND p.user_id = :uid
     LIMIT 1`,
    { eid, uid }
  );
  return mapParticipant(rows?.[0]);
}

/**
 * Request join: pending if spots remain for approved+pending consideration,
 * waitlist if approved_count >= capacity.
 */
export async function requestJoin(eventId, userId, note) {
  const eid = parseBigIntId(eventId);
  const uid = parseBigIntId(userId);
  if (eid == null || uid == null) return null;
  const pool = getPool();
  const event = await findEventById(eventId, userId);
  if (!event) return null;

  const approved = await countApproved(eventId);
  const nextStatus = approved >= event.capacity ? "waitlist" : "pending";

  await pool.execute(
    `INSERT INTO open_play_participants (event_id, user_id, status, note)
     VALUES (:eid, :uid, :status, :note)
     ON DUPLICATE KEY UPDATE
       status = IF(status IN ('cancelled', 'rejected'), VALUES(status), status),
       note = IF(status IN ('cancelled', 'rejected'), VALUES(note), note),
       updated_at = CURRENT_TIMESTAMP(3)`,
    {
      eid,
      uid,
      status: nextStatus,
      note: note ? String(note).trim().slice(0, 255) : null,
    }
  );
  return findEventById(eventId, userId);
}

export async function cancelJoin(eventId, userId) {
  const eid = parseBigIntId(eventId);
  const uid = parseBigIntId(userId);
  if (eid == null || uid == null) return null;
  const pool = getPool();
  await pool.execute(
    `UPDATE open_play_participants
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP(3)
     WHERE event_id = :eid AND user_id = :uid
       AND status IN ('pending', 'approved', 'waitlist')`,
    { eid, uid }
  );
  await refreshEventCapacityStatus(eventId);
  return findEventById(eventId, userId);
}

export async function listMessages(eventId, afterId = null) {
  const eid = parseBigIntId(eventId);
  if (eid == null) return [];
  const pool = getPool();
  const params = { eid };
  let where = `m.event_id = :eid`;
  if (afterId) {
    where += ` AND m.id > :aid`;
    params.aid = parseBigIntId(afterId);
  }
  const [rows] = await pool.execute(
    `SELECT m.*, e.nama AS sender_name
     FROM open_play_messages m
     JOIN employee_profiles e ON e.id = m.sender_user_id
     WHERE ${where}
     ORDER BY m.created_at ASC
     LIMIT 150`,
    params
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    event_id: String(r.event_id),
    sender_user_id: String(r.sender_user_id),
    sender_name: String(r.sender_name || "Pengguna"),
    body: r.body || "",
    image_url: r.image_url || "",
    created_at: r.created_at,
  }));
}

export async function sendMessage(eventId, userId, { body, image_url } = {}) {
  const eid = parseBigIntId(eventId);
  const uid = parseBigIntId(userId);
  if (eid == null || uid == null) return null;
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO open_play_messages (event_id, sender_user_id, body, image_url)
     VALUES (:eid, :uid, :body, :image_url)`,
    {
      eid,
      uid,
      body: body ? String(body).trim() : null,
      image_url: image_url ? String(image_url) : null,
    }
  );
  const msgs = await listMessages(eventId);
  return msgs.find((m) => m.id === String(result.insertId)) || null;
}

export async function decideParticipant(eventId, hostUserId, targetUserId, decision) {
  const eid = parseBigIntId(eventId);
  const hid = parseBigIntId(hostUserId);
  const tid = parseBigIntId(targetUserId);
  if (eid == null || hid == null || tid == null) return null;
  const pool = getPool();
  const event = await findEventById(eventId, hostUserId);
  if (!event || !event.is_host) return null;

  let nextStatus = decision === "approved" ? "approved" : "rejected";
  if (nextStatus === "approved") {
    const approved = await countApproved(eventId);
    const existing = await getParticipant(eventId, targetUserId);
    const alreadyApproved = existing?.status === "approved";
    if (!alreadyApproved && approved >= event.capacity) {
      nextStatus = "waitlist";
    }
  }

  await pool.execute(
    `UPDATE open_play_participants
     SET status = :status,
         decided_by_user_id = :hid,
         decided_at = CURRENT_TIMESTAMP(3),
         updated_at = CURRENT_TIMESTAMP(3)
     WHERE event_id = :eid AND user_id = :tid
       AND status IN ('pending', 'waitlist', 'approved')`,
    { status: nextStatus, hid, eid, tid }
  );
  await refreshEventCapacityStatus(eventId);
  return {
    event: await findEventById(eventId, hostUserId),
    participant: await getParticipant(eventId, targetUserId),
  };
}
