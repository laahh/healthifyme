import pg from "pg";
import { env } from "../config/env.js";
import { ensurePgSshTunnel } from "../services/sshTunnel.service.js";

const { Pool } = pg;

const MCU_SCHEMA = "bcsid";
const MCU_TABLE = "mv_ftw_mcu";
const MCU_FQN = `${MCU_SCHEMA}.${MCU_TABLE}`;

/** @type {import("pg").Pool | null} */
let pool = null;

/** @type {{ sidColumn: string, dateColumn: string | null, columns: string[] } | null} */
let metaCache = null;

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function getPool() {
  const endpoint = await ensurePgSshTunnel();
  if (pool) return pool;
  pool = new Pool({
    host: endpoint.host,
    port: endpoint.port,
    database: String(env.PG_SSH_DATABASE || "").trim(),
    user: String(env.PG_SSH_USER || "").trim(),
    password: String(env.PG_SSH_PASSWORD || ""),
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    // RDS biasanya mewajibkan SSL (pg_hba "no encryption" jika off)
    ssl: { rejectUnauthorized: false },
  });
  pool.on("error", () => {
    /* idle client errors — recreate on next use */
    pool = null;
  });
  return pool;
}

/**
 * @param {string[]} columns
 */
function pickSidColumn(columns) {
  const configured = String(env.MCU_PG_SID_COLUMN || "").trim();
  if (configured) {
    const hit = columns.find((c) => c.toLowerCase() === configured.toLowerCase());
    if (hit) return hit;
    return configured;
  }
  const prefs = ["kode_sid", "sid", "SID", "employee_sid", "nik_sid", "username"];
  for (const p of prefs) {
    const hit = columns.find((c) => c.toLowerCase() === p.toLowerCase());
    if (hit) return hit;
  }
  const fuzzy = columns.find((c) => /sid/i.test(c) && !/resid/i.test(c));
  if (fuzzy) return fuzzy;
  throw new Error(`Kolom SID tidak ditemukan di ${MCU_FQN}. Set MCU_PG_SID_COLUMN.`);
}

/**
 * @param {string[]} columns
 */
function pickDateColumn(columns) {
  const configured = String(env.MCU_PG_DATE_COLUMN || "").trim();
  if (configured) {
    const hit = columns.find((c) => c.toLowerCase() === configured.toLowerCase());
    if (hit) return hit;
    return configured;
  }
  const prefs = [
    "tanggal_mulai",
    "tanggal_mcu",
    "tgl_mcu",
    "tanggal",
    "mcu_date",
    "exam_date",
    "tanggal_update",
    "tanggal_input",
    "created_at",
    "updated_at",
  ];
  for (const p of prefs) {
    const hit = columns.find((c) => c.toLowerCase() === p.toLowerCase());
    if (hit) return hit;
  }
  const fuzzy = columns.find((c) => /tanggal_mulai|tanggal|tgl|date|_at$/i.test(c));
  return fuzzy || null;
}

async function loadMeta(client) {
  if (metaCache) return metaCache;

  let columns = [];
  try {
    const { rows } = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [MCU_SCHEMA, MCU_TABLE]
    );
    columns = rows.map((r) => String(r.column_name));
  } catch {
    columns = [];
  }

  // Materialized view sering tidak muncul di information_schema.columns untuk role terbatas.
  if (!columns.length) {
    const zero = await client.query(`SELECT * FROM ${MCU_SCHEMA}.${MCU_TABLE} LIMIT 0`);
    columns = (zero.fields || []).map((f) => String(f.name));
  }

  if (!columns.length) {
    throw new Error(`View/tabel ${MCU_FQN} tidak ditemukan atau tanpa kolom.`);
  }

  metaCache = {
    sidColumn: pickSidColumn(columns),
    dateColumn: pickDateColumn(columns),
    columns,
  };
  return metaCache;
}

/**
 * Ambil baris MCU terbaru untuk SID (case-insensitive).
 * @param {string} sid
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function findLatestMcuBySid(sid) {
  const s = String(sid || "").trim();
  if (!s) return null;

  const p = await getPool();
  const client = await p.connect();
  try {
    const meta = await loadMeta(client);
    const sidQ = quoteIdent(meta.sidColumn);
    let sql = `SELECT * FROM ${MCU_SCHEMA}.${MCU_TABLE} WHERE LOWER(TRIM(CAST(${sidQ} AS TEXT))) = LOWER(TRIM($1))`;
    if (meta.dateColumn) {
      sql += ` ORDER BY ${quoteIdent(meta.dateColumn)} DESC NULLS LAST`;
    }
    sql += ` LIMIT 1`;
    const { rows } = await client.query(sql, [s]);
    return rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Format array kondisi MCU (kritis / non-kritis) jadi teks terbaca.
 * Bentuk item: { nama_kondisi, note, is_yes, is_no, is_na }
 * @param {unknown} raw
 * @returns {string}
 */
