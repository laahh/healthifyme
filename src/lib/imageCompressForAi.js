/**
 * Kecilkan foto sebelum kirim ke Gemini/proxy — mengurangi gagal 413/timeout di APK.
 * @param {string} dataUrl
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 * @returns {Promise<string>}
 */
export function compressDataUrlForAi(dataUrl, opts = {}) {
  const maxEdge = opts.maxEdge ?? 1280;
  const quality = opts.quality ?? 0.82;

  return new Promise((resolve) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(1, maxEdge / Math.max(w, h));
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, tw, th);
      try {
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
