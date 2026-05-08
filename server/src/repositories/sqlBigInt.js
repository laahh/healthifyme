/**
 * @param {unknown} id
 * @returns {bigint | null}
 */
export function parseBigIntId(id) {
  const raw = String(id ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}
