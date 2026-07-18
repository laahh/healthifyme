import { NotFoundError, ValidationError } from "../domain/errors/AppError.js";
import * as repo from "../repositories/strava.repository.js";
import * as auth from "./stravaAuth.service.js";

function latlngPair(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return { lat: null, lng: null };
  return { lat: Number(arr[0]), lng: Number(arr[1]) };
}

/**
 * Map Strava list or detail payload → DB activity row.
 * @param {Record<string, unknown>} raw
 * @param {string|number} userId
 * @param {{ fullRaw?: boolean }} [opts]
 */
export function mapStravaActivity(raw, userId, opts = {}) {
  const start = latlngPair(raw.start_latlng);
  const end = latlngPair(raw.end_latlng);
  return {
    id: raw.id,
    user_id: userId,
    name: raw.name || "",
    sport_type: raw.sport_type || raw.type || "",
    type: raw.type || "",
    distance_m: raw.distance ?? 0,
    moving_time_s: raw.moving_time ?? 0,
    elapsed_time_s: raw.elapsed_time ?? 0,
    total_elevation_gain: raw.total_elevation_gain ?? null,
    calories: raw.calories ?? null,
    has_heartrate: raw.has_heartrate ?? null,
    average_heartrate: raw.average_heartrate ?? null,
    max_heartrate: raw.max_heartrate ?? null,
    average_speed: raw.average_speed ?? null,
    max_speed: raw.max_speed ?? null,
    average_cadence: raw.average_cadence ?? null,
    average_watts: raw.average_watts ?? null,
    max_watts: raw.max_watts ?? null,
    weighted_average_watts: raw.weighted_average_watts ?? null,
    kilojoules: raw.kilojoules ?? null,
    device_watts: raw.device_watts ?? null,
    suffer_score: raw.suffer_score ?? null,
    workout_type: raw.workout_type ?? null,
    trainer: raw.trainer ?? null,
    commute: raw.commute ?? null,
    manual: raw.manual ?? null,
    private: raw.private ?? null,
    visibility: raw.visibility ?? null,
    gear_id: raw.gear_id ?? null,
    device_name: raw.device_name ?? null,
    kudos_count: raw.kudos_count ?? null,
    comment_count: raw.comment_count ?? null,
    pr_count: raw.pr_count ?? null,
    achievement_count: raw.achievement_count ?? null,
    photo_count: raw.total_photo_count ?? raw.photo_count ?? null,
    start_lat: start.lat,
    start_lng: start.lng,
    end_lat: end.lat,
    end_lng: end.lng,
    location_city: raw.location_city ?? null,
    location_state: raw.location_state ?? null,
    location_country: raw.location_country ?? null,
    start_date: raw.start_date || raw.start_date_local,
    timezone: raw.timezone || null,
    map_summary_polyline: raw.map?.summary_polyline || null,
    map_polyline: raw.map?.polyline || null,
    raw_json: opts.fullRaw ? raw : undefined,
  };
}

export async function getStatus(userId) {
  const configured = auth.isStravaConfigured();
  const connection = await repo.findConnection(userId);
  if (!connection) {
    return {
      configured,
      connected: false,
      athlete: null,
      last_synced_at: null,
    };
  }
  return {
    configured,
    connected: true,
    athlete: {
      id: connection.athlete_id,
      firstname: connection.athlete_firstname,
      lastname: connection.athlete_lastname,
      profile_url: connection.athlete_profile_url,
    },
    scope: connection.scope,
    connected_at: connection.connected_at,
    last_synced_at: connection.last_synced_at,
  };
}

/**
 * Enrich one activity: detail + laps + splits + streams + photos.
 */
