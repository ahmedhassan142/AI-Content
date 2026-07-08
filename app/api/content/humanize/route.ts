import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { runPlagiarismCheck } from '@/lib/plagiarism/checker';
import { humanizeContent } from '@/lib/plagiarism/humanizer';
import { fireEvent } from '@/lib/webhooks/sender';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { content, title, keywords, isGuest, guestSessionId } = body;

    let userId: string | undefined;
    let isGuestUser = false;

    // Check if this is a guest request
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      isGuestUser = true;
      console.log('Guest humanize request for session:', guestSessionId);
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

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const effectiveTitle: string =
      typeof title === 'string' && title.trim().length > 0
        ? title.slice(0, 80)
        : content.slice(0, 80);
    const effectiveKeywords: string[] = Array.isArray(keywords) ? keywords : [];

    // 1) Run the current plagiarism / originality check to establish a baseline.
    const currentReport = await runPlagiarismCheck({
      content,
      title: effectiveTitle,
      keywords: effectiveKeywords,
      userId,
      isGuest: isGuestUser,
    });

    const originalScore = currentReport.originalityScore;

    // 2) Humanize the content using the humanizer module.
    const {
      humanizedContent,
      newReport,
      changes,
      improvement,
    } = await humanizeContent(
      content,
      currentReport,
      userId,
      isGuestUser,
      effectiveTitle,
      effectiveKeywords
    );

    const newScore = newReport.originalityScore;
    const humanizedAt = new Date().toISOString();

    // 3) Fire webhook event for authenticated users (non-blocking).
    if (!isGuestUser && userId) {
      fireEvent('content.humanized', userId, {
        originalContent: content,
        humanizedContent,
        originalScore,
        newScore,
        improvement,
        changes,
        title: effectiveTitle,
        humanizedAt,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      content: humanizedContent,
      originalScore,
      newScore,
      improvement,
      changes,
      newReport,
      metadata: {
        humanizedAt,
      },
    });
  } catch (error: any) {
    console.error('Humanize error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to humanize content' },
      { status: 500 }
    );
  }
}
