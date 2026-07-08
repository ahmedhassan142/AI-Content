import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

/** POST /api/seo/orphan-pages — finds pages with no/few internal links pointing to them */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });

    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIContentSeoBot/1.0)' }, signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const $ = cheerio.load(html);

    const baseUrl = new URL(url);
    const origin = baseUrl.origin;

    // Collect all internal links
    const internalLinks = new Map<string, number>();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      try {
        const linkUrl = new URL(href, url);
        if (linkUrl.origin === origin) {
          const path = linkUrl.pathname;
          internalLinks.set(path, (internalLinks.get(path) || 0) + 1);
        }
      } catch {}
    });

    // Find pages linked 0-1 times (potential orphans)
    const orphanCandidates = Array.from(internalLinks.entries())
      .filter(([_, count]) => count <= 1)
      .map(([path, count]) => ({ path, linkCount: count, url: origin + path }));

    // Pages linked multiple times (healthy)
    const wellLinked = Array.from(internalLinks.entries())
      .filter(([_, count]) => count > 1)
      .map(([path, count]) => ({ path, linkCount: count }));

    return NextResponse.json({
      success: true,
      totalInternalPages: internalLinks.size,
      orphanCandidates: orphanCandidates.slice(0, 20),
      wellLinkedCount: wellLinked.length,
      orphanCount: orphanCandidates.length,
      score: orphanCandidates.length === 0 ? 100 : Math.max(0, 100 - orphanCandidates.length * 10),
      status: orphanCandidates.length === 0 ? 'pass' : 'warn',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
