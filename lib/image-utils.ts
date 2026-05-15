import sharp from 'sharp';

/**
 * Normalizes user input images.
 * - Resize to max 2048px (spec suggestion: 2048-3072)
 * - Auto rotate
 * - Strip EXIF
 */
export async function normalizeInputImage(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/**
 * Normalizes result images for SaaS storage.
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
