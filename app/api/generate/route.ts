
import { NextRequest, NextResponse } from 'next/server';
import { generateImageServer, generateCustomImageServer } from '@/lib/gemini-server';
import { verifyBeforeGenerate, saveResultImageToSaas } from '@/lib/saas-api';
import { normalizeImage, normalizeInputImage } from '@/lib/image-utils';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_INPUT_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, toolId, mode, ...params } = body;

    if (!userId || !toolId) {
      return NextResponse.json({ success: false, error: 'Missing userId or toolId' }, { status: 400 });
    }

    // 0. Preliminary input normalization and size check
    // We only process if images are provided
    const processImg = async (b64: string | undefined): Promise<string | undefined> => {
      if (!b64 || !b64.includes(';base64,')) return b64;
      const buffer = Buffer.from(b64.split(',')[1], 'base64');
      if (buffer.byteLength > MAX_INPUT_SIZE) {
        throw new Error('Input image exceeds 15MB limit');
      }
      const normalized = await normalizeInputImage(buffer);
      const mime = b64.split(',')[0].split(':')[1].split(';')[0];
      return `data:${mime};base64,${normalized.toString('base64')}`;
    };

    // 1. Parallelize input normalization and verification
    const [imageUrlBase64, modelUrlBase64, sceneUrlBase64, referenceImageBase64] = await Promise.all([
      processImg(params.imageUrlBase64),
      processImg(params.modelUrlBase64),
      processImg(params.sceneUrlBase64),
      processImg(params.referenceImageBase64),
      verifyBeforeGenerate({ userId, toolId })
    ]);

    // 2. Generate AI Image
    let imageBuffer: Buffer;
    let type = mode === 'custom' ? 'custom' : params.type;
    
    if (mode === 'custom') {
      imageBuffer = await generateCustomImageServer(params.prompt, referenceImageBase64 || null);
    } else {
      imageBuffer = await generateImageServer(
        params.type,
        imageUrlBase64!,
        modelUrlBase64 || null,
        sceneUrlBase64 || null,
        params.analysis,
        params.config
      );
    }

    // 3. Post-process Result Image (PNG, normalization)
    const normalizedBuffer = await normalizeImage(imageBuffer);

    // 4. Atomic Save to SAAS (Section 2.C & 3 - Consume -> Upload -> Commit)
    // Only happens if generation and processing succeeded
    const fileName = `result_${toolId}_${Date.now()}.jpg`;
    const savedImage = await saveResultImageToSaas({
      userId,
      toolId,
      imageBuffer: normalizedBuffer,
      mimeType: 'image/jpeg',
      fileName
    });

    // 5. Final response
    return NextResponse.json({ 
      success: true, 
      imageUrl: savedImage.url,
      recordId: savedImage.recordId,
      image: savedImage, // Full commit details
      images: [savedImage]
    });

  } catch (error: any) {
    console.error('Generate error details in route:', error);
    let errorMsg = error.message;
    try {
        const parsed = JSON.parse(error.message);
        errorMsg = parsed.message || parsed.error || error.message;
    } catch {}
    
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
