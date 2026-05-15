import { NextRequest, NextResponse } from 'next/server';
import { saveResultImageToSaas } from '@/lib/saas-api';

export const maxDuration = 120; // 120 seconds

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, userId, toolId, fileName } = await req.json();

    if (!imageBase64 || !userId || !toolId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Extract base64 data
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/png';

    console.log(`[API/Save] Processing save for user ${userId}, tool ${toolId}, size: ${buffer.byteLength}`);

    // This function handles consume -> token -> upload -> commit
    const result = await saveResultImageToSaas({
      userId,
      toolId,
      imageBuffer: buffer,
      mimeType,
      fileName: fileName || 'result.png'
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[API/Save] Error:', error);
    // Return structured error so frontend can display it
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
