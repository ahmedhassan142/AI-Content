import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

/** POST /api/seo/thin-content — checks if content is too thin */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });

    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIContentSeoBot/1.0)' }, signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside').remove();

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(' ').length : 0;
    const sentenceCount = bodyText ? (bodyText.match(/[.!?]+/g) || []).length : 0;
    const paragraphCount = $('p').length;
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;

    let level = 'good';
    let score = 100;
    const issues: string[] = [];

    if (wordCount < 300) { level = 'critical'; score = 20; issues.push(`Content is very thin (${wordCount} words). Minimum recommended: 300 words.`); }
    else if (wordCount < 600) { level = 'thin'; score = 60; issues.push(`Content could be richer (${wordCount} words). Recommended: 600+ words.`); }
    else if (wordCount < 1000) { level = 'moderate'; score = 80; issues.push(`Content is decent (${wordCount} words). Aim for 1000+ for competitive topics.`); }

    if (paragraphCount < 3) issues.push(`Only ${paragraphCount} paragraphs — break content into more sections.`);
    if (h2Count === 0) issues.push('No H2 subheadings — add structure for readability.');

    return NextResponse.json({
      success: true,
      wordCount,
      sentenceCount,
      paragraphCount,
      h2Count,
      h3Count,
      level,
      score,
      issues,
      avgWordsPerSentence: sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
