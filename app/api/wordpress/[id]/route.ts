import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WordPressSite from '@/models/WordPressSite';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

function normalizeUrl(value: string): string {
  let url = value.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * GET /api/wordpress/:id
 * Fetch a single WordPress site (without its application password).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const site = await WordPressSite.findOne({
      _id: id,
      userId: decoded.userId,
    })
      .select('-wpApplicationPassword')
      .lean();

    if (!site) {
      return NextResponse.json({ error: 'WordPress site not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, site });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch WordPress site';
    console.error('[wordpress] GET one error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/wordpress/:id
 * Delete a WordPress site owned by the authenticated user.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const result = await WordPressSite.deleteOne({
      _id: id,
      userId: decoded.userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'WordPress site not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'WordPress site deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete WordPress site';
    console.error('[wordpress] DELETE error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/wordpress/:id
 * Update editable fields: siteName, siteUrl, wpUsername, wpApplicationPassword,
 * defaultStatus, defaultCategoryId, isConnected.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};

    if (typeof body.siteName === 'string' && body.siteName.trim()) {
      update.siteName = body.siteName.trim();
    }

    if (typeof body.siteUrl === 'string' && body.siteUrl.trim()) {
      const normalized = normalizeUrl(body.siteUrl);
      if (!isValidHttpUrl(normalized)) {
        return NextResponse.json(
          { error: 'A valid http(s) WordPress URL is required' },
          { status: 400 }
        );
      }
      update.siteUrl = normalized;
    }

    if (typeof body.wpUsername === 'string' && body.wpUsername.trim()) {
      update.wpUsername = body.wpUsername.trim();
    }

    if (typeof body.wpApplicationPassword === 'string' && body.wpApplicationPassword.trim()) {
      update.wpApplicationPassword = body.wpApplicationPassword.trim();
    }

    if (body.defaultStatus === 'draft' || body.defaultStatus === 'publish') {
      update.defaultStatus = body.defaultStatus;
    }

    if (typeof body.defaultCategoryId === 'number') {
      update.defaultCategoryId = body.defaultCategoryId;
    }

    if (typeof body.isConnected === 'boolean') {
      update.isConnected = body.isConnected;
    }

    const updated = await WordPressSite.findOneAndUpdate(
      { _id: id, userId: decoded.userId },
      { $set: update },
      { new: true }
    )
      .select('-wpApplicationPassword')
      .lean();

    if (!updated) {
      return NextResponse.json({ error: 'WordPress site not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, site: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update WordPress site';
    console.error('[wordpress] PATCH error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
