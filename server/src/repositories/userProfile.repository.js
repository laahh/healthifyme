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

function mapProfileRow(row) {
  if (!row) return null;
  return {
    ...row,
    user_id: String(row.user_id),
    address: parseAddress(row.address),
    height_cm: row.height_cm != null ? Number(row.height_cm) : null,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
  };
}

export async function findProfileByUserId(userId) {
  const uid = parseBigIntId(userId);
  if (uid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT user_id, name, phone, email, address,
            gender, height_cm, weight_kg, activity_level, exercise_preferences, food_restrictions, timezone,
            updated_at
     FROM user_profiles WHERE user_id = :userId LIMIT 1`,
    { userId: uid }
  );
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  return mapProfileRow(row);
}

/**
 * @param {string} userId
 * @param {Record<string, unknown>} data
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

  const gender = data.gender !== undefined && data.gender !== null ? String(data.gender) : null;
  const height_cm = data.height_cm !== undefined && data.height_cm !== null ? Number(data.height_cm) : null;
  const weight_kg = data.weight_kg !== undefined && data.weight_kg !== null ? Number(data.weight_kg) : null;
  const activity_level =
    data.activity_level !== undefined && data.activity_level !== null ? String(data.activity_level) : null;
  const exercise_preferences =
    data.exercise_preferences !== undefined && data.exercise_preferences != null
      ? String(data.exercise_preferences)
      : null;
  const food_restrictions =
    data.food_restrictions !== undefined && data.food_restrictions != null
      ? String(data.food_restrictions)
      : null;
  const timezone =
    data.timezone !== undefined && data.timezone != null ? String(data.timezone).slice(0, 64) : null;

  await pool.execute(
    `INSERT INTO user_profiles (
      user_id, name, phone, email, address,
      gender, height_cm, weight_kg, activity_level, exercise_preferences, food_restrictions, timezone
    ) VALUES (
      :userId, :name, :phone, :email, CAST(:address AS JSON),
      :gender, :height_cm, :weight_kg, :activity_level, :exercise_preferences, :food_restrictions, :timezone
    )
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       phone = VALUES(phone),
       email = VALUES(email),
       address = VALUES(address),
       gender = COALESCE(VALUES(gender), gender),
       height_cm = COALESCE(VALUES(height_cm), height_cm),
       weight_kg = COALESCE(VALUES(weight_kg), weight_kg),
       activity_level = COALESCE(VALUES(activity_level), activity_level),
       exercise_preferences = COALESCE(VALUES(exercise_preferences), exercise_preferences),
       food_restrictions = COALESCE(VALUES(food_restrictions), food_restrictions),
       timezone = COALESCE(VALUES(timezone), timezone),
       updated_at = CURRENT_TIMESTAMP(3)`,
    {
      userId: uid,
      name,
      phone,
      email,
      address: addressJson,
      gender,
      height_cm,
      weight_kg,
      activity_level,
      exercise_preferences,
      food_restrictions,
      timezone,
    }
  );
}
