import { ValidationError } from "../domain/errors/AppError.js";
import * as nutritionInsightService from "../services/nutritionInsight.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getWeeklySummary = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const raw = req.query.date != null ? String(req.query.date).slice(0, 10) : "";
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError("Query date harus YYYY-MM-DD.");
  }
  const summary = await nutritionInsightService.getWeeklyFoodSummary(userId, raw || undefined);
  res.json(summary);
});

export const getDailySummary = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const raw = req.query.date != null ? String(req.query.date).slice(0, 10) : "";
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError("Query date wajib YYYY-MM-DD.");
  }
  const summary = await nutritionInsightService.getDailyFoodSummary(userId, raw);
  res.json(summary);
});
