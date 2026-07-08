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
  // Strip trailing slash so we can safely append /wp-json/...
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

function buildBasicAuthHeader(username: string, password: string): string {
  const raw = `${username}:${password}`;
  // Buffer is available in the Node.js runtime.
  const encoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(raw).toString('base64')
      : btoa(raw);
  return `Basic ${encoded}`;
}

/**
 * Tests a WordPress connection by calling the /wp-json/wp/v2/users/me endpoint.
 * Returns the WordPress user on success or throws on failure.
 */
export async function testWordPressConnection(
  siteUrl: string,
  username: string,
  password: string
): Promise<{ name: string; username: string }> {
  const endpoint = `${siteUrl}/wp-json/wp/v2/users/me`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: buildBasicAuthHeader(username, password),
        Accept: 'application/json',
        'User-Agent': 'AI-Content-Writer/1.0',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `WordPress returned HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) detail = body.message;
      } catch {
        /* ignore non-JSON error body */
      }
      throw new Error(detail);
    }

    const user = (await res.json()) as { name?: string; username?: string; slug?: string };
    return {
      name: user.name || user.username || username,
      username: user.username || user.slug || username,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * GET /api/wordpress
 * List all connected WordPress sites for the authenticated user.
 * Excludes the application password field.
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const sites = await WordPressSite.find({ userId: decoded.userId })
      .select('-wpApplicationPassword')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, sites });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch WordPress sites';
    console.error('[wordpress] GET list error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/wordpress
 * Add a new WordPress site connection. Tests the connection first.
 * Body: { siteName, siteUrl, wpUsername, wpApplicationPassword, defaultStatus? }
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { siteName, siteUrl, wpUsername, wpApplicationPassword, defaultStatus } = body || {};

    if (!siteName || typeof siteName !== 'string' || !siteName.trim()) {
      return NextResponse.json({ error: 'Site name is required' }, { status: 400 });
    }

    if (!siteUrl || typeof siteUrl !== 'string' || !siteUrl.trim()) {
      return NextResponse.json({ error: 'WordPress URL is required' }, { status: 400 });
    }

    const normalizedUrl = normalizeUrl(siteUrl);
    if (!isValidHttpUrl(normalizedUrl)) {
      return NextResponse.json(
        { error: 'A valid http(s) WordPress URL is required' },
        { status: 400 }
      );
    }

    if (!wpUsername || typeof wpUsername !== 'string' || !wpUsername.trim()) {
      return NextResponse.json({ error: 'WordPress username is required' }, { status: 400 });
    }

    if (
      !wpApplicationPassword ||
      typeof wpApplicationPassword !== 'string' ||
      !wpApplicationPassword.trim()
    ) {
      return NextResponse.json(
        { error: 'Application password is required' },
        { status: 400 }
      );
    }

    const status: 'draft' | 'publish' =
      defaultStatus === 'publish' ? 'publish' : 'draft';

    // Test the connection before saving.
    let testedUser: { name: string; username: string };
    try {
      testedUser = await testWordPressConnection(
        normalizedUrl,
        wpUsername.trim(),
        wpApplicationPassword.trim()
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      return NextResponse.json(
        { error: `Could not connect to WordPress: ${message}` },
        { status: 400 }
      );
    }

    const site = await WordPressSite.create({
      userId: decoded.userId,
      siteName: siteName.trim(),
      siteUrl: normalizedUrl,
      wpUsername: wpUsername.trim(),
      wpApplicationPassword: wpApplicationPassword.trim(),
      defaultStatus: status,
      isConnected: true,
      lastPublishedAt: null,
    });

    // Return without the password.
    return NextResponse.json(
      {
        success: true,
        site: {
          _id: site._id,
          userId: site.userId,
          siteName: site.siteName,
          siteUrl: site.siteUrl,
          wpUsername: site.wpUsername,
          defaultStatus: site.defaultStatus,
          defaultCategoryId: site.defaultCategoryId,
          isConnected: site.isConnected,
          lastPublishedAt: site.lastPublishedAt,
          createdAt: site.createdAt,
          updatedAt: site.updatedAt,
        },
        testedUser,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add WordPress site';
    console.error('[wordpress] POST create error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
