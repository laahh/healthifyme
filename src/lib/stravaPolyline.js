import polyline from "@mapbox/polyline";

/**
 * Decode Google/Strava encoded polyline to [lat, lng] pairs for Leaflet.
 * @param {string|null|undefined} encoded
 * @returns {[number, number][]}
 */
export function decodeStravaPolyline(encoded) {
  if (!encoded || typeof encoded !== "string") return [];
  try {
    const pairs = polyline.decode(encoded);
    return pairs
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([lat, lng]) => [Number(lat), Number(lng)]);
  } catch {
    return [];
  }
}

/**
 * @param {{ map_polyline?: string|null, map_summary_polyline?: string|null }} activity
 * @returns {[number, number][]}
 */
export function activityRouteLatLngs(activity) {
  if (!activity) return [];
  const full = decodeStravaPolyline(activity.map_polyline);
  if (full.length >= 2) return full;
  return decodeStravaPolyline(activity.map_summary_polyline);
}
