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
    console.error('Launch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
