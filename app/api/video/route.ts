
import { NextRequest, NextResponse } from 'next/server';
import { generateVideoServer } from '@/lib/gemini-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrlBase64, analysis, config } = body;

    if (!imageUrlBase64) {
      return NextResponse.json({ success: false, error: 'Missing image data' }, { status: 400 });
    }

    const operationName = await generateVideoServer(imageUrlBase64, analysis, config);

    return NextResponse.json({ 
      success: true, 
      operationName,
      message: '视频生成任务已提交，系统正在使用 Veo 引擎进行光影渲染与动态合成。'
    });

  } catch (error: any) {
    console.error('Video generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
