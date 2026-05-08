import { ForbiddenError } from "../domain/errors/AppError.js";
import * as profileRepo from "../repositories/userProfile.repository.js";

export async function getProfileForUser(requestUserId, targetUserId) {
  if (requestUserId !== targetUserId) {
    throw new ForbiddenError();
  }
  const row = await profileRepo.findProfileByUserId(targetUserId);
  if (!row) {
    return {
      user_id: targetUserId,
      name: "",
      phone: "",
      email: "",
      address: null,
    };
  }
  return {
    user_id: row.user_id,
    name: row.name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? null,
  };
}

export async function saveProfile(requestUserId, targetUserId, body) {
  if (requestUserId !== targetUserId) {
    throw new ForbiddenError();
  }
  const existing = await profileRepo.findProfileByUserId(targetUserId);
  await profileRepo.upsertProfile(targetUserId, {
    name: body.name !== undefined ? body.name : (existing?.name ?? ""),
    phone: body.phone !== undefined ? body.phone : (existing?.phone ?? ""),
    email: body.email !== undefined ? body.email : (existing?.email ?? ""),
    address:
      body.address !== undefined ? body.address : (existing?.address ?? null),
  });
  return getProfileForUser(requestUserId, targetUserId);
}
