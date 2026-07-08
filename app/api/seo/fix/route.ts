import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SeoAudit from '@/models/SeoAudit';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { normalizeUrl } from '@/lib/seo/auditor';
import { generateSeoFixes } from '@/lib/seo/fixer';
import { fireEvent } from '@/lib/webhooks/sender';

export const runtime = 'nodejs';
export const maxDuration = 60;

const USER_AGENT =
  'Mozilla/5.0 (compatible; AIContentSeoBot/1.0; +https://ai-content.app/bot)';

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { url, auditId, isGuest, guestSessionId } = body as {
      url?: string;
      auditId?: string;
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

    // Load the audit (by auditId if provided, otherwise latest for this URL)
    let auditDoc: Awaited<ReturnType<typeof SeoAudit.findOne>> = null;
    if (auditId) {
      auditDoc = await SeoAudit.findOne({ _id: auditId, userId });
    } else {
      auditDoc = await SeoAudit.findOne({ userId, normalizedUrl }).sort({
        createdAt: -1,
      });
    }

    // Fetch fresh HTML for the fixer (the audit doesn't store raw HTML)
    let html = '';
    try {
      html = await fetchHtml(normalizedUrl);
    } catch (err) {
      console.error('[seo/fix] fetchHtml failed:', err);
    }

    const checks =
      auditDoc?.checks?.map((c: { checkId: string; name: string; status: 'pass' | 'warn' | 'fail' | 'info'; score: number; message: string; details?: Record<string, unknown>; recommendation?: string }) => ({
        checkId: c.checkId,
        name: c.name,
        status: c.status,
        score: c.score,
        message: c.message,
        details: c.details,
        recommendation: c.recommendation,
      })) || [];

    const fixResult = generateSeoFixes({
      url: normalizedUrl,
      html,
      checks,
    });

    // Fire webhook for authenticated users
    if (!isGuestUser) {
      try {
        await fireEvent('seo.fixed', userId, {
          auditId: auditDoc?._id?.toString() || null,
          url: normalizedUrl,
          fixed: fixResult.summary.fixed,
          cannotFix: fixResult.summary.cannotFix,
          alreadyOk: fixResult.summary.alreadyOk,
          total: fixResult.summary.total,
          generatedRobotsTxt: !!fixResult.generatedFiles.robotsTxt,
          generatedSitemapXml: !!fixResult.generatedFiles.sitemapXml,
        });
      } catch (err) {
        console.error('[seo/fix] webhook fireEvent failed:', err);
      }
    }

    const auditPayload = auditDoc
      ? {
          _id: auditDoc._id,
          url: auditDoc.url,
          normalizedUrl: auditDoc.normalizedUrl,
          finalUrl: auditDoc.finalUrl,
          overallScore: auditDoc.overallScore,
          passedChecks: auditDoc.passedChecks,
          warnedChecks: auditDoc.warnedChecks,
          failedChecks: auditDoc.failedChecks,
          totalChecks: auditDoc.totalChecks,
          checks: auditDoc.checks,
          actionPlan: auditDoc.actionPlan,
          createdAt: auditDoc.createdAt,
        }
      : null;

    return NextResponse.json({
      success: true,
      audit: auditPayload,
      fixes: fixResult.fixes,
      generatedFiles: fixResult.generatedFiles,
      summary: fixResult.summary,
      isGuest: isGuestUser,
    });
  } catch (error: unknown) {
    console.error('[seo/fix] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate SEO fixes';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
