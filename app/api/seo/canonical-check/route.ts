import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

/** POST /api/seo/canonical-check — checks canonical tag */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });

    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIContentSeoBot/1.0)' }, signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const $ = cheerio.load(html);

    const canonical = $('link[rel="canonical"]').attr('href') || '';
    const ogUrl = $('meta[property="og:url"]').attr('content') || '';
    const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;

    const issues: string[] = [];
    if (!canonical) issues.push('No canonical tag found — risk of duplicate content');
    if (canonical && !canonical.startsWith('http')) issues.push('Canonical URL is not absolute');
    if (canonical && canonical !== url && !canonical.includes(new URL(url).hostname)) issues.push('Canonical points to a different domain');
    if (!ogUrl) issues.push('No og:url tag — social platforms may not identify the correct URL');

    return NextResponse.json({
      success: true,
      canonical,
      ogUrl,
      hasHreflang,
      issues,
      status: issues.length === 0 ? 'pass' : 'warn',
      score: issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 25),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
