import sharp from 'sharp';

/**
 * Normalizes an image buffer using sharp.
 * - Format: PNG
 * - Size: Min 512x512, Max 2048x2048, Lock Aspect Ratio
 */
export async function normalizeImage(input: Buffer): Promise<Buffer> {
  const image = sharp(input);
  const metadata = await image.metadata();
  
  let { width, height } = metadata;
  if (!width || !height) throw new Error('Invalid image metadata');

  const MIN_SIZE = 512;
  const MAX_SIZE = 2048;

  let targetWidth = width;
  let targetHeight = height;

  // Scale up if too small
  if (width < MIN_SIZE || height < MIN_SIZE) {
    const ratio = Math.max(MIN_SIZE / width, MIN_SIZE / height);
    targetWidth = Math.round(width * ratio);
    targetHeight = Math.round(height * ratio);
  }

  // Scale down if too large
  if (targetWidth > MAX_SIZE || targetHeight > MAX_SIZE) {
    const ratio = Math.min(MAX_SIZE / targetWidth, MAX_SIZE / targetHeight);
    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
  }

  return image
    .resize(targetWidth, targetHeight)
    .png()
    .toBuffer();
}
