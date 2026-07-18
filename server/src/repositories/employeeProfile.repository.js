import { getPool } from "../config/database.js";
import { parseBigIntId } from "./sqlBigInt.js";

const EMPLOYEE_COLUMNS = `id, nik, foto, nama, site, usia, divisi, mainkon, dedikasi, dept_dic, kategori,
  kode_sid, masa_kerja, departement, work_permit, dept_mainkon, id_perusahaan,
  level_jabatan, status_permit, dic_perusahaan, id_work_permit, nama_perusahaan,
  status_karyawan, kategori_karyawan, jabatan_fungsional, jabatan_struktural,
  membership_tier, avatar_url`;

/**
 * Untuk login: sertakan hash password.
 * @param {string} sid
 */
export async function findEmployeeWithCredentialsByKodeSid(sid) {
  const s = String(sid || "").trim();
  if (!s) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${EMPLOYEE_COLUMNS}, password_hash
     FROM employee_profiles WHERE LOWER(kode_sid) = LOWER(:sid) LIMIT 1`,
    { sid: s }
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * @param {string | number} id
 */
export async function findEmployeeById(id) {
  const bid = parseBigIntId(id);
  if (bid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${EMPLOYEE_COLUMNS}
     FROM employee_profiles WHERE id = :id LIMIT 1`,
    { id: bid }
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * @param {string | number} id
 */
export async function findEmployeeWithCredentialsById(id) {
  const bid = parseBigIntId(id);
  if (bid == null) return null;
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${EMPLOYEE_COLUMNS}, password_hash
     FROM employee_profiles WHERE id = :id LIMIT 1`,
    { id: bid }
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * @param {string | number} id
 * @param {string} passwordHash
 */
export async function updatePasswordHashById(id, passwordHash) {
  const bid = parseBigIntId(id);
  const hash = String(passwordHash || "").trim();
  if (bid == null || !hash) return false;
  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE employee_profiles SET password_hash = :hash WHERE id = :id LIMIT 1`,
    { id: bid, hash }
  );
  return Boolean(result?.affectedRows);
}
