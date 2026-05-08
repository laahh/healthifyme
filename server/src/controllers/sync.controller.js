import * as historyService from "../services/history.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getSync = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const payload = await historyService.getSyncPayload(userId, userId);
  res.json(payload);
});
