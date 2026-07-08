import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SeoAudit from '@/models/SeoAudit';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { runSeoAudit, normalizeUrl } from '@/lib/seo/auditor';
import { fireEvent } from '@/lib/webhooks/sender';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { url, fastMode, isGuest, guestSessionId } = body as {
      url?: string;
      fastMode?: boolean;
      isGuest?: boolean;
      guestSessionId?: string;
    };

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    let userId: string;
    let isGuestUser = false;

    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      isGuestUser = true;
    } else {
      const token = getTokenFromRequest(request);
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized — no token provided' },
          { status: 401 }
        );
      }
      const decoded = verifyToken(token);
      if (!decoded) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized — invalid token' },
          { status: 401 }
        );
      }
      userId = decoded.userId;
    }

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      );
    }

    const audit = await runSeoAudit({ url, fastMode: !!fastMode });

    // Save the audit (omit the raw HTML to keep the doc small)
    const saved = await SeoAudit.create({
      userId,
      isGuest: isGuestUser,
      url: audit.url,
      normalizedUrl: audit.normalizedUrl,
      finalUrl: audit.finalUrl,
      httpStatus: audit.httpStatus,
      responseTimeMs: audit.responseTimeMs,
      overallScore: audit.overallScore,
      totalChecks: audit.totalChecks,
      passedChecks: audit.passedChecks,
      warnedChecks: audit.warnedChecks,
      failedChecks: audit.failedChecks,
      checks: audit.checks,
      actionPlan: audit.actionPlan,
    });

    // Fire webhook event for authenticated users
    if (!isGuestUser) {
      try {
        await fireEvent('seo.audited', userId, {
          auditId: String(saved._id as unknown),
          url: audit.url,
          normalizedUrl: audit.normalizedUrl,
          overallScore: audit.overallScore,
          passedChecks: audit.passedChecks,
          warnedChecks: audit.warnedChecks,
          failedChecks: audit.failedChecks,
          totalChecks: audit.totalChecks,
          fastMode: !!fastMode,
        });
      } catch (err) {
        console.error('[seo/audit] webhook fireEvent failed:', err);
      }
    }

    return NextResponse.json({
      success: true,
      audit: {
        _id: saved._id,
        url: saved.url,
        normalizedUrl: saved.normalizedUrl,
        finalUrl: saved.finalUrl,
        httpStatus: saved.httpStatus,
        responseTimeMs: saved.responseTimeMs,
        overallScore: saved.overallScore,
        totalChecks: saved.totalChecks,
        passedChecks: saved.passedChecks,
        warnedChecks: saved.warnedChecks,
        failedChecks: saved.failedChecks,
        checks: saved.checks,
        actionPlan: saved.actionPlan,
        createdAt: saved.createdAt,
      },
      isGuest: isGuestUser,
    });
  } catch (error: unknown) {
    console.error('[seo/audit] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to run SEO audit';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

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
        .select('-checks'),
      SeoAudit.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      audits,
      isGuest: isGuestUser,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error: unknown) {
    console.error('[seo/audit GET] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch audit history';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
