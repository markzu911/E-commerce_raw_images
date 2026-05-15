
import { NextRequest, NextResponse } from 'next/server';
import { analyzeImageServer } from '@/lib/gemini-server';
import { normalizeInputImage } from '@/lib/image-utils';

export const maxDuration = 120;

const MAX_INPUT_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, type } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'Missing image' }, { status: 400 });
    }

    // Input normalization and size check
    const base64Data = imageBase64.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.byteLength > MAX_INPUT_SIZE) {
      return NextResponse.json({ success: false, error: 'Input image exceeds 15MB limit' }, { status: 400 });
    }

    const normalized = await normalizeInputImage(buffer);
    const mime = imageBase64.split(',')[0].split(':')[1].split(';')[0];
    const normalizedBase64 = `data:${mime};base64,${normalized.toString('base64')}`;

    const data = await analyzeImageServer(normalizedBase64, type);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
