import fs from "fs";
import pg from "pg";
import { isMcuPostgresConfigured, env } from "../src/config/env.js";
import { ensurePgSshTunnel, closePgSshTunnel } from "../src/services/sshTunnel.service.js";

async function main() {
  console.log("configured", isMcuPostgresConfigured());
  console.log("pkey_exists", fs.existsSync(env.SSH_PKEY));
  if (!isMcuPostgresConfigured()) process.exit(2);

  const ep = await ensurePgSshTunnel();
  console.log("tunnel_ok", `${ep.host}:${ep.port}`);

  const client = new pg.Client({
    host: ep.host,
    port: ep.port,
    database: env.PG_SSH_DATABASE,
    user: env.PG_SSH_USER,
    password: env.PG_SSH_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const zero = await client.query(`SELECT * FROM bcsid.mv_ftw_mcu LIMIT 0`);
  const fields = zero.fields.map((f) => f.name);
  console.log("field_count", fields.length);
  console.log("columns", fields.join("|"));

  const kinds = await client.query(
    `SELECT c.relkind::text AS relkind, n.nspname, c.relname
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'bcsid' AND c.relname ILIKE '%mcu%'`
  );
  console.log("relkinds", JSON.stringify(kinds.rows));

  const cnt = await client.query(`SELECT COUNT(*)::int AS c FROM bcsid.mv_ftw_mcu`);
  console.log("row_count", cnt.rows[0].c);

  await client.end();
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
