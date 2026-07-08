import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const USER_AGENT =
  'Mozilla/5.0 (compatible; AIContentSeoBot/1.0; +https://ai-content.app/bot)';
const FETCH_TIMEOUT_MS = 10000;
const MAX_HOPS = 10;

type RedirectType =
  | '301'
  | '302'
  | '303'
  | '307'
  | '308'
  | 'none'
  | 'manual_required'
  | 'loop'
  | 'max_reached'
  | 'error';

interface ChainHop {
  url: string;
  status: number;
  location: string | null;
  type: RedirectType;
}

function normalizeUrl(input: string): string {
  let trimmed = (input || '').trim();
  if (!trimmed) return '';
  trimmed = trimmed.replace(/^["'`]+|["'`]+$/g, '');
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
  try {
    const u = new URL(trimmed);
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname === '/') u.pathname = '';
    return u.toString();
  } catch {
    return trimmed;
  }
}

function redirectTypeFromStatus(status: number): RedirectType {
  switch (status) {
    case 301:
      return '301';
    case 302:
      return '302';
    case 303:
      return '303';
    case 307:
      return '307';
    case 308:
      return '308';
    default:
      return 'none';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const startUrl = normalizeUrl(url);
    if (!startUrl) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      );
    }

    const chain: ChainHop[] = [];
    const visited = new Set<string>();
    let currentUrl = startUrl;
    let hasLoop = false;
    let maxReached = false;
    let finalUrl = startUrl;
    let lastError: string | undefined;

    for (let i = 0; i < MAX_HOPS; i++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let status = 0;
      let location: string | null = null;
      let errored = false;

      try {
        const res = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          },
          redirect: 'manual',
          signal: controller.signal,
        });

        status = res.status;
        location = res.headers.get('location');

        // Some servers return 200 with content but the request still went through.
        chain.push({
          url: currentUrl,
          status,
          location,
          type: redirectTypeFromStatus(status),
        });
        finalUrl = currentUrl;

        if (status >= 300 && status < 400 && location) {
          // Resolve relative location
          let nextUrl: string;
          try {
            nextUrl = new URL(location, currentUrl).toString();
          } catch {
            nextUrl = location;
          }

          if (visited.has(nextUrl)) {
            hasLoop = true;
            chain.push({
              url: nextUrl,
              status: 0,
              location: null,
              type: 'loop',
            });
            break;
          }

          visited.add(currentUrl);
          currentUrl = nextUrl;
        } else {
          // Not a redirect — we are done
          break;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        lastError = message;
        errored = true;
        chain.push({
          url: currentUrl,
          status: 0,
          location: null,
          type: 'error',
        });
        break;
      } finally {
        clearTimeout(timer);
      }

      if (errored) break;
    }

    if (chain.length >= MAX_HOPS && !hasLoop) {
      // Check if we exited the loop because of hop limit
      const last = chain[chain.length - 1];
      if (last && last.status >= 300 && last.status < 400) {
        maxReached = true;
        chain.push({
          url: '',
          status: 0,
          location: null,
          type: 'max_reached',
        });
      }
    }

    const redirectCount = chain.filter(
      (h) => h.status >= 300 && h.status < 400
    ).length;

    const isChain = redirectCount > 1;
    const warnings: string[] = [];
    if (hasLoop) warnings.push('Redirect loop detected.');
    if (maxReached) warnings.push(`Reached maximum of ${MAX_HOPS} redirects.`);
    if (isChain)
      warnings.push(
        `Redirect chain has ${redirectCount} hops — consider linking directly to the final URL.`
      );
    if (lastError) warnings.push(`Network error: ${lastError}`);

    // Identify non-permanent redirects
    const nonPermanent = chain.filter(
      (h) => h.type === '302' || h.type === '307'
    );
    if (nonPermanent.length > 0) {
      warnings.push(
        'Found temporary (302/307) redirects. Use 301/308 for permanent moves to preserve SEO link equity.'
      );
    }

    return NextResponse.json({
      success: true,
      chain,
      finalUrl,
      totalRedirects: redirectCount,
      hasLoop,
      isChain,
      maxReached,
      warnings,
    });
  } catch (error: unknown) {
    console.error('[seo/redirect-check] error:', error);
    const message =
      error instanceof Error ? error.message : 'Redirect check failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
