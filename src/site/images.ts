/** Browser-side image helpers for the aerial pipeline. */

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

/** Re-encode a region of the image. JPEG keeps a phone screenshot well under a megabyte. */
export function cropToBlob(img: HTMLImageElement, crop: CropRect): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.w);
  canvas.height = Math.round(crop.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No 2D context"));
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), "image/jpeg", 0.92);
  });
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/** First image file from a paste or drop, if any. */
export function imageFileFrom(items: DataTransferItemList | null | undefined): File | null {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f && isImageFile(f)) return f;
    }
  }
  return null;
}
