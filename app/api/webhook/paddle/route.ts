// app/api/webhooks/paddle/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headersList = headers();
    const webhookSignature = headersList.get('paddle-signature');

    // Verify webhook signature (important for security)
    // You should verify the signature using your Paddle webhook secret key

    const { event_type, data } = body;

    console.log(`Paddle Webhook: ${event_type}`);

    switch (event_type) {
      case 'subscription.created':
        // Handle new subscription
        const { subscription_id, customer_id, items } = data;
        const priceId = items[0].price_id;
        
        // Update user's subscription status in your database
        // await db.user.update({
        //   where: { paddleCustomerId: customer_id },
        //   data: { 
        //     subscriptionStatus: 'active',
        //     subscriptionId: subscription_id,
        //     plan: getPlanFromPriceId(priceId),
        //   }
        // });
        
        console.log(`✅ Subscription created: ${subscription_id}`);
        break;

      case 'subscription.updated':
        // Handle subscription update (upgrade/downgrade)
        console.log(`🔄 Subscription updated: ${data.subscription_id}`);
        break;

      case 'subscription.cancelled':
        // Handle subscription cancellation
        console.log(`❌ Subscription cancelled: ${data.subscription_id}`);
        // Update user's subscription status to 'cancelled'
        break;

      case 'subscription.payment_succeeded':
        // Handle successful payment
        console.log(`💰 Payment succeeded for: ${data.subscription_id}`);
        break;

      case 'subscription.payment_failed':
        // Handle failed payment
        console.log(`⚠️ Payment failed for: ${data.subscription_id}`);
        break;

      default:
        console.log(`Unhandled event: ${event_type}`);
    }

    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}