import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

function mapCatalog(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    brand: row.brand || "",
    calories: Number(row.calories) || 0,
    protein_g: row.protein_g != null ? Number(row.protein_g) : null,
    fats_g: row.fats_g != null ? Number(row.fats_g) : null,
    carbs_g: row.carbs_g != null ? Number(row.carbs_g) : null,
    serving_label: row.serving_label || "100 gr",
    source_label: row.source_label || "",
    is_popular: Boolean(row.is_popular),
  };
}

function mapRecent(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    client_item_id: row.client_item_id || "",
    food_name: row.food_name || "",
    meal_type: row.meal_type || null,
    source_type: row.source_type || "photo",
    barcode: row.barcode || "",
    serving_label: row.serving_label || "",
    calories: row.total_calories != null ? Number(row.total_calories) : 0,
    protein_g: row.protein_g != null ? Number(row.protein_g) : null,
    fats_g: row.fats_g != null ? Number(row.fats_g) : null,
    carbs_g: row.carbs_g != null ? Number(row.carbs_g) : null,
    created_at: row.created_at,
  };
}

/**
 * @param {{ q?: string, popular?: boolean, limit?: number }} opts
 */
export async function listCatalog(opts = {}) {
  const pool = getPool();
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 40));
  const params = {};
  let where = "1=1";
  if (opts.popular) {
    where += " AND is_popular = 1";
  }
  if (opts.q) {
    where += " AND (name LIKE :q OR brand LIKE :q OR source_label LIKE :q)";
    params.q = `%${String(opts.q).trim()}%`;
  }
  const [rows] = await pool.execute(
    `SELECT * FROM food_catalog
     WHERE ${where}
     ORDER BY sort_order ASC, name ASC
     LIMIT ${limit}`,
    params
  );
  return (Array.isArray(rows) ? rows : []).map(mapCatalog);
}

export async function listRecent(userId, limit = 20) {
  const uid = parseBigIntId(userId);
  if (uid == null) return [];
  const lim = Math.min(50, Math.max(1, Number(limit) || 20));
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, client_item_id, food_name, meal_type, source_type, barcode, serving_label,
            total_calories, protein_g, fats_g, carbs_g, created_at
     FROM food_analyses
     WHERE user_id = :uid
     ORDER BY created_at DESC
     LIMIT ${lim}`,
    { uid }
  );
  return (Array.isArray(rows) ? rows : []).map(mapRecent);
}

export async function findCatalogById(id) {
  const cid = parseBigIntId(id);
  if (cid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(`SELECT * FROM food_catalog WHERE id = :cid LIMIT 1`, {
    cid,
  });
  return mapCatalog(rows?.[0]);
}
