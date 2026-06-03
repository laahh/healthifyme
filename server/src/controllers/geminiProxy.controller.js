import * as geminiProxyService from "../services/geminiProxy.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function logGeminiRequest(route, req, base64Data) {
  if (String(process.env.LOG_GEMINI_REQUESTS || "").trim() !== "1") return;
  const len = String(base64Data || "").length;
  console.log(`[${route}] user=${req.auth?.userId ?? "?"} mime=${req.body?.mimeType} base64Chars=${len}`);
}

export const postGeminiFood = asyncHandler(async (req, res) => {
  const { mimeType, base64Data } = req.body;
  logGeminiRequest("gemini-food", req, base64Data);
  const result = await geminiProxyService.proxyFoodAnalysis(
    String(mimeType || ""),
    String(base64Data || "")
  );
  res.json(result);
});

export const postGeminiWorkout = asyncHandler(async (req, res) => {
  const { mimeType, base64Data } = req.body;
  logGeminiRequest("gemini-workout", req, base64Data);
  const result = await geminiProxyService.proxyWorkoutAnalysis(
    String(mimeType || ""),
    String(base64Data || "")
  );
  res.json(result);
});
