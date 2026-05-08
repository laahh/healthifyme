import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SID_DOMAIN = process.env.SID_DOMAIN || "sid.internal";
const INPUT_FILE = process.env.INPUT_FILE || "./auth-users.csv";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`Input file not found: ${INPUT_FILE}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeSid(value) {
  return String(value || "").trim().toUpperCase();
}

function sidToEmail(sid) {
  return `${sid.toLowerCase()}@${SID_DOMAIN}`;
}

const csvText = fs.readFileSync(INPUT_FILE, "utf8");
const rows = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

let created = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  const sid = normalizeSid(row.kode_sid);
  const password = String(row.password || "").trim();

  if (!sid || !password) {
    console.log(`SKIP invalid row (kode_sid/password kosong): ${JSON.stringify(row)}`);
    skipped += 1;
    continue;
  }

  const email = sidToEmail(sid);

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { sid },
    });

    if (error) {
      if (/already registered|already exists|duplicate/i.test(error.message)) {
        console.log(`SKIP exists: ${sid} (${email})`);
        skipped += 1;
      } else {
        console.log(`FAIL ${sid}: ${error.message}`);
        failed += 1;
      }
      continue;
    }

    console.log(`OK created: ${sid} -> ${data.user?.id || "(no id returned)"}`);
    created += 1;
  } catch (err) {
    console.log(`FAIL ${sid}: ${err instanceof Error ? err.message : String(err)}`);
    failed += 1;
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Created: ${created}`);
console.log(`Skipped: ${skipped}`);
console.log(`Failed : ${failed}`);
