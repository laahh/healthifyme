import * as mcuService from "../services/mcu.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getMcu = asyncHandler(async (req, res) => {
  const data = await mcuService.getMcuForUser(req.auth.userId);
  res.json(data);
});
