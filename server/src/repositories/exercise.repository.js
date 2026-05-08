import { getPool } from "../config/database.js";
import { env } from "../config/env.js";

/**
 * @param {unknown} v
 * @returns {number}
 */
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * Skema `exercise_instructions` berbeda-beda (sort_order vs step_order, body vs instruction_text, …).
 * Query pertama yang berhasil di-cache untuk request berikutnya.
 * @type {string | null}
 */
let cachedInstructionSql = null;

/** @type {string | null} */
let cachedExerciseListSql = null;
/** @type {string | null} */
let cachedExerciseByIdSql = null;

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isUnknownColumnError(err) {
  if (!err || typeof err !== "object") return false;
  if ("code" in err && err.code === "ER_BAD_FIELD_ERROR") return true;
  if ("errno" in err && err.errno === 1054) return true;
  return false;
}

/**
 * @param {string | undefined} raw
 * @returns {string | null}
 */
function sanitizeSqlIdentifier(raw) {
  const t = String(raw ?? "").trim();
  if (!t || t.length > 64) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)) return null;
  return t;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} exerciseId
 */
async function selectInstructions(pool, exerciseId) {
  if (cachedInstructionSql) {
    const [rows] = await pool.query(cachedInstructionSql, [exerciseId]);
    return rows || [];
  }

  const customOrder = sanitizeSqlIdentifier(env.EXERCISE_INSTRUCTION_ORDER_COLUMN);
  const customText = sanitizeSqlIdentifier(env.EXERCISE_INSTRUCTION_TEXT_COLUMN);
  const customPair =
    customOrder && customText ? ([customOrder, customText]) : null;

  const candidates = [
    ...(customPair ? [customPair] : []),
    ["step_no", "instruction"],
    ["sort_order", "body"],
    ["step_order", "body"],
    ["sort_order", "instruction_text"],
    ["step_order", "instruction_text"],
    ["step", "instruction"],
    ["order", "body"],
    ["order", "instruction_text"],
    ["display_order", "body"],
    ["instruction_order", "instruction_text"],
    ["line_number", "body"],
    ["step_number", "instruction_text"],
    ["idx", "text"],
  ];

  let lastErr = null;
  for (const [orderCol, textCol] of candidates) {
    const sql = `SELECT \`${orderCol}\` AS stepOrder, \`${textCol}\` AS instrBody
     FROM exercise_instructions
     WHERE exercise_id = ?
     ORDER BY \`${orderCol}\` ASC`;
    try {
      const [rows] = await pool.query(sql, [exerciseId]);
      cachedInstructionSql = sql;
      return rows || [];
    } catch (err) {
      if (isUnknownColumnError(err)) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }

  const hint =
    "Setel di .env server: EXERCISE_INSTRUCTION_ORDER_COLUMN dan EXERCISE_INSTRUCTION_TEXT_COLUMN " +
    "(nama kolom yang ada di tabel exercise_instructions), lalu restart server.";
  const lastMsg = lastErr && typeof lastErr === "object" && "message" in lastErr ? String(lastErr.message) : "";
  throw new Error(lastMsg ? `${hint} Detail: ${lastMsg}` : hint);
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} lim
 * @param {number} off
 */
async function selectExercisesPage(pool, lim, off) {
  if (cachedExerciseListSql) {
    const [exRows] = await pool.query(cachedExerciseListSql, [lim, off]);
    return exRows || [];
  }
  const withCode = `SELECT id, exercise_code AS exerciseCode, name, gif_url AS gifUrl
     FROM exercises ORDER BY id ASC LIMIT ? OFFSET ?`;
  const withoutCode = `SELECT id, name, gif_url AS gifUrl
     FROM exercises ORDER BY id ASC LIMIT ? OFFSET ?`;
  try {
    const [exRows] = await pool.query(withCode, [lim, off]);
    cachedExerciseListSql = withCode;
    return exRows || [];
  } catch (err) {
    if (isUnknownColumnError(err)) {
      const [exRows] = await pool.query(withoutCode, [lim, off]);
      cachedExerciseListSql = withoutCode;
      return exRows || [];
    }
    throw err;
  }
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} exerciseId
 */
async function selectExerciseBaseRow(pool, exerciseId) {
  if (cachedExerciseByIdSql) {
    const [exRows] = await pool.query(cachedExerciseByIdSql, [exerciseId]);
    return exRows?.[0] ?? null;
  }
  const withCode = `SELECT id, exercise_code AS exerciseCode, name, gif_url AS gifUrl FROM exercises WHERE id = ? LIMIT 1`;
  const withoutCode = `SELECT id, name, gif_url AS gifUrl FROM exercises WHERE id = ? LIMIT 1`;
  try {
    const [exRows] = await pool.query(withCode, [exerciseId]);
    cachedExerciseByIdSql = withCode;
    return exRows?.[0] ?? null;
  } catch (err) {
    if (isUnknownColumnError(err)) {
      const [exRows] = await pool.query(withoutCode, [exerciseId]);
      cachedExerciseByIdSql = withoutCode;
      return exRows?.[0] ?? null;
    }
    throw err;
  }
}

/**
 * @param {import('mysql2/promise').RowDataPacket[]} rows
 * @param {string} keyField
 * @returns {Map<number, Array<{ id: number; name: string }>>}
 */
function groupPairs(rows, keyField) {
  /** @type {Map<number, Array<{ id: number; name: string }>>} */
  const m = new Map();
  for (const r of rows) {
    const eid = toInt(r[keyField]);
    if (!eid) continue;
    const id = toInt(r.id);
    const name = String(r.name ?? "");
    if (!m.has(eid)) m.set(eid, []);
    m.get(eid).push({ id, name });
  }
  return m;
}

/**
 * Ringkasan latihan untuk list (tanpa instruksi panjang).
 * @param {number} limit
 * @param {number} offset
 */
export async function listExercisesSummary(limit, offset) {
  const pool = getPool();
  const lim = Math.min(Math.max(limit, 1), 100);
  const off = Math.max(offset, 0);

  const exRows = await selectExercisesPage(pool, lim, off);
  /** @type {Array<{ id: number; exerciseCode: string | null; name: string; gifUrl: string | null }>} */
  const exercises = (exRows || []).map((r) => ({
    id: toInt(r.id),
    exerciseCode:
      r.exerciseCode != null && String(r.exerciseCode).trim() !== "" ? String(r.exerciseCode) : null,
    name: String(r.name ?? ""),
    gifUrl: r.gifUrl != null && r.gifUrl !== "" ? String(r.gifUrl) : null,
  }));
  if (!exercises.length) return [];

  const ids = exercises.map((e) => e.id);
  const placeholders = ids.map(() => "?").join(",");

  const [targets] = await pool.query(
    `SELECT etm.exercise_id AS exerciseId, m.id, m.name
     FROM exercise_target_muscles etm
     INNER JOIN muscles m ON m.id = etm.muscle_id
     WHERE etm.exercise_id IN (${placeholders})`,
    ids
  );
  const [secondaries] = await pool.query(
    `SELECT esm.exercise_id AS exerciseId, m.id, m.name
     FROM exercise_secondary_muscles esm
     INNER JOIN muscles m ON m.id = esm.muscle_id
     WHERE esm.exercise_id IN (${placeholders})`,
    ids
  );
  const [parts] = await pool.query(
    `SELECT ebp.exercise_id AS exerciseId, bp.id, bp.name
     FROM exercise_body_parts ebp
     INNER JOIN body_parts bp ON bp.id = ebp.body_part_id
     WHERE ebp.exercise_id IN (${placeholders})`,
    ids
  );
  const [eqs] = await pool.query(
    `SELECT ee.exercise_id AS exerciseId, eq.id, eq.name
     FROM exercise_equipments ee
     INNER JOIN equipments eq ON eq.id = ee.equipment_id
     WHERE ee.exercise_id IN (${placeholders})`,
    ids
  );

  const tm = groupPairs(targets, "exerciseId");
  const sm = groupPairs(secondaries, "exerciseId");
  const bp = groupPairs(parts, "exerciseId");
  const eq = groupPairs(eqs, "exerciseId");

  return exercises.map((e) => ({
    ...e,
    targetMuscles: tm.get(e.id) ?? [],
    secondaryMuscles: sm.get(e.id) ?? [],
    bodyParts: bp.get(e.id) ?? [],
    equipments: eq.get(e.id) ?? [],
  }));
}

/**
 * @param {number} exerciseId
 */
export async function getExerciseById(exerciseId) {
  const pool = getPool();
  const row = await selectExerciseBaseRow(pool, exerciseId);
  if (!row) return null;

  const id = toInt(row.id);
  const base = {
    id,
    exerciseCode:
      row.exerciseCode != null && String(row.exerciseCode).trim() !== ""
        ? String(row.exerciseCode)
        : null,
    name: String(row.name ?? ""),
    gifUrl: row.gifUrl != null && row.gifUrl !== "" ? String(row.gifUrl) : null,
  };

  const [targets] = await pool.query(
    `SELECT m.id, m.name FROM exercise_target_muscles etm
     INNER JOIN muscles m ON m.id = etm.muscle_id WHERE etm.exercise_id = ? ORDER BY m.name`,
    [id]
  );
  const [secondaries] = await pool.query(
    `SELECT m.id, m.name FROM exercise_secondary_muscles esm
     INNER JOIN muscles m ON m.id = esm.muscle_id WHERE esm.exercise_id = ? ORDER BY m.name`,
    [id]
  );
  const [parts] = await pool.query(
    `SELECT bp.id, bp.name FROM exercise_body_parts ebp
     INNER JOIN body_parts bp ON bp.id = ebp.body_part_id WHERE ebp.exercise_id = ? ORDER BY bp.name`,
    [id]
  );
  const [eqs] = await pool.query(
    `SELECT eq.id, eq.name FROM exercise_equipments ee
     INNER JOIN equipments eq ON eq.id = ee.equipment_id WHERE ee.exercise_id = ? ORDER BY eq.name`,
    [id]
  );
  const instr = await selectInstructions(pool, id);

  return {
    ...base,
    targetMuscles: (targets || []).map((r) => ({ id: toInt(r.id), name: String(r.name ?? "") })),
    secondaryMuscles: (secondaries || []).map((r) => ({
      id: toInt(r.id),
      name: String(r.name ?? ""),
    })),
    bodyParts: (parts || []).map((r) => ({ id: toInt(r.id), name: String(r.name ?? "") })),
    equipments: (eqs || []).map((r) => ({ id: toInt(r.id), name: String(r.name ?? "") })),
    instructions: (instr || []).map((r) => ({
      stepOrder: toInt(r.stepOrder),
      body: String(r.instrBody ?? r.body ?? ""),
    })),
  };
}
