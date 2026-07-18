import * as workoutLogService from "../services/workoutLog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getCatalog = asyncHandler(async (req, res) => {
  const items = workoutLogService.getCatalog(req.query);
  res.json({ items });
});

export const getRecent = asyncHandler(async (req, res) => {
  const items = await workoutLogService.getRecent(req.auth.userId, req.query);
  res.json({ items });
});

export const logWorkout = asyncHandler(async (req, res) => {
  const item = await workoutLogService.logWorkout(req.auth.userId, req.body);
  res.status(201).json({ item });
});
