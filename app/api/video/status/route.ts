import { NextRequest, NextResponse } from 'next/server';
import { getVideoStatusServer } from '@/lib/gemini-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { operationName } = await req.json();

    if (!operationName) {
      return NextResponse.json({ success: false, error: 'Missing operationName' }, { status: 400 });
    }

    const status = await getVideoStatusServer(operationName);

    return NextResponse.json({ 
      success: true, 
      done: status.done,
      error: status.error
    });

  } catch (error: any) {
    console.error('Video status error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
