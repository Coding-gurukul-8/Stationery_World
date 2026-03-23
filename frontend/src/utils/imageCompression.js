import imageCompression from 'browser-image-compression';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export function isSupportedImageType(file) {
  if (!file) return false;
  return ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase());
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / (k ** i)).toFixed(2))} ${sizes[i]}`;
}

export async function compressImageFile(file, { maxSizeKB = 200, minSizeKB = 0, maxWidthOrHeight = 1920 } = {}) {
  if (!file) throw new Error('No file provided for compression');
  if (!isSupportedImageType(file)) {
    throw new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.');
  }

  const targetSizeMB = Math.max(0.02, maxSizeKB / 1024);

  const options = {
    maxSizeMB: targetSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: file.type,
    initialQuality: 0.8,
    maxIteration: 10,
    exifOrientation: await imageCompression.getExifOrientation(file),
  };

  let compressed = await imageCompression(file, options);

  if (compressed.size > maxSizeKB * 1024) {
    let quality = 0.75;
    while (compressed.size > maxSizeKB * 1024 && quality >= 0.15) {
      compressed = await imageCompression(file, { ...options, initialQuality: quality });
      quality -= 0.1;
    }
  }

  // If result is larger than original, keep original to avoid degradation.
  if (compressed.size > file.size) {
    compressed = file;
  }

  // If product requires minimum size and compressed is below min, keep compressed by design (no upscaling).
  if (minSizeKB && compressed.size < minSizeKB * 1024) {
    // no-op, but we can log for visibility
    console.warn(`Compressed file ${file.name} is below minSizeKB (${formatBytes(compressed.size)})`);
  }

  return new File([compressed], file.name, { type: compressed.type });
}
