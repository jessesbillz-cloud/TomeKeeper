/**
 * Client-side image resize helpers. Used by the Assistant page (which
 * accepts up to N images at once) and by PhotoCaptureButton (single
 * image). Resizing client-side keeps base64 payloads small and protects
 * us from huge phone-camera JPEGs blowing up the request body.
 */

/**
 * Resize an image File to keep the resulting data URL small. Defaults
 * roughly match a cover thumbnail; bump maxEdge for screenshots where
 * text needs to be readable by the vision model.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxEdge = 600,
  quality = 0.85,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Larger resize for vision-model input. ~1200px on the long edge keeps
 * post text legible while still fitting in a base64 payload.
 */
export function fileToScanDataUrl(file: File): Promise<string> {
  return fileToResizedDataUrl(file, 1200, 0.85);
}