export function formatKondisiList(raw) {
  let items = raw;
  if (typeof items === "string") {
    const t = items.trim();
    if (!t || t === "[]" || t === "null") return "";
    try {
      items = JSON.parse(t);
    } catch {
      // Sudah plain text
      if (t.startsWith("[{") || t.startsWith("{")) return "";
      return t;
    }
  }
  if (!Array.isArray(items) || items.length === 0) return "";

  const lines = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const name = String(it.nama_kondisi || it.nama || it.name || "").trim();
    if (!name) continue;

    const yes = Number(it.is_yes) === 1 || it.is_yes === true;
    const no = Number(it.is_no) === 1 || it.is_no === true;
    const na = Number(it.is_na) === 1 || it.is_na === true;
    let status = "";
    if (yes) status = "Ya";
    else if (no) status = "Tidak";
    else if (na) status = "N/A";

    const note = it.note != null && String(it.note).trim() !== "" ? String(it.note).trim() : "";
    if (status && note) lines.push(`${name}: ${status} (${note})`);
    else if (status) lines.push(`${name}: ${status}`);
    else if (note) lines.push(`${name}: ${note}`);
    else lines.push(name);
  }
  return lines.join("\n");
}

/**
 * Map baris Postgres → objek flat untuk UI McuContent.
 * @param {Record<string, unknown>} row
 */
export function mapMcuRowToUi(row) {
  if (!row || typeof row !== "object") return null;

  /** @type {Record<string, string>} */
  const aliases = {
    tanggal: "tanggal",
    tgl_mcu: "tanggal",
    tanggal_mcu: "tanggal",
    tanggal_mulai: "tanggal",
    mcu_date: "tanggal",
    exam_date: "tanggal",
    lokasi: "lokasi",
    location: "lokasi",
    tempat: "lokasi",
    nama_klinik: "lokasi",
    gdp: "GDP",
    gula_darah_puasa: "gulaDarahPuasa",
    gula_darah: "gulaDarahPuasa",
    kolesterol: "Kolesterol",
    kolesterol_total: "kolesterolTotal",
    imt: "IMT",
    bmi: "IMT",
    tekanan_darah: "tekananDarah",
    blood_pressure: "tekananDarah",
    sistol: "tekananDarah",
    hemoglobin: "hemoglobin",
    hb: "hemoglobin",
    sindrom_metabolik: "SindromMetabolik",
    framingham: "FraminghamScore",
    framingham_score: "FraminghamScore",
    catatan: "catatan",
    catatan_hasil: "catatan",
    keterangan: "catatan",
    notes: "catatan",
    nama_karyawan: "nama",
    paket_mcu: "paketMcu",
    perlu_followup: "perluFollowup",
    nama_dokter: "namaDokter",
    tanggal_kadaluarsa: "tanggalKadaluarsa",
    kode_mcu: "kodeMcu",
    url_pdf: "urlPdf",
  };

  /** @type {Record<string, unknown>} */
  const out = {};

  // Kondisi kritis / non-kritis: format khusus (bukan JSON mentah)
  const kritisText = formatKondisiList(row.kondisi_kritis ?? row.kondisiKritis);
  const nonKritisText = formatKondisiList(row.kondisi_non_kritis ?? row.kondisiNonKritis);
  if (kritisText) out.kondisiKritis = kritisText;
  if (nonKritisText) out.kondisiNonKritis = nonKritisText;

  for (const [rawKey, rawVal] of Object.entries(row)) {
    if (rawVal == null) continue;
    const lower = rawKey.toLowerCase();
    if (lower === "kondisi_kritis" || lower === "kondisikritis") continue;
    if (lower === "kondisi_non_kritis" || lower === "kondisinonkritis") continue;

    let str;
    if (typeof rawVal === "object" && rawVal instanceof Date) {
      str = rawVal.toISOString().slice(0, 10);
    } else if (typeof rawVal === "boolean") {
      str = rawVal ? "Ya" : "Tidak";
    } else if (typeof rawVal === "object") {
      try {
        str = JSON.stringify(rawVal);
      } catch {
        str = String(rawVal);
      }
    } else {
      str = String(rawVal).trim();
    }
    if (str === "" || str === "{}" || str === "[]" || str === "null") continue;

    const mapped = aliases[lower];
    if (mapped) {
      if (out[mapped] == null || String(out[mapped]).trim() === "") {
        out[mapped] = str;
      }
      continue;
    }

    if (/^(id|id_mcu|id_karyawan|id_hasil_raw|user_id|sid_document_id)$/i.test(rawKey)) {
      continue;
    }
    if (/^(kode_sid|sid)$/i.test(rawKey)) {
      out.sid = str;
      continue;
    }
    out[rawKey] = str;
  }

  // Combine BP if separate columns
  if (!out.tekananDarah) {
    const sys = row.sistol ?? row.systolic ?? row.td_sistol;
    const dia = row.diastol ?? row.diastolic ?? row.td_diastol;
    if (sys != null && dia != null) {
      out.tekananDarah = `${sys}/${dia}`;
    }
  }

  const hasValue = Object.values(out).some((v) => v != null && String(v).trim() !== "");
  return hasValue ? out : null;
}

export function resetMcuPgMetaCache() {
  metaCache = null;
}
