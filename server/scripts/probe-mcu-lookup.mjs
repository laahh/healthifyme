import { isMcuPostgresConfigured } from "../src/config/env.js";
import { findLatestMcuBySid, mapMcuRowToUi, resetMcuPgMetaCache } from "../src/repositories/mcuPg.repository.js";
import { closePgSshTunnel } from "../src/services/sshTunnel.service.js";
import pg from "pg";
import { env } from "../src/config/env.js";
import { ensurePgSshTunnel } from "../src/services/sshTunnel.service.js";

async function main() {
  console.log("configured", isMcuPostgresConfigured());
  resetMcuPgMetaCache();

  const ep = await ensurePgSshTunnel();
  const client = new pg.Client({
    host: ep.host,
    port: ep.port,
    database: env.PG_SSH_DATABASE,
    user: env.PG_SSH_USER,
    password: env.PG_SSH_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const one = await client.query(
    `SELECT kode_sid FROM bcsid.mv_ftw_mcu WHERE kode_sid IS NOT NULL AND TRIM(kode_sid) <> '' LIMIT 1`
  );
  await client.end();

  const sid = one.rows[0]?.kode_sid;
  console.log("sample_sid_present", Boolean(sid));
  if (!sid) {
    await closePgSshTunnel();
    process.exit(3);
  }

  const row = await findLatestMcuBySid(String(sid));
  const mapped = mapMcuRowToUi(row);
  console.log("row_found", Boolean(row));
  console.log("mapped_keys", mapped ? Object.keys(mapped).join("|") : "");
  console.log("has_tanggal", Boolean(mapped?.tanggal));
  console.log("has_lokasi", Boolean(mapped?.lokasi));
  await closePgSshTunnel();
}

main().catch(async (e) => {
  console.error("FAIL", e?.message || e);
  try {
    await closePgSshTunnel();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
