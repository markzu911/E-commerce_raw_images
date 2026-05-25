import { NextRequest, NextResponse } from 'next/server';
import { downloadVideoServer } from '@/lib/gemini-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationName = searchParams.get('operationName');

    const download = searchParams.get('download');

    if (!operationName) {
      return NextResponse.json({ success: false, error: 'Missing operationName' }, { status: 400 });
    }

    const videoRes = await downloadVideoServer(operationName);

    // Instead of streaming which can cause range query issues and buffering problems,
    // read the entire body as an ArrayBuffer and return a standard response with a Content-Length.
    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a new response with the video stream
    return new Response(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': download ? 'attachment; filename="fashion-ai-promo.mp4"' : 'inline',
      },
    });

  } catch (error: any) {
    console.error('Video download error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
