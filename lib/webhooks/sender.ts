import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import Webhook from '@/models/Webhook';
import WebhookDelivery from '@/models/WebhookDelivery';
import { WEBHOOK_EVENTS } from '@/models/Webhook';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  userId: string;
  data: Record<string, unknown>;
}

/**
 * Generate a fresh HMAC secret for signing webhook payloads.
 * Returns 64 hex characters (32 random bytes).
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compute the HMAC-SHA256 signature of the raw body using the webhook secret.
 * Returns the signature in the `sha256=<hex>` form used in the
 * `X-AIContent-Signature` header.
 */
function signPayload(body: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Deliver a single webhook payload to one webhook endpoint.
 * Records the result (success or failure) to the WebhookDelivery collection
 * and updates the parent webhook's lastFiredAt / lastStatus / lastResponseCode.
 *
 * This function never throws — all errors are captured and logged.
 */
async function deliver(
  webhook: {
    _id: string;
    userId: string;
    url: string;
    secret: string;
  },
  event: string,
  payload: WebhookPayload
): Promise<void> {
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
      if (err.name === 'AbortError') {
        errorMsg = 'Request timed out after 15s';
      } else {
        errorMsg = err.message;
      }
    } else {
      errorMsg = 'Unknown error';
    }
    success = false;
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - startedAt;

  // Truncate response before persisting (defense in depth — the schema also caps it).
  if (responseText && responseText.length > 2000) {
    responseText = responseText.slice(0, 2000);
  }

  try {
    await WebhookDelivery.create({
      webhookId: webhook._id,
      userId: webhook.userId,
      event,
      payload,
      statusCode,
      response: responseText,
      success,
      durationMs,
      error: errorMsg,
    });

    await Webhook.updateOne(
      { _id: webhook._id },
      {
        $set: {
          lastFiredAt: new Date(),
          lastStatus: success ? 'success' : 'failed',
          lastResponseCode: statusCode,
        },
      }
    );
  } catch (logErr) {
    console.error('[webhooks] Failed to persist delivery log:', logErr);
  }
}

/**
 * Fire a webhook event for a user.
 *
 * This is a fire-and-forget helper — it resolves immediately after dispatching
 * deliveries in the background and NEVER throws. Any error (DB, network, etc.)
 * is caught and logged so that the calling code path is unaffected.
 *
 * @param event   One of the values in WEBHOOK_EVENTS.
 * @param userId  The user who owns the webhooks.
 * @param data    Arbitrary JSON-serialisable payload to deliver.
 */
export async function fireEvent(
  event: string,
  userId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    if (!WEBHOOK_EVENTS.includes(event as (typeof WEBHOOK_EVENTS)[number])) {
      console.warn(`[webhooks] Ignoring unknown event: ${event}`);
      return;
    }
    if (!userId) {
      console.warn('[webhooks] fireEvent called without a userId');
      return;
    }

    await connectDB();

    const webhooks = await Webhook.find({
      userId,
      isActive: true,
      events: event,
    })
      .select('_id userId url secret')
      .lean();

    if (!webhooks || webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      userId,
      data,
    };

    // Fire all deliveries in parallel; each one is internally safe.
    await Promise.allSettled(
      webhooks.map((w) =>
        deliver(
          {
            _id: w._id.toString(),
            userId: w.userId,
            url: w.url,
            secret: w.secret,
          },
          event,
          payload
        )
      )
    );
  } catch (err) {
    console.error(`[webhooks] fireEvent error for "${event}":`, err);
  }
}
