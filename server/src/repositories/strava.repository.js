import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

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

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function boolOrNull(v) {
  if (v == null) return null;
  return v ? 1 : 0;
}

function jsonStr(v) {
  if (v == null) return null;
  return typeof v === "string" ? v : JSON.stringify(v);
}

function mapConnection(row) {
  if (!row) return null;
  return {
    user_id: String(row.user_id),
    athlete_id: String(row.athlete_id),
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_at: row.expires_at,
    scope: row.scope || "",
    athlete_firstname: row.athlete_firstname || "",
    athlete_lastname: row.athlete_lastname || "",
    athlete_profile_url: row.athlete_profile_url || "",
    connected_at: row.connected_at,
    updated_at: row.updated_at,
    last_synced_at: row.last_synced_at || null,
  };
}

const ACTIVITY_SELECT = `id, user_id, name, sport_type, type, distance_m, moving_time_s, elapsed_time_s,
  total_elevation_gain, calories, has_heartrate, average_heartrate, max_heartrate,
  average_speed, max_speed, average_cadence, average_watts, max_watts, weighted_average_watts,
  kilojoules, device_watts, suffer_score, workout_type, trainer, commute, manual, private,
  visibility, gear_id, device_name, kudos_count, comment_count, pr_count, achievement_count,
  photo_count, start_lat, start_lng, end_lat, end_lng, location_city, location_state, location_country,
  start_date, timezone, map_summary_polyline, map_polyline, synced_at, detail_synced_at, streams_synced_at`;

function mapActivity(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: row.name || "",
    sport_type: row.sport_type || row.type || "",
    type: row.type || "",
    distance_m: Number(row.distance_m) || 0,
    moving_time_s: Number(row.moving_time_s) || 0,
    elapsed_time_s: Number(row.elapsed_time_s) || 0,
    total_elevation_gain: numOrNull(row.total_elevation_gain),
    calories: numOrNull(row.calories),
    has_heartrate: row.has_heartrate != null ? Boolean(row.has_heartrate) : null,
    average_heartrate: numOrNull(row.average_heartrate),
    max_heartrate: numOrNull(row.max_heartrate),
    average_speed: numOrNull(row.average_speed),
    max_speed: numOrNull(row.max_speed),
    average_cadence: numOrNull(row.average_cadence),
    average_watts: numOrNull(row.average_watts),
    max_watts: numOrNull(row.max_watts),
    weighted_average_watts: numOrNull(row.weighted_average_watts),
    kilojoules: numOrNull(row.kilojoules),
    device_watts: row.device_watts != null ? Boolean(row.device_watts) : null,
    suffer_score: numOrNull(row.suffer_score),
    workout_type: numOrNull(row.workout_type),
    trainer: row.trainer != null ? Boolean(row.trainer) : null,
    commute: row.commute != null ? Boolean(row.commute) : null,
    manual: row.manual != null ? Boolean(row.manual) : null,
    private: row.private != null ? Boolean(row.private) : null,
    visibility: row.visibility || null,
    gear_id: row.gear_id || null,
    device_name: row.device_name || null,
    kudos_count: numOrNull(row.kudos_count),
    comment_count: numOrNull(row.comment_count),
    pr_count: numOrNull(row.pr_count),
    achievement_count: numOrNull(row.achievement_count),
    photo_count: numOrNull(row.photo_count),
    start_lat: numOrNull(row.start_lat),
    start_lng: numOrNull(row.start_lng),
    end_lat: numOrNull(row.end_lat),
    end_lng: numOrNull(row.end_lng),
    location_city: row.location_city || null,
    location_state: row.location_state || null,
    location_country: row.location_country || null,
    start_date: row.start_date,
    timezone: row.timezone || "",
    map_summary_polyline: row.map_summary_polyline || "",
    map_polyline: row.map_polyline || "",
    synced_at: row.synced_at,
    detail_synced_at: row.detail_synced_at || null,
    streams_synced_at: row.streams_synced_at || null,
  };
}

