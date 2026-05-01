import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, usageCount } = body;
    
    console.log(`Guest ${sessionId} usage: ${usageCount}`);
    
    // Optional: Update database
    // await GuestSession.updateOne({ sessionId }, { usageCount });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
  }
}