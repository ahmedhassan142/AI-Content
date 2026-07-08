import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SeoAudit from '@/models/SeoAudit';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
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

    const audit = await SeoAudit.findOne({
      _id: id,
      userId: decoded.userId,
    });

    if (!audit) {
      return NextResponse.json(
        { success: false, error: 'Audit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      audit: {
        _id: audit._id,
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
        createdAt: audit.createdAt,
        updatedAt: audit.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error('[seo/history/[id] GET] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch SEO audit';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
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

    const result = await SeoAudit.deleteOne({
      _id: id,
      userId: decoded.userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Audit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'SEO audit deleted successfully',
    });
  } catch (error: unknown) {
    console.error('[seo/history/[id] DELETE] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete SEO audit';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
