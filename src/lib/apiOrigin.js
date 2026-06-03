/**
 * Origin backend saja (tanpa trailing slash).
 * Jika VITE_API_URL diakhiri `/api` atau `/api/v1`, path digabung client jadi .../api/api/v1/... → nginx sering 404.
 */
export function getApiOrigin() {
  const b = import.meta.env.VITE_API_URL;
  let s = typeof b === "string" ? b.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "") : "";
  const lower = () => s.toLowerCase();
  while (lower().endsWith("/api/v1")) {
    s = s.slice(0, -"/api/v1".length).replace(/\/+$/, "");
  }
  while (lower().endsWith("/api")) {
    s = s.slice(0, -"/api".length).replace(/\/+$/, "");
  }
  return s;
}

/**
 * Prefix path API (default /api/v1). Override jarang: mis. proxy hanya /v1.
 */
export function getApiPathPrefix() {
  const p = import.meta.env.VITE_API_PATH_PREFIX;
  const s = typeof p === "string" ? p.trim().replace(/\/+$/, "") : "";
  if (!s) return "/api/v1";
  return s.startsWith("/") ? s : `/${s}`;
}

function isPrivateOrLocalHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (/^\[?[\da-f:]+\]?$/i.test(h) && h.includes(":")) return true; // IPv6 sederhana
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true; // IPv4
  return false;
}

/**
 * Daftar origin untuk dicoba (urutan: env dulu, lalu varian www/apex).
 * Membantu APK saat VITE_API_URL=apex tapi Nginx hanya mem-proxy API untuk host www (atau sebaliknya).
 */
export function getApiOriginsToTry() {
  const primary = getApiOrigin();
  if (!primary) return [];
  const list = [primary];
  try {
    const u = new URL(primary);
    if (isPrivateOrLocalHost(u.hostname) || !u.hostname.includes(".")) {
      return list;
    }
    if (u.hostname.startsWith("www.")) {
      const apexHost = u.hostname.slice(4);
      const alt = `${u.protocol}//${apexHost}${u.port ? `:${u.port}` : ""}`;
      if (!list.includes(alt)) list.push(alt);
    } else {
      const alt = `${u.protocol}//www.${u.hostname}${u.port ? `:${u.port}` : ""}`;
      if (!list.includes(alt)) list.push(alt);
    }
  } catch {
    /* ignore */
  }
  return list;
}
