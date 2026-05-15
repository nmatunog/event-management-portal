/** Re-encode raster data URLs as JPEG to stay within D1 row size limits. */
export function reencodeImageDataUrlAsJpeg(dataUrl, maxSide = 640, quality = 0.82) {
  return new Promise((resolve) => {
    const s = String(dataUrl || "");
    if (!s.startsWith("data:image/") || s.startsWith("data:image/svg")) {
      resolve(s);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      const scale = Math.min(1, maxSide / Math.max(w, h, 1));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(s);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(s);
    img.src = s;
  });
}
