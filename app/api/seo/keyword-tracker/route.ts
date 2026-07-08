import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Keyword ranking tracker stub.
// To enable: set SERP_API_KEY (Serper.dev / SerpAPI / similar) env var,
// then implement the live lookup below.
export async function POST(request: NextRequest) {
  try {
    const { keywords, domain, location, device } = (await request.json()) as {
      keywords?: string[];
      domain?: string;
      location?: string;
      device?: 'desktop' | 'mobile';
    };

    const apiKey = process.env.SERP_API_KEY || process.env.SERPER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          message:
            'Keyword tracking is not configured. Set SERP_API_KEY (or SERPER_API_KEY) to enable live SERP lookups.',
        },
        { status: 200 }
      );
    }

    // Credentials present — wire in the actual provider SDK to fetch rankings.
    return NextResponse.json({
      success: false,
      configured: true,
      message:
        'SERP API key detected but the tracker is not yet implemented. Add the provider SDK call to fetch rankings.',
      requested: {
        keywords: keywords || [],
        domain,
        location: location || 'global',
        device: device || 'desktop',
      },
    });
  } catch (error: unknown) {
    console.error('[seo/keyword-tracker] error:', error);
    const message = error instanceof Error ? error.message : 'Keyword tracking request failed';
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
  const configured = !!(process.env.SERP_API_KEY || process.env.SERPER_API_KEY);
  return NextResponse.json({
    success: true,
    configured,
    message: configured
      ? 'SERP API key detected.'
      : 'Keyword tracking not configured. Set SERP_API_KEY or SERPER_API_KEY.',
  });
}
