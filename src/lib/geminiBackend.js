import { apiRequest, getAuthToken, isApiBackendEnabled } from "./apiClient";

export function canUseGeminiBackend() {
  return isApiBackendEnabled() && Boolean(getAuthToken());
}

/**
 * @param {{ mimeType: string, base64Data: string }} parsedImage
 */
export function fetchGeminiFoodViaBackend(parsedImage) {
  return apiRequest("/me/ai/gemini-food", {
    method: "POST",
    json: { mimeType: parsedImage.mimeType, base64Data: parsedImage.base64Data },
  });
}

/**
 * @param {{ mimeType: string, base64Data: string }} parsedImage
 */
export function fetchGeminiWorkoutViaBackend(parsedImage) {
  return apiRequest("/me/ai/gemini-workout", {
    method: "POST",
    json: { mimeType: parsedImage.mimeType, base64Data: parsedImage.base64Data },
  });
}
