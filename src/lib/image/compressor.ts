import { CompressionPreset, CompressionResult } from '@/types';

const PRESETS: Record<CompressionPreset, { maxDim: number; targetSize: number }> = {
  low: { maxDim: 800, targetSize: 100 * 1024 },
  medium: { maxDim: 1280, targetSize: 300 * 1024 },
  high: { maxDim: 1600, targetSize: 500 * 1024 },
};

const THUMB_MAX_DIM = 240;
const THUMB_TARGET_SIZE = 15 * 1024;

export async function compressImage(
  file: File,
  preset: CompressionPreset = 'medium'
): Promise<CompressionResult> {
  // Reject non-image or > 25MB
  if (!file.type.startsWith('image/')) {
    throw new Error('invalid_image');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('image_too_large');
  }

  // Load into HTMLImageElement or ImageBitmap
  let imageSource: HTMLImageElement | ImageBitmap;
  if (typeof createImageBitmap === 'function') {
    try {
      imageSource = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      imageSource = await loadImageElement(file);
    }
  } else {
    imageSource = await loadImageElement(file);
  }

  const origWidth = imageSource.width;
  const origHeight = imageSource.height;

  const { maxDim, targetSize } = PRESETS[preset];

  // Calculate resized dimensions preserving aspect ratio
  let targetW = origWidth;
  let targetH = origHeight;
  if (origWidth > maxDim || origHeight > maxDim) {
    if (origWidth > origHeight) {
      targetW = maxDim;
      targetH = Math.round((origHeight * maxDim) / origWidth);
    } else {
      targetH = maxDim;
      targetW = Math.round((origWidth * maxDim) / origHeight);
    }
  }

  // Draw on canvas with white background
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_context_failed');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(imageSource, 0, 0, targetW, targetH);

  // Compression step-down logic
  let quality = 0.80;
  let mime: 'image/jpeg' | 'image/webp' = 'image/webp';
  let blob = await canvasToBlob(canvas, 'image/webp', quality);

  // Check WebP support fallback
  if (!blob || blob.type !== 'image/webp') {
    mime = 'image/jpeg';
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  let attempts = 0;
  while (blob && blob.size > targetSize && quality > 0.45 && attempts < 4) {
    quality -= 0.08;
    attempts++;
    const nextBlob = await canvasToBlob(canvas, mime, quality);
    if (nextBlob) blob = nextBlob;
  }

  if (!blob) throw new Error('compression_failed');

  // Hard cap 1MB (DB/storage constraint)
  if (blob.size > 1024 * 1024) {
    // scale down canvas dimensions by 15% and retry
    const reducedW = Math.round(targetW * 0.85);
    const reducedH = Math.round(targetH * 0.85);
    canvas.width = reducedW;
    canvas.height = reducedH;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, reducedW, reducedH);
    ctx.drawImage(imageSource, 0, 0, reducedW, reducedH);
    const retryBlob = await canvasToBlob(canvas, mime, 0.50);
    if (retryBlob) blob = retryBlob;
  }

  // Generate Thumbnail
  let thumbW = origWidth;
  let thumbH = origHeight;
  if (origWidth > THUMB_MAX_DIM || origHeight > THUMB_MAX_DIM) {
    if (origWidth > origHeight) {
      thumbW = THUMB_MAX_DIM;
      thumbH = Math.round((origHeight * THUMB_MAX_DIM) / origWidth);
    } else {
      thumbH = THUMB_MAX_DIM;
      thumbW = Math.round((origWidth * THUMB_MAX_DIM) / origHeight);
    }
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext('2d');
  if (thumbCtx) {
    thumbCtx.fillStyle = '#FFFFFF';
    thumbCtx.fillRect(0, 0, thumbW, thumbH);
    thumbCtx.drawImage(imageSource, 0, 0, thumbW, thumbH);
  }

  let thumbBlob = await canvasToBlob(thumbCanvas, mime, 0.70);
  if (!thumbBlob) thumbBlob = blob;

  const originalSize = file.size;
  const compressedSize = blob.size;
  const savedPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

  return {
    blob,
    thumbBlob,
    width: targetW,
    height: targetH,
    mime,
    originalSize,
    compressedSize,
    savedPercent,
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}