export async function enrichActivityDetail(userId, activityId) {
  auth.assertStravaConfigured();
  const connection = await repo.findConnection(userId);
  if (!connection) throw new ValidationError("Belum terhubung ke Strava.");

  const aid = String(activityId);
  const detail = await auth.stravaApiRequest(userId, `/activities/${aid}`);
  if (!detail?.id) {
    throw new NotFoundError("Aktivitas tidak ditemukan di Strava.");
  }

  const mapped = mapStravaActivity(detail, userId, { fullRaw: true });

  // Laps
  try {
    const laps = await auth.stravaApiRequest(userId, `/activities/${aid}/laps`);
    if (Array.isArray(laps)) await repo.replaceLaps(aid, laps);
  } catch (e) {
    console.warn("[strava] laps:", e?.message || e);
  }

  // Splits from detail payload
  if (Array.isArray(detail.splits_metric)) {
    await repo.replaceSplits(aid, "metric", detail.splits_metric);
  }
  if (Array.isArray(detail.splits_standard)) {
    await repo.replaceSplits(aid, "standard", detail.splits_standard);
  }

  // Streams
  let streamsOk = false;
  try {
    const keys =
      "time,latlng,altitude,heartrate,velocity_smooth,cadence,watts,distance";
    const streams = await auth.stravaApiRequest(
      userId,
      `/activities/${aid}/streams?keys=${encodeURIComponent(keys)}&key_by_type=true`
    );
    if (streams && typeof streams === "object") {
      for (const [type, stream] of Object.entries(streams)) {
        if (stream && (Array.isArray(stream.data) || stream.data != null)) {
          await repo.upsertStream(aid, type, stream);
        }
      }
      streamsOk = true;
    }
  } catch (e) {
    console.warn("[strava] streams:", e?.message || e);
  }

  // Photos — from detail.photos if present, else try photos endpoint
  try {
    let photos = [];
    if (detail.photos?.primary || Array.isArray(detail.photos?.data)) {
      const primary = detail.photos.primary;
      if (primary) photos.push(primary);
      if (Array.isArray(detail.photos.data)) photos = photos.concat(detail.photos.data);
    }
    if (photos.length === 0 && Number(detail.total_photo_count) > 0) {
      const ph = await auth.stravaApiRequest(
        userId,
        `/activities/${aid}/photos?photo_sources=true`
      );
      if (Array.isArray(ph)) photos = ph;
    }
    if (photos.length > 0) await repo.replacePhotos(aid, photos);
  } catch (e) {
    console.warn("[strava] photos:", e?.message || e);
  }

  await repo.upsertActivity(userId, mapped, {
    markDetail: true,
    markStreams: streamsOk,
  });

  return repo.findActivityDetailed(userId, aid);
}

/** Pull list pages + enrich recent missing details. */
export async function syncActivities(userId, opts = {}) {
  auth.assertStravaConfigured();
  const connection = await repo.findConnection(userId);
  if (!connection) throw new ValidationError("Belum terhubung ke Strava.");

  const maxPages = Math.min(4, Math.max(1, Number(opts.maxPages) || 4));
  const enrichLimit = Math.min(15, Math.max(0, Number(opts.enrichLimit) ?? 10));

  let imported = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const list = await auth.stravaApiRequest(
      userId,
      `/athlete/activities?per_page=50&page=${page}`
    );
    if (!Array.isArray(list) || list.length === 0) break;
    for (const item of list) {
      await repo.upsertActivity(userId, mapStravaActivity(item, userId));
      imported += 1;
    }
    if (list.length < 50) break;
  }

  let enriched = 0;
  if (enrichLimit > 0) {
    const needing = await repo.listActivitiesNeedingDetail(userId, enrichLimit);
    for (const act of needing) {
      try {
        await enrichActivityDetail(userId, act.id);
        enriched += 1;
      } catch (e) {
        console.warn("[strava] enrich", act.id, e?.message || e);
      }
    }
  }

  await repo.touchSyncedAt(userId);
  return {
    imported,
    enriched,
    last_synced_at: new Date().toISOString(),
  };
}

export async function handleCallback(code, state) {
  const userId = auth.resolveUserIdFromState(state);
  if (!code) {
    return auth.feRedirectUrl({ error: "missing_code" });
  }
  try {
    await auth.exchangeCodeAndSave(userId, code);
    await syncActivities(userId, { enrichLimit: 5 });
    return auth.feRedirectUrl({ connected: "1" });
  } catch (e) {
    const msg = encodeURIComponent(e?.message || "connect_failed");
    return auth.feRedirectUrl({ error: msg });
  }
}

export async function disconnect(userId) {
  await repo.deleteConnection(userId);
  return { ok: true };
}

export async function listActivities(userId, query = {}) {
  const limit = query.limit ? Number(query.limit) : 40;
  return repo.listActivities(userId, { limit });
}

/**
 * @param {string|number} userId
 * @param {string} activityId
 * @param {{ enrich?: boolean }} [opts]
 */
export async function getActivity(userId, activityId, opts = {}) {
  const doEnrich = opts.enrich !== false;
  let detailed = await repo.findActivityDetailed(userId, activityId);
  if (!detailed?.activity) throw new NotFoundError("Aktivitas Strava tidak ditemukan.");

  const needsDetail = !detailed.activity.detail_synced_at;
  const needsStreams = !detailed.activity.streams_synced_at;
  if (doEnrich && (needsDetail || needsStreams)) {
    try {
      detailed = await enrichActivityDetail(userId, activityId);
    } catch (e) {
      console.warn("[strava] getActivity enrich:", e?.message || e);
      // return what we have
      detailed = await repo.findActivityDetailed(userId, activityId);
    }
  }
  if (!detailed?.activity) throw new NotFoundError("Aktivitas Strava tidak ditemukan.");
  return detailed;
}
