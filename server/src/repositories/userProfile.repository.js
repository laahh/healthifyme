import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

function parseAddress(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(String(val));
  } catch {
    return null;
  }
}

export async function findProfileByUserId(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT user_id, name, phone, email, address, updated_at
     FROM user_profiles WHERE user_id = :userId LIMIT 1`,
    { userId: uid }
  );
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) return null;
  return {
    ...row,
    user_id: String(row.user_id),
    address: parseAddress(row.address),
  };
}

/**
 * @param {string} userId
 * @param {{ name?: string, phone?: string, email?: string, address?: object | null }} data
 */
export async function upsertProfile(userId, data) {
  const uid = parseBigIntId(userId);
  if (uid == null) return;
  const pool = getPool();
  const name = data.name ?? "";
  const phone = data.phone ?? "";
  const email = data.email ?? "";
  const addressJson =
    data.address === undefined || data.address === null
      ? null
      : JSON.stringify(data.address);

  await pool.execute(
    `INSERT INTO user_profiles (user_id, name, phone, email, address)
     VALUES (:userId, :name, :phone, :email, CAST(:address AS JSON))
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       phone = VALUES(phone),
       email = VALUES(email),
       address = VALUES(address),
       updated_at = CURRENT_TIMESTAMP(3)`,
    {
      userId: uid,
      name,
      phone,
      email,
      address: addressJson,
    }
  );
}
