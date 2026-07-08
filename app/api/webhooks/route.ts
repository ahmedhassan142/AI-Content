import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Webhook, { WEBHOOK_EVENTS, WebhookEvent } from '@/models/Webhook';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { generateWebhookSecret } from '@/lib/webhooks/sender';

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
 * GET /api/webhooks
 * List all webhooks for the authenticated user. Excludes the secret field.
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

    const webhooks = await Webhook.find({ userId: decoded.userId })
      .select('-secret')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, webhooks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch webhooks';
    console.error('[webhooks] GET list error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/webhooks
 * Create a new webhook for the authenticated user.
 * Body: { name, url, events, secret? }
 * Returns the created webhook WITH the secret (shown only this one time).
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
    const { name, url, events, secret } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!url || typeof url !== 'string' || !isValidHttpUrl(url)) {
      return NextResponse.json(
        { error: 'A valid http(s) URL is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'At least one event must be selected' },
        { status: 400 }
      );
    }

    const validEvents = events.filter((e: unknown): e is WebhookEvent =>
      typeof e === 'string' && (WEBHOOK_EVENTS as readonly string[]).includes(e)
    );

    if (validEvents.length !== events.length) {
      return NextResponse.json(
        { error: 'One or more selected events are not valid' },
        { status: 400 }
      );
    }

    const finalSecret =
      typeof secret === 'string' && secret.trim().length >= 16
        ? secret.trim()
        : generateWebhookSecret();

    const webhook = await Webhook.create({
      userId: decoded.userId,
      name: name.trim(),
      url: url.trim(),
      secret: finalSecret,
      events: validEvents,
      isActive: true,
      lastFiredAt: null,
      lastStatus: null,
      lastResponseCode: null,
    });

    // Return WITH secret one time so the user can copy it.
    return NextResponse.json(
      {
        success: true,
        webhook: {
          _id: webhook._id,
          userId: webhook.userId,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.isActive,
          lastFiredAt: webhook.lastFiredAt,
          lastStatus: webhook.lastStatus,
          lastResponseCode: webhook.lastResponseCode,
          createdAt: webhook.createdAt,
          updatedAt: webhook.updatedAt,
          secret: webhook.secret,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create webhook';
    console.error('[webhooks] POST create error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