export async function findConnection(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM strava_connections WHERE user_id = :uid LIMIT 1`,
    { uid }
  );
  return mapConnection(rows?.[0]);
}

export async function upsertConnection(userId, data) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  await pool.execute(
    `INSERT INTO strava_connections
      (user_id, athlete_id, access_token, refresh_token, expires_at, scope,
       athlete_firstname, athlete_lastname, athlete_profile_url, connected_at, updated_at)
     VALUES
      (:uid, :athlete_id, :access_token, :refresh_token, :expires_at, :scope,
       :firstname, :lastname, :profile_url, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE
       athlete_id = VALUES(athlete_id),
       access_token = VALUES(access_token),
       refresh_token = VALUES(refresh_token),
       expires_at = VALUES(expires_at),
       scope = VALUES(scope),
       athlete_firstname = VALUES(athlete_firstname),
       athlete_lastname = VALUES(athlete_lastname),
       athlete_profile_url = VALUES(athlete_profile_url),
       updated_at = CURRENT_TIMESTAMP(3)`,
    {
      uid,
      athlete_id: Number(data.athlete_id),
      access_token: String(data.access_token),
      refresh_token: String(data.refresh_token),
      expires_at: toMysqlDateTime(data.expires_at),
      scope: data.scope ? String(data.scope) : null,
      firstname: data.athlete_firstname ? String(data.athlete_firstname) : null,
      lastname: data.athlete_lastname ? String(data.athlete_lastname) : null,
      profile_url: data.athlete_profile_url ? String(data.athlete_profile_url) : null,
    }
  );
  return findConnection(userId);
}

export async function updateTokens(userId, { access_token, refresh_token, expires_at }) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;
  const pool = getPool();
  await pool.execute(
    `UPDATE strava_connections
     SET access_token = :access_token,
         refresh_token = :refresh_token,
         expires_at = :expires_at,
         updated_at = CURRENT_TIMESTAMP(3)
     WHERE user_id = :uid`,
    {
      uid,
      access_token: String(access_token),
      refresh_token: String(refresh_token),
      expires_at: toMysqlDateTime(expires_at),
    }
  );
}

export async function touchSyncedAt(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;
  const pool = getPool();
  await pool.execute(
    `UPDATE strava_connections
     SET last_synced_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
     WHERE user_id = :uid`,
    { uid }
  );
}

export async function deleteConnection(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;
  const pool = getPool();
  // Child tables cascade from activities; delete activities then connection.
  await pool.execute(`DELETE FROM strava_activities WHERE user_id = :uid`, { uid: Number(uid) });
  await pool.execute(`DELETE FROM strava_connections WHERE user_id = :uid`, { uid: Number(uid) });
}

/**
 * @param {string|number} userId
 * @param {Record<string, unknown>} activity
 * @param {{ markDetail?: boolean, markStreams?: boolean }} [opts]
 */
export async function upsertActivity(userId, activity, opts = {}) {
  const uid = parseBigIntId(userId);
  const aid = parseBigIntId(activity.id);
  if (uid == null || aid == null) return;
  const pool = getPool();
  const raw = jsonStr(activity.raw_json);
  const markDetail = Boolean(opts.markDetail);
  const markStreams = Boolean(opts.markStreams);

  await pool.execute(
    `INSERT INTO strava_activities
      (id, user_id, name, sport_type, type, distance_m, moving_time_s, elapsed_time_s,
       total_elevation_gain, calories, has_heartrate, average_heartrate, max_heartrate,
       average_speed, max_speed, average_cadence, average_watts, max_watts, weighted_average_watts,
       kilojoules, device_watts, suffer_score, workout_type, trainer, commute, manual, private,
       visibility, gear_id, device_name, kudos_count, comment_count, pr_count, achievement_count,
       photo_count, start_lat, start_lng, end_lat, end_lng, location_city, location_state, location_country,
       start_date, timezone, map_summary_polyline, map_polyline, raw_json, synced_at,
       detail_synced_at, streams_synced_at)
     VALUES
      (:id, :uid, :name, :sport_type, :type, :distance_m, :moving_time_s, :elapsed_time_s,
       :elev, :calories, :has_hr, :avg_hr, :max_hr,
       :avg_spd, :max_spd, :avg_cad, :avg_watts, :max_watts, :wavg_watts,
       :kj, :dev_watts, :suffer, :workout_type, :trainer, :commute, :manual, :private,
       :visibility, :gear_id, :device_name, :kudos, :comments, :prs, :achievements,
       :photos, :start_lat, :start_lng, :end_lat, :end_lng, :city, :state, :country,
       :start_date, :timezone, :summary_poly, :full_poly, :raw_json, CURRENT_TIMESTAMP(3),
       ${markDetail ? "CURRENT_TIMESTAMP(3)" : "NULL"},
       ${markStreams ? "CURRENT_TIMESTAMP(3)" : "NULL"})
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       name = VALUES(name),
       sport_type = VALUES(sport_type),
       type = VALUES(type),
       distance_m = VALUES(distance_m),
       moving_time_s = VALUES(moving_time_s),
       elapsed_time_s = VALUES(elapsed_time_s),
       total_elevation_gain = COALESCE(VALUES(total_elevation_gain), total_elevation_gain),
       calories = COALESCE(VALUES(calories), calories),
       has_heartrate = COALESCE(VALUES(has_heartrate), has_heartrate),
       average_heartrate = COALESCE(VALUES(average_heartrate), average_heartrate),
       max_heartrate = COALESCE(VALUES(max_heartrate), max_heartrate),
       average_speed = COALESCE(VALUES(average_speed), average_speed),
       max_speed = COALESCE(VALUES(max_speed), max_speed),
       average_cadence = COALESCE(VALUES(average_cadence), average_cadence),
       average_watts = COALESCE(VALUES(average_watts), average_watts),
       max_watts = COALESCE(VALUES(max_watts), max_watts),
       weighted_average_watts = COALESCE(VALUES(weighted_average_watts), weighted_average_watts),
       kilojoules = COALESCE(VALUES(kilojoules), kilojoules),
       device_watts = COALESCE(VALUES(device_watts), device_watts),
       suffer_score = COALESCE(VALUES(suffer_score), suffer_score),
       workout_type = COALESCE(VALUES(workout_type), workout_type),
       trainer = COALESCE(VALUES(trainer), trainer),
       commute = COALESCE(VALUES(commute), commute),
       manual = COALESCE(VALUES(manual), manual),
       private = COALESCE(VALUES(private), private),
       visibility = COALESCE(VALUES(visibility), visibility),
       gear_id = COALESCE(VALUES(gear_id), gear_id),
       device_name = COALESCE(VALUES(device_name), device_name),
       kudos_count = COALESCE(VALUES(kudos_count), kudos_count),
       comment_count = COALESCE(VALUES(comment_count), comment_count),
       pr_count = COALESCE(VALUES(pr_count), pr_count),
       achievement_count = COALESCE(VALUES(achievement_count), achievement_count),
       photo_count = COALESCE(VALUES(photo_count), photo_count),
       start_lat = COALESCE(VALUES(start_lat), start_lat),
       start_lng = COALESCE(VALUES(start_lng), start_lng),
       end_lat = COALESCE(VALUES(end_lat), end_lat),
       end_lng = COALESCE(VALUES(end_lng), end_lng),
       location_city = COALESCE(VALUES(location_city), location_city),
       location_state = COALESCE(VALUES(location_state), location_state),
       location_country = COALESCE(VALUES(location_country), location_country),
       start_date = VALUES(start_date),
       timezone = COALESCE(VALUES(timezone), timezone),
       map_summary_polyline = COALESCE(VALUES(map_summary_polyline), map_summary_polyline),
       map_polyline = COALESCE(VALUES(map_polyline), map_polyline),
       raw_json = COALESCE(VALUES(raw_json), raw_json),
       synced_at = CURRENT_TIMESTAMP(3),
       detail_synced_at = IF(${markDetail ? "1" : "0"}, CURRENT_TIMESTAMP(3), detail_synced_at),
       streams_synced_at = IF(${markStreams ? "1" : "0"}, CURRENT_TIMESTAMP(3), streams_synced_at)`,
    {
      id: aid,
      uid: Number(uid),
      name: String(activity.name || "").slice(0, 255),
      sport_type: activity.sport_type ? String(activity.sport_type).slice(0, 64) : null,
      type: activity.type ? String(activity.type).slice(0, 64) : null,
      distance_m: Number(activity.distance_m) || 0,
      moving_time_s: Number(activity.moving_time_s) || 0,
      elapsed_time_s: Number(activity.elapsed_time_s) || 0,
      elev: numOrNull(activity.total_elevation_gain),
      calories: numOrNull(activity.calories),
      has_hr: boolOrNull(activity.has_heartrate),
      avg_hr: numOrNull(activity.average_heartrate),
      max_hr: numOrNull(activity.max_heartrate),
      avg_spd: numOrNull(activity.average_speed),
      max_spd: numOrNull(activity.max_speed),
      avg_cad: numOrNull(activity.average_cadence),
      avg_watts: numOrNull(activity.average_watts),
      max_watts: numOrNull(activity.max_watts),
      wavg_watts: numOrNull(activity.weighted_average_watts),
      kj: numOrNull(activity.kilojoules),
      dev_watts: boolOrNull(activity.device_watts),
      suffer: numOrNull(activity.suffer_score),
      workout_type: numOrNull(activity.workout_type),
      trainer: boolOrNull(activity.trainer),
      commute: boolOrNull(activity.commute),
      manual: boolOrNull(activity.manual),
      private: boolOrNull(activity.private),
      visibility: activity.visibility ? String(activity.visibility).slice(0, 32) : null,
      gear_id: activity.gear_id ? String(activity.gear_id).slice(0, 64) : null,
      device_name: activity.device_name ? String(activity.device_name).slice(0, 128) : null,
      kudos: numOrNull(activity.kudos_count),
      comments: numOrNull(activity.comment_count),
      prs: numOrNull(activity.pr_count),
      achievements: numOrNull(activity.achievement_count),
      photos: numOrNull(activity.photo_count),
      start_lat: numOrNull(activity.start_lat),
      start_lng: numOrNull(activity.start_lng),
      end_lat: numOrNull(activity.end_lat),
      end_lng: numOrNull(activity.end_lng),
      city: activity.location_city ? String(activity.location_city).slice(0, 128) : null,
      state: activity.location_state ? String(activity.location_state).slice(0, 128) : null,
      country: activity.location_country ? String(activity.location_country).slice(0, 128) : null,
      start_date: toMysqlDateTime(activity.start_date),
      timezone: activity.timezone ? String(activity.timezone).slice(0, 64) : null,
      summary_poly: activity.map_summary_polyline || null,
      full_poly: activity.map_polyline || null,
      raw_json: raw,
    }
  );
}

export async function listActivities(userId, { limit = 30 } = {}) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const lim = Math.min(200, Math.max(1, Number(limit) || 30));
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${ACTIVITY_SELECT}
     FROM strava_activities
     WHERE user_id = :uid
     ORDER BY start_date DESC
     LIMIT ${lim}`,
    { uid: Number(uid) }
  );
  return (Array.isArray(rows) ? rows : [])
    .map(mapActivity)
    .filter((a) => a && String(a.user_id) === String(uid));
}

