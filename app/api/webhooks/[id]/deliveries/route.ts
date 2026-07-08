import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WebhookDelivery from '@/models/WebhookDelivery';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/webhooks/:id/deliveries
 * Returns the last 50 delivery logs for the given webhook.
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

    const deliveries = await WebhookDelivery.find({
      webhookId: id,
      userId: decoded.userId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ success: true, deliveries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch deliveries';
    console.error('[webhooks] deliveries error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
