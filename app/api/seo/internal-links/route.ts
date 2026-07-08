import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const maxDuration = 45;

const USER_AGENT =
  'Mozilla/5.0 (compatible; AIContentSeoBot/1.0; +https://ai-content.app/bot)';
const FETCH_TIMEOUT_MS = 15000;
const LINK_CHECK_TIMEOUT_MS = 6000;
const MAX_LINKS_TO_CHECK = 5; // HEAD-check only first N to avoid timeouts

interface InternalLink {
  url: string;
  anchorText: string;
  nofollow: boolean;
  status: number | 'skipped' | 'error';
  isBroken: boolean;
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

async function fetchHtml(
  url: string
): Promise<{ ok: boolean; html: string; status: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const html = await res.text();
    return { ok: res.ok, html, status: res.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, html: '', status: 0, error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function checkLinkStatus(url: string): Promise<number | 'error'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET', // many servers reject HEAD; use GET with abort-on-headers if available
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    return res.status;
  } catch {
    // Try HEAD as a fallback
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: controller.signal,
      });
      return res.status;
    } catch {
      return 'error';
    }
  } finally {
    clearTimeout(timer);
  }
}

function isSameDomain(linkUrl: string, baseHost: string): boolean {
  try {
    const u = new URL(linkUrl);
    return u.hostname.toLowerCase() === baseHost;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, keywords } = (await request.json()) as {
      url?: string;
      keywords?: string;
    };

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      );
    }

    let baseHost = '';
    try {
      baseHost = new URL(normalizedUrl).hostname.toLowerCase();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      );
    }

    const fetchResult = await fetchHtml(normalizedUrl);
    if (!fetchResult.ok || !fetchResult.html) {
      return NextResponse.json(
        {
          success: false,
          error:
            fetchResult.error ||
            `Failed to fetch URL (status ${fetchResult.status})`,
        },
        { status: 502 }
      );
    }

    const $ = cheerio.load(fetchResult.html);

    // Remove script/style/noscript/textarea content from anchor text extraction
    $('script, style, noscript').remove();

    const targetKeywords = (keywords || '')
      .split(/[,\n]/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const internalLinks: InternalLink[] = [];
    const externalLinks: string[] = [];
    const seenInternal = new Set<string>();

    const anchorEls = $('a[href]').toArray();

    for (const el of anchorEls) {
      const rawHref = $(el).attr('href') || '';
      const rel = $(el).attr('rel') || '';
      const anchorText = ($(el).text() || '').trim().replace(/\s+/g, ' ');
      const nofollow =
        /nofollow/i.test(rel) || /nofollow/i.test($(el).attr('data-rel') || '');

      if (!rawHref) continue;

      // Skip anchors, javascript, mailto, tel
      if (/^(#|javascript:|mailto:|tel:|data:)/i.test(rawHref)) continue;

      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(rawHref, normalizedUrl).toString();
      } catch {
        continue;
      }

      // Strip hash
      try {
        const u = new URL(absoluteUrl);
        u.hash = '';
        absoluteUrl = u.toString();
      } catch {
        /* noop */
      }

      const isInternal = isSameDomain(absoluteUrl, baseHost);

      if (isInternal) {
        if (seenInternal.has(absoluteUrl)) {
          // Mark duplicate anchor text on first occurrence? skip duplicate URLs for status check
          continue;
        }
        seenInternal.add(absoluteUrl);

        const anchorLower = anchorText.toLowerCase();
        const containsTargetKeyword =
          targetKeywords.length > 0
            ? targetKeywords.some((k) => anchorLower.includes(k))
            : false;

        // For the first N internal links, check status; rest skipped
        const shouldCheck =
          internalLinks.filter((l) => l.status !== 'skipped').length <
          MAX_LINKS_TO_CHECK;

        let status: number | 'skipped' | 'error' = 'skipped';
        if (shouldCheck) {
          status = await checkLinkStatus(absoluteUrl);
        }

        const isBroken =
          status === 'error' ||
          (typeof status === 'number' && (status >= 400 || status === 0));

        internalLinks.push({
          url: absoluteUrl,
          anchorText: anchorText || '(no anchor text)',
          nofollow,
          status,
          isBroken,
        });

        // Tag keyword match in URL anchor (we'll surface this in suggestions)
        if (containsTargetKeyword) {
          // store on the link via an extra property in a side map — but to keep the
          // interface clean, we instead emit a separate flag below by checking again.
        }
      } else {
        externalLinks.push(absoluteUrl);
      }
    }

    // Identify orphan candidates: pages with fewer than 2 internal inbound links
    // We can only count outbound links *from this page*; orphans heuristic: any
    // internal URL that appears only once on the page (i.e. only self-referencing).
    const orphanCandidates = internalLinks.filter(
      (l) => l.url === normalizedUrl || l.url === normalizedUrl + '/'
    );

    // Suggestions
    const suggestions: string[] = [];
    const broken = internalLinks.filter((l) => l.isBroken);
    if (broken.length > 0) {
      suggestions.push(
        `Found ${broken.length} broken internal link(s). Fix or remove them.`
      );
    }
    const noAnchor = internalLinks.filter(
      (l) => l.anchorText === '(no anchor text)'
    );
    if (noAnchor.length > 0) {
      suggestions.push(
        `${noAnchor.length} internal link(s) have no anchor text. Add descriptive text.`
      );
    }
    const nofollowLinks = internalLinks.filter((l) => l.nofollow);
    if (nofollowLinks.length > 0) {
      suggestions.push(
        `${nofollowLinks.length} internal link(s) are nofollow. Use dofollow for important internal links to pass link equity.`
      );
    }
    if (targetKeywords.length > 0) {
      const matched = internalLinks.filter((l) =>
        targetKeywords.some((k) => l.anchorText.toLowerCase().includes(k))
      );
      if (matched.length === 0) {
        suggestions.push(
          `No internal links use your target keyword(s) as anchor text. Add contextual links.`
        );
      } else {
        suggestions.push(
          `${matched.length} internal link(s) use target keyword(s) in anchor text. Good job.`
        );
      }
    }
    if (internalLinks.length < 5) {
      suggestions.push(
        `Only ${internalLinks.length} internal links on this page. Add more contextual links to related content.`
      );
    }
    if (externalLinks.length > internalLinks.length && externalLinks.length > 5) {
      suggestions.push(
        `More external links (${externalLinks.length}) than internal links (${internalLinks.length}). Consider balancing.`
      );
    }
    if (orphanCandidates.length === internalLinks.length) {
      suggestions.push(
        `This page links to itself only — make sure other pages on your site link to it.`
      );
    }

    return NextResponse.json({
      success: true,
      url: normalizedUrl,
      totalLinks: internalLinks.length + externalLinks.length,
      internalLinksCount: internalLinks.length,
      externalLinksCount: externalLinks.length,
      internalLinks,
      externalLinks: externalLinks.slice(0, 50), // cap
      targetKeywords,
      suggestions,
    });
  } catch (error: unknown) {
    console.error('[seo/internal-links] error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal link analysis failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