export async function listActivitiesNeedingDetail(userId, limit = 10) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const lim = Math.min(20, Math.max(1, Number(limit) || 10));
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${ACTIVITY_SELECT}
     FROM strava_activities
     WHERE user_id = :uid AND detail_synced_at IS NULL
     ORDER BY start_date DESC
     LIMIT ${lim}`,
    { uid: Number(uid) }
  );
  return (Array.isArray(rows) ? rows : []).map(mapActivity).filter(Boolean);
}

export async function listActivitiesInDateRange(userId, startDate, endDate) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const start = String(startDate || "").slice(0, 10);
  const end = String(endDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${ACTIVITY_SELECT}
     FROM strava_activities
     WHERE user_id = :uid
       AND DATE(start_date) >= :startDate
       AND DATE(start_date) <= :endDate
     ORDER BY start_date DESC`,
    { uid: Number(uid), startDate: start, endDate: end }
  );
  return (Array.isArray(rows) ? rows : [])
    .map(mapActivity)
    .filter((a) => a && String(a.user_id) === String(uid));
}

export async function findActivity(userId, activityId) {
  const uid = parseBigIntId(userId);
  const aid = parseBigIntId(activityId);
  if (uid == null || aid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${ACTIVITY_SELECT}
     FROM strava_activities
     WHERE id = :aid AND user_id = :uid
     LIMIT 1`,
    { aid: Number(aid), uid: Number(uid) }
  );
  const activity = mapActivity(rows?.[0]);
  if (!activity || String(activity.user_id) !== String(uid)) return null;
  return activity;
}

export async function replaceLaps(activityId, laps) {
  const aid = parseBigIntId(activityId);
  if (aid == null) return;
  const pool = getPool();
  await pool.execute(`DELETE FROM strava_activity_laps WHERE activity_id = :aid`, { aid: Number(aid) });
  const list = Array.isArray(laps) ? laps : [];
  for (let i = 0; i < list.length; i += 1) {
    const lap = list[i] || {};
    await pool.execute(
      `INSERT INTO strava_activity_laps
        (activity_id, lap_index, name, distance_m, moving_time_s, elapsed_time_s, total_elevation_gain,
         average_speed, max_speed, average_heartrate, max_heartrate, average_cadence, average_watts,
         lap_index_strava, start_index, end_index, raw_json)
       VALUES
        (:aid, :idx, :name, :dist, :mov, :elapsed, :elev, :avg_spd, :max_spd, :avg_hr, :max_hr, :cad, :watts,
         :lap_idx, :start_i, :end_i, :raw)`,
      {
        aid: Number(aid),
        idx: i,
        name: lap.name ? String(lap.name).slice(0, 255) : null,
        dist: numOrNull(lap.distance),
        mov: numOrNull(lap.moving_time),
        elapsed: numOrNull(lap.elapsed_time),
        elev: numOrNull(lap.total_elevation_gain),
        avg_spd: numOrNull(lap.average_speed),
        max_spd: numOrNull(lap.max_speed),
        avg_hr: numOrNull(lap.average_heartrate),
        max_hr: numOrNull(lap.max_heartrate),
        cad: numOrNull(lap.average_cadence),
        watts: numOrNull(lap.average_watts),
        lap_idx: numOrNull(lap.lap_index),
        start_i: numOrNull(lap.start_index),
        end_i: numOrNull(lap.end_index),
        raw: jsonStr(lap),
      }
    );
  }
}

export async function replaceSplits(activityId, splitType, splits) {
  const aid = parseBigIntId(activityId);
  const st = String(splitType || "metric").slice(0, 16);
  if (aid == null) return;
  const pool = getPool();
  await pool.execute(
    `DELETE FROM strava_activity_splits WHERE activity_id = :aid AND split_type = :st`,
    { aid: Number(aid), st }
  );
  const list = Array.isArray(splits) ? splits : [];
  for (let i = 0; i < list.length; i += 1) {
    const s = list[i] || {};
    await pool.execute(
      `INSERT INTO strava_activity_splits
        (activity_id, split_type, split_index, distance_m, elapsed_time_s, moving_time_s,
         elevation_difference, average_speed, average_heartrate, pace_zone)
       VALUES
        (:aid, :st, :idx, :dist, :elapsed, :mov, :elev, :avg_spd, :avg_hr, :zone)`,
      {
        aid: Number(aid),
        st,
        idx: i,
        dist: numOrNull(s.distance),
        elapsed: numOrNull(s.elapsed_time),
        mov: numOrNull(s.moving_time),
        elev: numOrNull(s.elevation_difference),
        avg_spd: numOrNull(s.average_speed),
        avg_hr: numOrNull(s.average_heartrate),
        zone: numOrNull(s.pace_zone),
      }
    );
  }
}

export async function upsertStream(activityId, streamType, stream) {
  const aid = parseBigIntId(activityId);
  const st = String(streamType || "").slice(0, 32);
  if (aid == null || !st) return;
  const pool = getPool();
  const data = stream?.data != null ? stream.data : stream;
  await pool.execute(
    `INSERT INTO strava_activity_streams
      (activity_id, stream_type, data_json, original_size, resolution, series_type)
     VALUES (:aid, :st, :data, :size, :res, :series)
     ON DUPLICATE KEY UPDATE
       data_json = VALUES(data_json),
       original_size = VALUES(original_size),
       resolution = VALUES(resolution),
       series_type = VALUES(series_type)`,
    {
      aid: Number(aid),
      st,
      data: jsonStr(data),
      size: numOrNull(stream?.original_size),
      res: stream?.resolution ? String(stream.resolution).slice(0, 16) : null,
      series: stream?.series_type ? String(stream.series_type).slice(0, 32) : null,
    }
  );
}

export async function replacePhotos(activityId, photos) {
  const aid = parseBigIntId(activityId);
  if (aid == null) return;
  const pool = getPool();
  await pool.execute(`DELETE FROM strava_activity_photos WHERE activity_id = :aid`, {
    aid: Number(aid),
  });
  const list = Array.isArray(photos) ? photos : [];
  for (const p of list) {
    const pid = parseBigIntId(p.unique_id != null ? p.id || p.unique_id : p.id);
    // Strava photo unique id can be string; use hash of unique_id if not numeric
    let idNum = pid;
    if (idNum == null && p.unique_id) {
      const s = String(p.unique_id);
      let h = 0;
      for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      idNum = h || null;
    }
    if (idNum == null) continue;
    await pool.execute(
      `INSERT INTO strava_activity_photos
        (id, activity_id, unique_id, urls_json, caption, source, created_at_strava, synced_at)
       VALUES (:id, :aid, :uid, :urls, :caption, :source, :created, CURRENT_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         activity_id = VALUES(activity_id),
         urls_json = VALUES(urls_json),
         caption = VALUES(caption),
         source = VALUES(source),
         created_at_strava = VALUES(created_at_strava),
         synced_at = CURRENT_TIMESTAMP(3)`,
      {
        id: Number(idNum),
        aid: Number(aid),
        uid: p.unique_id ? String(p.unique_id).slice(0, 64) : null,
        urls: jsonStr(p.urls || p.urls_json || null),
        caption: p.caption ? String(p.caption).slice(0, 512) : null,
        source: numOrNull(p.source),
        created: toMysqlDateTime(p.created_at),
      }
    );
  }
}

export async function listLaps(activityId) {
  const aid = parseBigIntId(activityId);
  if (aid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM strava_activity_laps WHERE activity_id = :aid ORDER BY lap_index ASC`,
    { aid: Number(aid) }
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    lap_index: Number(r.lap_index),
    name: r.name || "",
    distance_m: numOrNull(r.distance_m),
    moving_time_s: numOrNull(r.moving_time_s),
    elapsed_time_s: numOrNull(r.elapsed_time_s),
    total_elevation_gain: numOrNull(r.total_elevation_gain),
    average_speed: numOrNull(r.average_speed),
    max_speed: numOrNull(r.max_speed),
    average_heartrate: numOrNull(r.average_heartrate),
    max_heartrate: numOrNull(r.max_heartrate),
    average_cadence: numOrNull(r.average_cadence),
    average_watts: numOrNull(r.average_watts),
  }));
}

