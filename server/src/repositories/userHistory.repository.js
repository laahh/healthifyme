import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

function parsePayload(val) {
  if (val == null) return {};
  if (typeof val === "object") return val;
  try {
    return JSON.parse(String(val));
  } catch {
    return {};
  }
}

/**
 * @param {string} userId
 * @param {number} limit
 */
export async function listHistoryByUserId(userId, limit = 200) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const pool = getPool();
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const [rows] = await pool.execute(
    `SELECT item_id, payload, created_at
     FROM user_history
     WHERE user_id = :userId
     ORDER BY created_at DESC
     LIMIT ${cap}`,
    { userId: uid }
  );
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    item_id: row.item_id,
    payload: parsePayload(row.payload),
    created_at: row.created_at,
  }));
}

/**
 * @param {string} userId
 * @param {string} itemId
 * @param {object} payload
 * @param {Date | number | string} [createdAt]
 */
/**
 * @param {import('mysql2/promise').PoolConnection | null} [conn]
 */
export async function upsertHistoryItem(userId, itemId, payload, createdAt, conn = null) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;
  const executor = conn ?? getPool();
  const created =
    createdAt != null ? new Date(createdAt) : new Date();
  const iso = Number.isNaN(created.getTime()) ? new Date() : created;

  await executor.execute(
    `INSERT INTO user_history (user_id, item_id, payload, created_at)
     VALUES (:userId, :itemId, CAST(:payload AS JSON), :createdAt)
     ON DUPLICATE KEY UPDATE
       payload = VALUES(payload),
       created_at = VALUES(created_at),
       updated_at = CURRENT_TIMESTAMP(3)`,
    {
      userId: uid,
      itemId: String(itemId),
      payload: JSON.stringify(payload ?? {}),
      createdAt: iso,
    }
  );
}

/**
 * @param {import('mysql2/promise').PoolConnection | null} [conn]
 */
export async function deleteHistoryItem(userId, itemId, conn = null) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;
  const executor = conn ?? getPool();
  await executor.execute(
    `DELETE FROM user_history WHERE user_id = :userId AND item_id = :itemId`,
    { userId: uid, itemId: String(itemId) }
  );
}
