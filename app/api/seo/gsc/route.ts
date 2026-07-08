import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Google Search Console integration stub.
// To enable: set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, and GSC_PROPERTY_URL
// environment variables, then implement the JWT/service-account exchange below.
export async function POST(request: NextRequest) {
  try {
    const { url, property, action } = (await request.json()) as {
      url?: string;
      property?: string;
      action?: string;
    };

    const clientEmail = process.env.GSC_CLIENT_EMAIL;
    const privateKey = process.env.GSC_PRIVATE_KEY;
    const defaultProperty = process.env.GSC_PROPERTY_URL;

    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          message:
            'Google Search Console is not configured. Set GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY environment variables to enable.',
        },
        { status: 200 }
      );
    }

    // If we get here, credentials are present — but the full implementation
    // (JWT exchange, property list, URL inspection, indexing API) is intentionally
    // left as a stub. Wire in the googleapis / google-auth-library package to
    // complete the integration.
    return NextResponse.json({
      success: false,
      configured: true,
      message:
        'GSC credentials detected but the integration is not yet implemented.',
      requested: { url, property: property || defaultProperty, action },
    });
  } catch (error: unknown) {
    console.error('[seo/gsc] error:', error);
    const message = error instanceof Error ? error.message : 'GSC request failed';
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const configured = !!(process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY);
  return NextResponse.json({
    success: true,
    configured,
    message: configured
      ? 'GSC credentials detected.'
      : 'GSC not configured. Set GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY.',
  });
}
