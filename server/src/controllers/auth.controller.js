import * as authService from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await authService.loginWithPassword(username, password);
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.loadSessionUser(req.auth.userId);
  res.json({ user });
});
