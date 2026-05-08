import { ValidationError } from "../domain/errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as exerciseService from "../services/exercise.service.js";
import { exerciseListQuerySchema, exerciseIdParamSchema } from "../validation/schemas.js";

export const listExercises = asyncHandler(async (req, res) => {
  const q = exerciseListQuerySchema.safeParse(req.query);
  const parsed = q.success ? q.data : exerciseListQuerySchema.parse({});
  const exercises = await exerciseService.listExercises(parsed.limit, parsed.offset);
  res.json({ exercises });
});

export const getExercise = asyncHandler(async (req, res) => {
  const p = exerciseIdParamSchema.safeParse(req.params);
  if (!p.success) {
    throw new ValidationError("ID latihan tidak valid.");
  }
  const exercise = await exerciseService.getExercise(p.data.exerciseId);
  res.json({ exercise });
});
