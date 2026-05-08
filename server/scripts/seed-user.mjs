/**
 * Buat / perbarui satu baris employee_profiles.
 * Login: username = SID (kode_sid), password = SID yang sama (disimpan bcrypt).
 *
 * Usage:
 *   npm run seed:user -- --sid=C5BXK
 *   npm run seed:user -- --sid=C5BXK --id=1735689600
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] || fallback;
}

const sid = arg("--sid", "").trim();
const idRaw = arg("--id", "").trim();

if (!sid) {
  console.error("Usage: node scripts/seed-user.mjs --sid=SID [--id=bigint_employee_id]");
  process.exit(1);
}

const rounds = 12;
const passwordHash = bcrypt.hashSync(sid, rounds);
const empId = idRaw ? BigInt(idRaw) : BigInt(Math.floor(Date.now() / 1000));

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "health_app",
  waitForConnections: true,
  connectionLimit: 2,
});

async function main() {
  await pool.execute(
    `INSERT INTO employee_profiles (
       id, kode_sid, nama, nama_perusahaan, foto,
       password_hash, membership_tier, avatar_url
     )
     VALUES (?, ?, ?, 'Dev Company', '', ?, 'MEMBER', '')
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       updated_at = CURRENT_TIMESTAMP(3)`,
    [empId, sid, `User ${sid}`, passwordHash]
  );

  console.log("OK — employee siap login:");
  console.log("  username (SID):", sid);
  console.log("  password:       ", sid, "(sama dengan SID)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
