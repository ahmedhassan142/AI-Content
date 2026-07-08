import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SeoAudit from '@/models/SeoAudit';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const guestSessionId = searchParams.get('guestSessionId');

    let userId: string;
    let isGuestUser = false;

    if (guestSessionId) {
      userId = guestSessionId;
      isGuestUser = true;
    } else {
      const token = getTokenFromRequest(request);
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      const decoded = verifyToken(token);
      if (!decoded) {
        return NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401 }
        );
      }
      userId = decoded.userId;
    }

    const query = { userId, isGuest: isGuestUser };

    const [audits, total] = await Promise.all([
      SeoAudit.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          'url normalizedUrl overallScore totalChecks passedChecks warnedChecks failedChecks httpStatus responseTimeMs createdAt'
        ),
      SeoAudit.countDocuments(query),
    ]);

    const lightAudits = audits.map((a: { _id: unknown; url: string; normalizedUrl: string; overallScore: number; totalChecks: number; passedChecks: number; warnedChecks: number; failedChecks: number; httpStatus?: number; responseTimeMs?: number; createdAt: Date }) => ({
      _id: a._id,
      url: a.url,
      normalizedUrl: a.normalizedUrl,
      overallScore: a.overallScore,
      totalChecks: a.totalChecks,
      passedChecks: a.passedChecks,
      warnedChecks: a.warnedChecks,
      failedChecks: a.failedChecks,
      httpStatus: a.httpStatus,
      responseTimeMs: a.responseTimeMs,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({
      success: true,
      audits: lightAudits,
      isGuest: isGuestUser,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error: unknown) {
    console.error('[seo/history] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch SEO audit history';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
