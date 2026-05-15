
import { NextRequest, NextResponse } from 'next/server';
import { generateImageServer, generateCustomImageServer } from '@/lib/gemini-server';
import { verifyBeforeGenerate, saveResultImageToSaas } from '@/lib/saas-api';
import { normalizeImage } from '@/lib/image-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, toolId, mode, ...params } = body;

    if (!userId || !toolId) {
      return NextResponse.json({ success: false, error: 'Missing userId or toolId' }, { status: 400 });
    }

    // 1. Verify integral
    await verifyBeforeGenerate({ userId, toolId });

    // 2. Generate AI Image
    let imageBuffer: Buffer;
    let type = mode === 'custom' ? 'custom' : params.type;
    
    if (mode === 'custom') {
      imageBuffer = await generateCustomImageServer(params.prompt, params.referenceImageBase64);
    } else {
      imageBuffer = await generateImageServer(
        params.type,
        params.imageUrlBase64,
        params.modelUrlBase64,
        params.sceneUrlBase64,
        params.analysis,
        params.config
      );
    }

    // 3. Normalize Image (PNG, 512-2048px)
    const normalizedBuffer = await normalizeImage(imageBuffer);

    // 4. Save to SAAS (Consume -> Upload -> Commit)
    const fileName = `${toolId}_${Date.now()}_${type}.png`;
    const savedImage = await saveResultImageToSaas({
      userId,
      toolId,
      imageBuffer: normalizedBuffer,
      mimeType: 'image/png',
      fileName
    });

    return NextResponse.json({ 
      success: true, 
      images: [savedImage], // Standard array return as per spec section 4
      image: savedImage, // Keep legacy for backwards compatibility with my gemini.ts
      imageUrl: savedImage.url 
    });

  } catch (error: any) {
    console.error('Generate error details in route:', error);
    // Attempt to parse error details if it came from the SaaS call
    let errorMsg = error.message;
    try {
        const parsed = JSON.parse(error.message);
        errorMsg = parsed.message || parsed.error || error.message;
    } catch {}
    
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
