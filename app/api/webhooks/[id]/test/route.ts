import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Webhook from '@/models/Webhook';
import WebhookDelivery from '@/models/WebhookDelivery';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import crypto from 'crypto';

export const runtime = 'nodejs';

function signPayload(body: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * POST /api/webhooks/:id/test
 * Sends a "test" ping event to the webhook URL and records the delivery.
 *
 * Note: "webhook.test" is intentionally NOT part of WEBHOOK_EVENTS so it
 * doesn't require the webhook to subscribe to it — we just deliver it directly.
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

    const webhook = await Webhook.findOne({
      _id: id,
      userId: decoded.userId,
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const event = 'webhook.test';
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      userId: decoded.userId,
      data: {
        message: 'This is a test event from AI Content Writer.',
        webhookId: webhook._id.toString(),
        webhookName: webhook.name,
      },
    };

    const bodyStr = JSON.stringify(payload);
    const signature = signPayload(bodyStr, webhook.secret);

    const startedAt = Date.now();
    let statusCode: number | null = null;
    let responseText = '';
    let success = false;
    let errorMsg: string | null = null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AIContent-Signature': signature,
          'X-AIContent-Event': event,
          'User-Agent': 'AI-Content-Writer-Webhook/1.0',
        },
        body: bodyStr,
        signal: controller.signal,
      });

      statusCode = res.status;
      success = res.status >= 200 && res.status < 300;

      try {
        responseText = await res.text();
      } catch {
        responseText = '';
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        errorMsg = err.name === 'AbortError' ? 'Request timed out after 15s' : err.message;
      } else {
        errorMsg = 'Unknown error';
      }
      success = false;
    } finally {
      clearTimeout(timeout);
    }

    const durationMs = Date.now() - startedAt;
    if (responseText && responseText.length > 2000) {
      responseText = responseText.slice(0, 2000);
    }

    const delivery = await WebhookDelivery.create({
      webhookId: webhook._id,
      userId: decoded.userId,
      event,
      payload,
      statusCode,
      response: responseText,
      success,
      durationMs,
      error: errorMsg,
    });

    webhook.lastFiredAt = new Date();
    webhook.lastStatus = success ? 'success' : 'failed';
    webhook.lastResponseCode = statusCode;
    await webhook.save();

    return NextResponse.json({
      success: true,
      delivery: {
        _id: delivery._id,
        event,
        statusCode,
        success,
        durationMs,
        error: errorMsg,
        response: responseText,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send test webhook';
    console.error('[webhooks] test error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
