import { sidToEmail } from "../utils/sidEmail.js";

/**
 * Satu baris employee_profiles → bentuk session frontend.
 * Email sintetis: {kode_sid}@sid.internal (kompatibel UI).
 * @param {Record<string, unknown> | null} employeeRow
 */
export function toSessionUserDto(employeeRow) {
  if (!employeeRow?.id || !employeeRow?.kode_sid) return null;

  const sid = String(employeeRow.kode_sid || "").trim();
  const email = sidToEmail(sid);
  const displayName =
    String(employeeRow.nama || "").trim() || sid || "Pengguna";

  return {
    id: String(employeeRow.id),
    username: sid,
    sid,
    nik: String(employeeRow.nik || ""),
    email,
    name: displayName,
    nama: String(employeeRow.nama || displayName),
    company: String(employeeRow.nama_perusahaan || ""),
    site: String(employeeRow.site || ""),
    usia: employeeRow.usia != null ? Number(employeeRow.usia) : null,
    divisi: String(employeeRow.divisi || ""),
    mainkon: String(employeeRow.mainkon || ""),
    kategori: String(employeeRow.kategori || ""),
    jabatanFungsional: String(employeeRow.jabatan_fungsional || ""),
    jabatanStruktural: String(employeeRow.jabatan_struktural || ""),
    levelJabatan: String(employeeRow.level_jabatan || ""),
    statusKaryawan: String(employeeRow.status_karyawan || ""),
    kategoriKaryawan: String(employeeRow.kategori_karyawan || ""),
    workPermit: String(employeeRow.work_permit || ""),
    statusPermit: String(employeeRow.status_permit || ""),
    photo:
      String(employeeRow.foto || "").trim() ||
      String(employeeRow.avatar_url || "").trim() ||
      "",
    membershipTier: String(employeeRow.membership_tier || "MEMBER"),
  };
}
