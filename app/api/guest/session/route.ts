import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

// Optional: Store guest sessions in database for analytics
// If you don't want to store, just return success

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;
    
    console.log('Guest session created:', sessionId);
    
    // Optional: Store in database
    // await GuestSession.create({ sessionId, createdAt: new Date() });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Guest session error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}