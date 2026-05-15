import { NextRequest, NextResponse } from 'next/server';
import { launchTool } from '@/lib/saas-api';

export async function POST(req: NextRequest) {
  try {
    const { userId, toolId } = await req.json();
    if (!userId || !toolId) {
      return NextResponse.json({ success: false, error: 'Missing userId or toolId' }, { status: 400 });
    }

    const data = await launchTool({ userId, toolId });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Launch error details in route:', error);
    // Attempt to parse error details if it came from the SaaS call
    let errorMsg = error.message;
    try {
        const parsed = JSON.parse(error.message);
        errorMsg = parsed.message || parsed.error || error.message;
    } catch {}

    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
