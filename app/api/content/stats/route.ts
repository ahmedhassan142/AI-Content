import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Content from '@/models/Content';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const isGuest = searchParams.get('isGuest') === 'true';
    const guestSessionId = searchParams.get('guestSessionId');
    
    let userId;
    
    // Check if this is a guest request
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      console.log('Guest stats request for session:', guestSessionId);
      
      // For guest, return stats from localStorage (frontend will handle)
      return NextResponse.json({
        success: true,
        stats: {
          totalContents: 0,
          favoriteContents: 0,
          totalWords: 0,
          recentContents: [],
        },
        isGuest: true,
      });
    } else {
      const token = getTokenFromRequest(request);
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const decoded = verifyToken(token);
      if (!decoded) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      
      userId = decoded.userId;
    }
    
    const totalContents = await Content.countDocuments({ userId });
    const favoriteContents = await Content.countDocuments({ userId, isFavorite: true });
    
    const contents = await Content.find({ userId });
    const totalWords = contents.reduce((sum, c) => sum + (c.content?.split(' ').length || 0), 0);
    
    const recentContents = await Content.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5);
    
    return NextResponse.json({
      success: true,
      stats: {
        totalContents,
        favoriteContents,
        totalWords,
        recentContents,
      },
    });
    
  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}