export async function listSplits(activityId) {
  const aid = parseBigIntId(activityId);
  if (aid == null) return { metric: [], standard: [] };
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM strava_activity_splits WHERE activity_id = :aid ORDER BY split_type, split_index ASC`,
    { aid: Number(aid) }
  );
  const metric = [];
  const standard = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const item = {
      split_index: Number(r.split_index),
      distance_m: numOrNull(r.distance_m),
      elapsed_time_s: numOrNull(r.elapsed_time_s),
      moving_time_s: numOrNull(r.moving_time_s),
      elevation_difference: numOrNull(r.elevation_difference),
      average_speed: numOrNull(r.average_speed),
      average_heartrate: numOrNull(r.average_heartrate),
      pace_zone: numOrNull(r.pace_zone),
    };
    if (r.split_type === "standard") standard.push(item);
    else metric.push(item);
  }
  return { metric, standard };
}

export async function listStreams(activityId) {
  const aid = parseBigIntId(activityId);
  if (aid == null) return {};
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT stream_type, data_json, original_size, resolution FROM strava_activity_streams WHERE activity_id = :aid`,
    { aid: Number(aid) }
  );
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    let data = null;
    try {
      data = typeof r.data_json === "string" ? JSON.parse(r.data_json) : r.data_json;
    } catch {
      data = null;
    }
    out[r.stream_type] = data;
  }
  return out;
}

export async function listPhotos(activityId) {
  const aid = parseBigIntId(activityId);
  if (aid == null) return [];
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, unique_id, urls_json, caption, source, created_at_strava
     FROM strava_activity_photos WHERE activity_id = :aid ORDER BY created_at_strava ASC`,
    { aid: Number(aid) }
  );
  return (Array.isArray(rows) ? rows : []).map((r) => {
    let urls = null;
    try {
      urls = typeof r.urls_json === "string" ? JSON.parse(r.urls_json) : r.urls_json;
    } catch {
      urls = null;
    }
    return {
      id: String(r.id),
      unique_id: r.unique_id || null,
      urls,
      caption: r.caption || "",
      source: numOrNull(r.source),
      created_at: r.created_at_strava,
    };
  });
}

export async function findActivityDetailed(userId, activityId) {
  const activity = await findActivity(userId, activityId);
  if (!activity) return null;
  const [laps, splits, streams, photos] = await Promise.all([
    listLaps(activityId),
    listSplits(activityId),
    listStreams(activityId),
    listPhotos(activityId),
  ]);
  return { activity, laps, splits, streams, photos };
}
