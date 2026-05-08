import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Password defaultnya sama dengan SID; lookup SID case-insensitive,
 * jadi kita coba variasi kapitalisasi terhadap bcrypt.
 */
export async function verifyPasswordForSid(inputPassword, canonicalSidFromDb, hash) {
  const pwd = String(inputPassword ?? "").trim();
  const sid = String(canonicalSidFromDb ?? "").trim();
  const variants = [
    pwd,
    sid,
    pwd.toUpperCase(),
    sid.toUpperCase(),
    pwd.toLowerCase(),
    sid.toLowerCase(),
  ];
  const tried = new Set();
  for (const v of variants) {
    if (!v || tried.has(v)) continue;
    tried.add(v);
    if (await bcrypt.compare(v, hash)) return true;
  }
  return false;
}
