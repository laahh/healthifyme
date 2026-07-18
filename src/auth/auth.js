import usersFile from "../data/users.json";
import { AUTH_SESSION_KEY } from "../lib/storageKeys";
import {
  apiRequest,
  clearAuthToken,
  getAuthToken,
  isApiBackendEnabled,
  setAuthToken,
} from "../lib/apiClient";
import { getApiOriginsToTry, getApiPathPrefix } from "../lib/apiOrigin";
import { isSupabaseEnabled, supabase } from "../lib/supabaseClient";
import { hydrateUserDataFromCloud } from "../services/supabaseDataService";

const SID_EMAIL_DOMAIN = "sid.internal";

/** Data pengguna untuk disimpan di session (tanpa password). */
function toPublicUser(record) {
  if (!record) return null;
  const { password: _p, ...rest } = record;
  return rest;
}

export function getUsersFromStore() {
  const list = usersFile?.users;
  return Array.isArray(list) ? list : [];
}

/**
 * Cocokkan username & password dengan data di JSON.
 * @returns {object|null} user publik atau null
 */
export function authenticate(username, password) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");
  const found = getUsersFromStore().find(
    (row) => String(row.username || "").toLowerCase() === u && String(row.password || "") === p
  );
  return found ? toPublicUser(found) : null;
}

function sidToEmail(sid) {
  const normalizedSid = String(sid || "").trim().toLowerCase();
  if (!normalizedSid) return "";
  return `${normalizedSid}@${SID_EMAIL_DOMAIN}`;
}

function sidFromEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) return "";
  return e.split("@")[0] || "";
}

async function getEmployeeProfileBySid(sidHint, emailHint) {
  if (!isSupabaseEnabled || !supabase) return null;
  const sid = String(sidHint || "").trim() || sidFromEmail(emailHint);
  if (!sid) return null;
  const { data, error } = await supabase
    .from("employee_profiles")
    .select(
      "id, nik, foto, nama, site, usia, divisi, mainkon, dedikasi, dept_dic, kategori, kode_sid, masa_kerja, departement, work_permit, dept_mainkon, id_perusahaan, level_jabatan, status_permit, dic_perusahaan, id_work_permit, nama_perusahaan, status_karyawan, kategori_karyawan, jabatan_fungsional, jabatan_struktural"
    )
    .ilike("kode_sid", sid)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

function toSessionShapeFromSupabaseUser(user, profile = null) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const displayName =
    String(profile?.nama || "").trim() ||
    String(meta.name || meta.full_name || "").trim() ||
    String(user.email || "").split("@")[0] ||
    "Pengguna";
  return {
    id: user.id,
    username: profile?.kode_sid || user.email || displayName,
    sid: profile?.kode_sid || "",
    nik: profile?.nik || "",
    email: user.email || "",
    name: displayName,
    nama: profile?.nama || displayName,
    company: profile?.nama_perusahaan || "",
    site: profile?.site || "",
    usia: profile?.usia ?? null,
    divisi: profile?.divisi || "",
    mainkon: profile?.mainkon || "",
    kategori: profile?.kategori || "",
    jabatanFungsional: profile?.jabatan_fungsional || "",
    jabatanStruktural: profile?.jabatan_struktural || "",
    levelJabatan: profile?.level_jabatan || "",
    statusKaryawan: profile?.status_karyawan || "",
    kategoriKaryawan: profile?.kategori_karyawan || "",
    workPermit: profile?.work_permit || "",
    statusPermit: profile?.status_permit || "",
    photo: profile?.foto || meta.avatar_url || "",
    membershipTier: meta.membershipTier || "MEMBER",
  };
}

export function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getSessionUser() {
  return getSession()?.user ?? null;
}

export function setSessionUser(user) {
  if (!user) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ user }));
}

/** Gabungkan field ke user yang sedang login (untuk edit profil). */
export function mergeSessionUser(partial) {
  const cur = getSessionUser();
  if (!cur) return null;
  const next = { ...cur, ...partial };
  setSessionUser(next);
  return next;
}

export function logout() {
  clearAuthToken();
  if (isSupabaseEnabled && supabase) {
    supabase.auth.signOut().catch(() => {});
  }
  localStorage.removeItem(AUTH_SESSION_KEY);
}

async function loginWithNodeApi(usernameOrEmail, password) {
  const identity = String(usernameOrEmail || "").trim();
  const pwd = String(password || "");
  // Jangan biarkan profil dari login baru memakai JWT milik user sebelumnya.
  // Login API harus selalu membentuk satu pasangan token + session yang baru.
  clearAuthToken();
  localStorage.removeItem(AUTH_SESSION_KEY);
  const prefix = getApiPathPrefix();
  const bases = getApiOriginsToTry();
  let res = /** @type {Response | null} */ (null);
  for (let i = 0; i < bases.length; i += 1) {
    const loginUrl = `${bases[i]}${prefix}/auth/login`;
    res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identity, password: pwd }),
    });
    if (res.status !== 404 || i === bases.length - 1) break;
  }
  if (!res) {
    return { user: null, error: "Tidak dapat menghubungi server." };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof body.error === "string" ? body.error : "SID atau password salah.";
    return { user: null, error: msg };
  }
  const token = body.token;
  const user = body.user;
  if (!token || !user?.id) {
    return { user: null, error: "Respons login tidak valid." };
  }
  setAuthToken(token);
  setSessionUser(user);
  hydrateUserDataFromCloud(user.id).catch(() => {});
  return { user, error: "" };
}

export async function loginWithPassword(usernameOrEmail, password) {
  const identity = String(usernameOrEmail || "").trim();
  const pwd = String(password || "");
  if (!identity || !pwd) return { user: null, error: "Isi SID dan password (SID)." };

  if (isApiBackendEnabled()) {
    return loginWithNodeApi(usernameOrEmail, password);
  }

  if (!isSupabaseEnabled || !supabase) {
    const localUser = authenticate(identity, pwd);
    if (!localUser) return { user: null, error: "SID atau password salah." };
    setSessionUser(localUser);
    return { user: localUser, error: "" };
  }

  const email = identity.includes("@") ? identity.toLowerCase() : sidToEmail(identity);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pwd,
  });
  if (error || !data?.user) {
    return { user: null, error: "SID atau password salah." };
  }

  const employeeProfile = await getEmployeeProfileBySid(identity, data.user.email);
  const user = toSessionShapeFromSupabaseUser(data.user, employeeProfile);
  setSessionUser(user);
  hydrateUserDataFromCloud(data.user.id).catch(() => {});
  return { user, error: "" };
}

export async function initializeAuth() {
  if (isApiBackendEnabled()) {
    const token = getAuthToken();
    if (!token) return;
    try {
      const data = await apiRequest("/auth/me");
      if (data?.user?.id) {
        setSessionUser(data.user);
        hydrateUserDataFromCloud(data.user.id).catch(() => {});
      }
    } catch {
      clearAuthToken();
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
    return;
  }

  if (!isSupabaseEnabled || !supabase) return;

  const { data } = await supabase.auth.getSession();
  const employeeProfile = await getEmployeeProfileBySid("", data?.session?.user?.email);
  const sessionUser = toSessionShapeFromSupabaseUser(data?.session?.user, employeeProfile);
  if (sessionUser) {
    setSessionUser(sessionUser);
    hydrateUserDataFromCloud(sessionUser.id).catch(() => {});
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const profile = await getEmployeeProfileBySid("", session?.user?.email);
    const nextUser = toSessionShapeFromSupabaseUser(session?.user, profile);
    if (!nextUser) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return;
    }
    setSessionUser(nextUser);
  });
}
