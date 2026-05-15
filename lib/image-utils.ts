import sharp from 'sharp';

/**
 * Normalizes an image buffer using sharp.
 * - Format: PNG
 * - Size: Min 512x512, Max 2048x2048, Lock Aspect Ratio
 */
export async function normalizeImage(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png()
    .toBuffer();
}
