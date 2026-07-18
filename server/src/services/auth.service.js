import { UnauthorizedError, ValidationError } from "../domain/errors/AppError.js";
import * as employeeRepo from "../repositories/employeeProfile.repository.js";
import { hashPassword, verifyPassword, verifyPasswordForSid } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { sidToEmail } from "../utils/sidEmail.js";
import { toSessionUserDto } from "./session.mapper.js";

export async function loginWithPassword(username, password) {
  const sid = String(username || "").trim();
  const pwd = String(password || "");
  if (!sid || !pwd) {
    throw new UnauthorizedError("SID atau password salah.");
  }

  const employee = await employeeRepo.findEmployeeWithCredentialsByKodeSid(sid);
  if (!employee) {
    throw new UnauthorizedError("SID atau password salah.");
  }
  const hash = String(employee.password_hash || "").trim();
  if (!hash) {
    throw new UnauthorizedError(
      "Akun belum siap login: password belum di-set di server (password_hash kosong). Jalankan seed atau update baris karyawan."
    );
  }

  const ok = await verifyPasswordForSid(
    pwd,
    String(employee.kode_sid || ""),
    hash
  );
  if (!ok) {
    throw new UnauthorizedError("SID atau password salah.");
  }

  const sessionUser = toSessionUserDto(employee);
  if (!sessionUser) {
    throw new UnauthorizedError("SID atau password salah.");
  }

  const canonicalSid = String(employee.kode_sid || "").trim();
  const token = signAccessToken({
    sub: String(employee.id),
    email: sidToEmail(canonicalSid),
  });

  return { token, user: sessionUser };
}

export async function loadSessionUser(userId) {
  const employee = await employeeRepo.findEmployeeById(userId);
  if (!employee) {
    throw new UnauthorizedError("Sesi tidak valid.");
  }

  const sessionUser = toSessionUserDto(employee);
  if (!sessionUser) {
    throw new UnauthorizedError("Sesi tidak valid.");
  }

  return sessionUser;
}

/**
 * Ganti password akun login (verifikasi password lama dengan bcrypt ketat).
 * @param {string} userId
 * @param {{ currentPassword: string, newPassword: string }} body
 */
export async function changePassword(userId, body) {
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    throw new ValidationError("Isi password lama dan password baru.");
  }
  if (newPassword.length < 6) {
    throw new ValidationError("Password baru minimal 6 karakter.");
  }
  if (newPassword.length > 128) {
    throw new ValidationError("Password baru terlalu panjang.");
  }
  if (currentPassword === newPassword) {
    throw new ValidationError("Password baru harus berbeda dari password lama.");
  }

  const employee = await employeeRepo.findEmployeeWithCredentialsById(userId);
  if (!employee) {
    throw new UnauthorizedError("Sesi tidak valid.");
  }

  const hash = String(employee.password_hash || "").trim();
  if (!hash) {
    throw new ValidationError("Akun belum punya password. Hubungi admin.");
  }

  const ok = await verifyPassword(currentPassword, hash);
  if (!ok) {
    throw new ValidationError("Password lama salah.");
  }

  const nextHash = await hashPassword(newPassword);
  const updated = await employeeRepo.updatePasswordHashById(employee.id, nextHash);
  if (!updated) {
    throw new ValidationError("Gagal menyimpan password baru.");
  }

  return { ok: true, message: "Password berhasil diubah." };
}
