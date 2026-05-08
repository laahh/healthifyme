/**
 * Validasi ringan untuk VITE_GEMINI_API_KEY (hindari request dengan placeholder).
 * @param {string | undefined} key
 * @returns {string | null} Pesan error untuk UI, atau null jika OK untuk dicoba.
 */
export function getGeminiApiKeyConfigError(key) {
  const k = String(key ?? "").trim();
  if (!k) {
    return "API key Gemini belum diset. Tambahkan VITE_GEMINI_API_KEY di file .env di root project, lalu restart npm run dev.";
  }
  const lower = k.toLowerCase();
  if (
    lower === "your-gemini-api-key" ||
    lower === "your_gemini_api_key" ||
    lower.startsWith("your-gemini") ||
    lower === "xxx" ||
    lower === "changeme"
  ) {
    return "VITE_GEMINI_API_KEY masih nilai contoh. Buat kunci di Google AI Studio (https://aistudio.google.com/apikey), tempel ke .env, lalu restart dev server.";
  }
  return null;
}
