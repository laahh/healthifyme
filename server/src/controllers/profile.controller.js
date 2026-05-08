import * as profileService from "../services/profile.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const profile = await profileService.getProfileForUser(userId, userId);
  res.json({ profile });
});

export const putProfile = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const profile = await profileService.saveProfile(userId, userId, req.body);
  res.json({ profile });
});
