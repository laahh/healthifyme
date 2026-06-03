import { ValidationError } from "../domain/errors/AppError.js";
import * as goalService from "../services/goal.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listGoalTypes = asyncHandler(async (_req, res) => {
  const items = await goalService.listGoalTypes();
  res.json({ goal_types: items });
});

export const listGoals = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const goals = await goalService.listMyGoals(userId);
  res.json({ goals });
});

export const createGoal = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const goal = await goalService.createGoalDraft(userId, req.body);
  res.status(201).json({ goal });
});

export const activateGoal = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { goalId } = req.params;
  const goal = await goalService.activateGoal(userId, goalId);
  res.json({ goal });
});

export const getGoalSummary = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { goalId } = req.params;
  const summary = await goalService.getGoalSummary(userId, goalId);
  res.json(summary);
});

export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const dateStr = String(req.query.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new ValidationError("Query date wajib YYYY-MM-DD.");
  }
  const payload = await goalService.getDashboard(userId, dateStr);
  res.json(payload);
});

export const getProgress = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const days = req.query.days != null ? Number(req.query.days) : 30;
  const d = Number.isFinite(days) ? Math.min(90, Math.max(7, Math.floor(days))) : 30;
  const payload = await goalService.getProgress(userId, d);
  res.json(payload);
});
