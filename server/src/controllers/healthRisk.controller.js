import * as healthRiskService from "../services/healthRisk.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getTodayAlerts = asyncHandler(async (req, res) => {
  const raw = req.query.date != null ? String(req.query.date).slice(0, 10) : "";
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
  const day = await healthRiskService.evaluateDay(req.auth.userId, { date });
  res.json(healthRiskService.toHealthAlertPayload(day));
});

/** Evaluasi dengan meal sementara (hasil scan belum disimpan). */
export const postEvaluate = asyncHandler(async (req, res) => {
  const raw = req.body?.date != null ? String(req.body.date).slice(0, 10) : "";
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
  const pendingMeal =
    req.body?.pendingMeal && typeof req.body.pendingMeal === "object"
      ? req.body.pendingMeal
      : null;
  const day = await healthRiskService.evaluateDay(req.auth.userId, {
    date,
    pendingMeal,
  });
  res.json(healthRiskService.toHealthAlertPayload(day));
});
