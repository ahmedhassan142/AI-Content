import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { runPlagiarismCheck } from '@/lib/plagiarism/checker';

/**
 * POST /api/content/plagiarism-check
 *
 * Body: { content, title?, keywords?, isGuest?, guestSessionId? }
 *
 * Runs the 3-layer plagiarism analysis. Authenticated users get the full
 * internal check (Layer 1) against their saved content; guests get heuristic
 * analysis only.
 *
 * Returns: { success, report }
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      content,
      title,
      keywords,
      isGuest,
      guestSessionId,
    } = body as {
      content?: string;
      title?: string;
      keywords?: string[];
      isGuest?: boolean;
      guestSessionId?: string;
    };

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Content is required.' },
        { status: 400 }
      );
    }

    let userId: string | undefined;
    let guestMode = false;

    // Guest path: caller explicitly opts in with isGuest + guestSessionId.
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      guestMode = true;
      console.log('Plagiarism check (guest):', guestSessionId);
    } else {
      // Authenticated path — verify the access token.
      const token = getTokenFromRequest(request);
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized.' },
          { status: 401 }
        );
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return NextResponse.json(
          { success: false, error: 'Invalid token.' },
          { status: 401 }
        );
      }
      userId = decoded.userId;
      guestMode = false;
    }

    const report = await runPlagiarismCheck({
      content,
      title,
      keywords: Array.isArray(keywords) ? keywords : [],
      userId,
      isGuest: guestMode,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: unknown) {
    console.error('Plagiarism check error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to run plagiarism check.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
