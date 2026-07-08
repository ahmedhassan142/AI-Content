import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Webhook, { WEBHOOK_EVENTS, WebhookEvent } from '@/models/Webhook';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * GET /api/webhooks/:id
 * Fetch a single webhook (without its secret).
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

    const webhook = await Webhook.findOne({
      _id: id,
      userId: decoded.userId,
    })
      .select('-secret')
      .lean();

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, webhook });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch webhook';
    console.error('[webhooks] GET one error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook owned by the authenticated user.
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

    const result = await Webhook.deleteOne({
      _id: id,
      userId: decoded.userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Webhook deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete webhook';
    console.error('[webhooks] DELETE error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/webhooks/:id
 * Update editable fields: isActive, name, url, events.
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

    if (typeof body.isActive === 'boolean') {
      update.isActive = body.isActive;
    }

    if (typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim();
    }

    if (typeof body.url === 'string' && body.url.trim()) {
      if (!isValidHttpUrl(body.url.trim())) {
        return NextResponse.json(
          { error: 'A valid http(s) URL is required' },
          { status: 400 }
        );
      }
      update.url = body.url.trim();
    }

    if (Array.isArray(body.events)) {
      const validEvents = body.events.filter(
        (e: unknown): e is WebhookEvent =>
          typeof e === 'string' && (WEBHOOK_EVENTS as readonly string[]).includes(e)
      );
      if (validEvents.length === 0) {
        return NextResponse.json(
          { error: 'At least one valid event must be selected' },
          { status: 400 }
        );
      }
      update.events = validEvents;
    }

    const updated = await Webhook.findOneAndUpdate(
      { _id: id, userId: decoded.userId },
      { $set: update },
      { new: true }
    )
      .select('-secret')
      .lean();

    if (!updated) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, webhook: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update webhook';
    console.error('[webhooks] PATCH error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
