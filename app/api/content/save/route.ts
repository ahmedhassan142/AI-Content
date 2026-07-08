import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Content from '@/models/Content';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { fireEvent } from '@/lib/webhooks/sender';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      title,
      content,
      type,
      tone,
      length,
      language,
      seoKeywords,
      plagiarismScore,
      isGuest,
      guestSessionId,
    } = body;

    let userId: string | undefined;
    let isGuestUser = false;

    // Check if this is a guest request
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      isGuestUser = true;
    } else {
      // Regular authenticated user
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

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const savedContent = await Content.create({
      userId,
      isGuest: isGuestUser,
      title,
      content,
      type: type || 'generated',
      tone: tone || 'professional',
      length: length || 'medium',
      language: language || 'English',
      seoKeywords: seoKeywords || [],
      plagiarismScore: plagiarismScore || null,
      isFavorite: false,
    });

    const contentId = String(savedContent._id);
    const savedAt = new Date().toISOString();

    // Fire webhook event for authenticated users only (non-blocking)
    if (!isGuestUser && userId) {
      fireEvent('content.saved', userId, {
        contentId,
        title,
        content,
        type: type || 'generated',
        tone: tone || 'professional',
        length: length || 'medium',
        language: language || 'English',
        seoKeywords: seoKeywords || [],
        plagiarismScore: plagiarismScore ?? null,
        savedAt,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        content: savedContent,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Save error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save content' },
      { status: 500 }
    );
  }
}
