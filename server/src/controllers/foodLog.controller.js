import * as foodLogService from "../services/foodLog.service.js";
import * as healthRiskService from "../services/healthRisk.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getCatalog = asyncHandler(async (req, res) => {
  const items = await foodLogService.getCatalog(req.query);
  res.json({ items });
});

export const getRecent = asyncHandler(async (req, res) => {
  const items = await foodLogService.getRecent(req.auth.userId, req.query);
  res.json({ items });
});

export const lookupBarcode = asyncHandler(async (req, res) => {
  const product = await foodLogService.lookupBarcode(req.params.code);
  res.json({ product });
});

export const logFood = asyncHandler(async (req, res) => {
  const item = await foodLogService.logFood(req.auth.userId, req.body);
  let healthAlert = null;
  try {
    const day = await healthRiskService.evaluateDay(req.auth.userId);
    healthAlert = healthRiskService.toHealthAlertPayload(day);
  } catch (err) {
    console.warn("[healthRisk] food/log evaluateDay:", err?.message || err);
  }
  res.status(201).json({ item, healthAlert });
});
