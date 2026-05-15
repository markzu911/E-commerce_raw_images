
import { NextRequest, NextResponse } from 'next/server';
import { analyzeImageServer } from '@/lib/gemini-server';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, type } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'Missing image' }, { status: 400 });
    }

    const data = await analyzeImageServer(imageBase64, type);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
