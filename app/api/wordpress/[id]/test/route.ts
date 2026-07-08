import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WordPressSite from '@/models/WordPressSite';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { testWordPressConnection } from '../../route';

export const runtime = 'nodejs';

/**
 * POST /api/wordpress/:id/test
 * Re-tests the connection to a stored WordPress site using Basic Auth.
 */
export async function POST(
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
    });

    if (!site) {
      return NextResponse.json({ error: 'WordPress site not found' }, { status: 404 });
    }

    try {
      const user = await testWordPressConnection(
        site.siteUrl,
        site.wpUsername,
        site.wpApplicationPassword
      );

      // Mark the site as connected if the test succeeds.
      if (!site.isConnected) {
        site.isConnected = true;
        await site.save();
      }

      return NextResponse.json({
        success: true,
        user: { name: user.name, username: user.username },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';

      // Mark disconnected so the UI can flag it.
      if (site.isConnected) {
        site.isConnected = false;
        await site.save().catch(() => {});
      }

      return NextResponse.json(
        { success: false, error: message },
        { status: 200 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to test WordPress site';
    console.error('[wordpress] test error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
