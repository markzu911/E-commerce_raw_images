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
export async function normalizeImage(input: Buffer, resolution: '1k' | '2k' | '4k' = '2k'): Promise<Buffer> {
  const sizeMap = {
    '1k': 1024,
    '2k': 2048,
    '4k': 4096
  };
  const size = sizeMap[resolution] || 2048;

  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize({
      width: size,
      height: size,
      fit: 'inside',
      withoutEnlargement: false // Allow enlargement if requested resolution is higher than input
    })
    .jpeg({ quality: 90, progressive: true })
    .toBuffer();
}
