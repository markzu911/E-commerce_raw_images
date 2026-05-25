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

    const rangeHeader = req.headers.get('range');
    const videoRes = await downloadVideoServer(operationName, rangeHeader);

    const headers = new Headers();
    videoRes.headers.forEach((value, key) => {
      // Clean up server compression and caching headers to prevent browser stream buffering issues
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Disposition', download ? 'attachment; filename="fashion-ai-promo.mp4"' : 'inline');

    return new Response(videoRes.body, {
      status: videoRes.status,
      statusText: videoRes.statusText,
      headers,
    });

  } catch (error: any) {
    console.error('Video download error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
