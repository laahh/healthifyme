import { NotFoundError } from "../domain/errors/AppError.js";
import * as exerciseRepository from "../repositories/exercise.repository.js";

/**
 * @param {number} limit
 * @param {number} offset
 */
export async function listExercises(limit, offset) {
  return exerciseRepository.listExercisesSummary(limit, offset);
}

/**
 * @param {number} exerciseId
 */
export async function getExercise(exerciseId) {
  const row = await exerciseRepository.getExerciseById(exerciseId);
  if (!row) {
    throw new NotFoundError("Latihan tidak ditemukan.");
  }
  return row;
}
