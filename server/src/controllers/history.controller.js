import { ValidationError } from "../domain/errors/AppError.js";
import * as historyService from "../services/history.service.js";
import { historyListQuerySchema } from "../validation/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listHistory = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const q = historyListQuerySchema.safeParse(req.query);
  const limit = q.success ? (q.data.limit ?? 200) : 200;
  const items = await historyService.listHistory(userId, userId, limit);
  res.json({ items });
});

export const upsertHistoryItem = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { itemId } = req.params;
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Payload tidak valid.");
  }
  const createdAt = body.createdAt;
  await historyService.upsertHistory(userId, userId, itemId, body, createdAt);
  res.status(204).send();
});

export const deleteHistoryItem = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { itemId } = req.params;
  await historyService.removeHistory(userId, userId, itemId);
  res.status(204).send();
});
