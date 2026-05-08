import { UnauthorizedError } from "../domain/errors/AppError.js";
import * as employeeRepo from "../repositories/employeeProfile.repository.js";
import { verifyPasswordForSid } from "../utils/password.js";
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
