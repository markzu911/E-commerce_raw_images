import { NextRequest, NextResponse } from 'next/server';
import { launchTool, verifyBeforeGenerate, consumeIntegral } from '@/lib/saas-api';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  try {
    const body = await req.json();
    const { userId, toolId } = body;

    if (!userId || !toolId) {
      return NextResponse.json({ success: false, error: 'Missing userId or toolId' }, { status: 400 });
    }

    let result;
    switch (action) {
      case 'launch':
        result = await launchTool({ userId, toolId });
        break;
      case 'verify':
        result = await verifyBeforeGenerate({ userId, toolId });
        break;
      case 'consume':
        result = await consumeIntegral({ userId, toolId });
        break;
      default:
        return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[API/Tool/${action}] Error:`, error.message);
    let errorMsg = error.message;
    let status = 500;
    
    try {
      // If error message is a JSON string from SaaS
      const parsed = JSON.parse(error.message);
      if (parsed.error || parsed.message) {
        errorMsg = parsed.error || parsed.message;
      }
    } catch {
      // Not JSON
    }

    return NextResponse.json({ success: false, error: errorMsg }, { status });
  }
}
