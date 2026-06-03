import { ForbiddenError } from "../domain/errors/AppError.js";
import { getPool } from "../config/database.js";
import * as historyRepo from "../repositories/userHistory.repository.js";
import * as profileRepo from "../repositories/userProfile.repository.js";
import * as foodAnalysisRepo from "../repositories/foodAnalysis.repository.js";
import * as workoutAnalysisRepo from "../repositories/workoutAnalysis.repository.js";

export async function listHistory(requestUserId, targetUserId, limit) {
  if (requestUserId !== targetUserId) {
    throw new ForbiddenError();
  }
  return historyRepo.listHistoryByUserId(targetUserId, limit);
}

export async function upsertHistory(requestUserId, targetUserId, itemId, payload, createdAt) {
  if (requestUserId !== targetUserId) {
    throw new ForbiddenError();
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await historyRepo.upsertHistoryItem(
      targetUserId,
      String(itemId),
      payload,
      createdAt,
      conn
    );
    await foodAnalysisRepo.syncFoodAnalysisFromHistoryPayload(
      conn,
      targetUserId,
      String(itemId),
      /** @type {Record<string, unknown>} */ (payload)
    );
    await workoutAnalysisRepo.syncWorkoutAnalysisFromHistoryPayload(
      conn,
      targetUserId,
      String(itemId),
      /** @type {Record<string, unknown>} */ (payload)
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function removeHistory(requestUserId, targetUserId, itemId) {
  if (requestUserId !== targetUserId) {
    throw new ForbiddenError();
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await foodAnalysisRepo.deleteFoodAnalysisByClientItem(
      conn,
      targetUserId,
      String(itemId)
    );
    await workoutAnalysisRepo.deleteWorkoutAnalysisByClientItem(
      conn,
      targetUserId,
      String(itemId)
    );
    await historyRepo.deleteHistoryItem(targetUserId, String(itemId), conn);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getSyncPayload(requestUserId, targetUserId) {
  if (requestUserId !== targetUserId) {
    throw new ForbiddenError();
  }
  const [profile, history] = await Promise.all([
    profileRepo.findProfileByUserId(targetUserId),
    historyRepo.listHistoryByUserId(targetUserId, 200),
  ]);

  const profileDto = profile
    ? {
        user_id: profile.user_id,
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        address: profile.address ?? null,
        gender: profile.gender ?? null,
        height_cm: profile.height_cm ?? null,
        weight_kg: profile.weight_kg ?? null,
        activity_level: profile.activity_level ?? null,
        exercise_preferences: profile.exercise_preferences ?? null,
        food_restrictions: profile.food_restrictions ?? null,
        timezone: profile.timezone ?? null,
      }
    : null;

  return { profile: profileDto, history };
}
