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
      gender: null,
      height_cm: null,
      weight_kg: null,
      activity_level: null,
      exercise_preferences: null,
      food_restrictions: null,
      timezone: null,
    };
  }
  return {
    user_id: row.user_id,
    name: row.name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? null,
    gender: row.gender ?? null,
    height_cm: row.height_cm ?? null,
    weight_kg: row.weight_kg ?? null,
    activity_level: row.activity_level ?? null,
    exercise_preferences: row.exercise_preferences ?? null,
    food_restrictions: row.food_restrictions ?? null,
    timezone: row.timezone ?? null,
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
    gender: body.gender !== undefined ? body.gender : existing?.gender ?? null,
    height_cm: body.height_cm !== undefined ? body.height_cm : existing?.height_cm ?? null,
    weight_kg: body.weight_kg !== undefined ? body.weight_kg : existing?.weight_kg ?? null,
    activity_level:
      body.activity_level !== undefined ? body.activity_level : existing?.activity_level ?? null,
    exercise_preferences:
      body.exercise_preferences !== undefined
        ? body.exercise_preferences
        : existing?.exercise_preferences ?? null,
    food_restrictions:
      body.food_restrictions !== undefined ? body.food_restrictions : existing?.food_restrictions ?? null,
    timezone: body.timezone !== undefined ? body.timezone : existing?.timezone ?? null,
  });
  return getProfileForUser(requestUserId, targetUserId);
}
