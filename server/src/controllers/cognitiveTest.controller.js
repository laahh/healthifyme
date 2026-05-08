import * as cognitiveService from "../services/cognitiveTest.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const postPvtResult = asyncHandler(async (req, res) => {
  await cognitiveService.savePvtResult(req.auth.userId, req.body);
  res.status(204).send();
});

export const postMemoryResult = asyncHandler(async (req, res) => {
  await cognitiveService.saveMemoryResult(req.auth.userId, req.body);
  res.status(204).send();
});

export const postSessionSummary = asyncHandler(async (req, res) => {
  await cognitiveService.saveTestSession(req.auth.userId, req.body);
  res.status(204).send();
});
