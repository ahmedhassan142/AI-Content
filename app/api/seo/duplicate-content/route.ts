import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const maxDuration = 30;

const USER_AGENT =
  'Mozilla/5.0 (compatible; AIContentSeoBot/1.0; +https://ai-content.app/bot)';
const FETCH_TIMEOUT_MS = 15000;

type SimilarityLevel =
  | 'unique'
  | 'low'
  | 'moderate'
  | 'high'
  | 'duplicate';

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

function extractBodyText(html: string): string {
  const $ = cheerio.load(html);
  // Remove non-content elements
  $('script, style, noscript, template, iframe, svg, nav, footer, header, aside, form').remove();
  // Try to focus on main/article content
  const main = $('main, article, .post, .content, #content, .entry-content').first();
  const target = main.length ? main : $('body');
  let text = target.text() || '';
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function extractSentences(text: string): string[] {
  if (!text) return [];
  // Naive sentence splitter — strips extra whitespace
  const raw = text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length >= 20); // ignore very short fragments
  // Dedupe within same page (a page can repeat itself)
  return Array.from(new Set(raw));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 2);
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

function cosineSimilarity(tokensA: string[], tokensB: string[]): number {
  const tfA = termFrequency(tokensA);
  const tfB = termFrequency(tokensB);
  let dot = 0;
  for (const [k, v] of tfA) {
    const b = tfB.get(k);
    if (b) dot += v * b;
  }
  const magA = Math.sqrt(
    Array.from(tfA.values()).reduce((s, v) => s + v * v, 0)
  );
  const magB = Math.sqrt(
    Array.from(tfB.values()).reduce((s, v) => s + v * v, 0)
  );
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function sentenceOverlap(sentencesA: string[], sentencesB: string[]): {
  common: string[];
  percent: number;
} {
  if (sentencesA.length === 0 || sentencesB.length === 0) {
    return { common: [], percent: 0 };
  }
  const setB = new Set(sentencesB);
  const common: string[] = [];
  for (const s of sentencesA) {
    if (setB.has(s)) common.push(s);
  }
  // Percent = common / min(both) so that a small page duplicating a big page is high
  const denom = Math.min(sentencesA.length, sentencesB.length);
  const percent = denom === 0 ? 0 : (common.length / denom) * 100;
  return { common, percent };
}

function levelFromSimilarity(score: number): SimilarityLevel {
  if (score < 10) return 'unique';
  if (score < 30) return 'low';
  if (score < 60) return 'moderate';
  if (score < 85) return 'high';
  return 'duplicate';
}

function buildRecommendation(
  level: SimilarityLevel,
  similarity: number,
  commonCount: number
): string {
  switch (level) {
    case 'unique':
      return 'Pages are essentially unique. No action needed.';
    case 'low':
      return 'Minor overlap detected (likely common boilerplate). No action needed.';
    case 'moderate':
      return `Moderate similarity (${similarity.toFixed(
        0
      )}%). Consider rewriting shared sections or adding canonical tags if pages target the same intent.`;
    case 'high':
      return `High similarity (${similarity.toFixed(
        0
      )}%). Rewrite content, consolidate pages, or use rel="canonical" to avoid ranking conflicts. ${commonCount} identical sentences found.`;
    case 'duplicate':
      return `Duplicate content detected (${similarity.toFixed(
        0
      )}%). Use 301 redirects or rel="canonical" to consolidate. ${commonCount} identical sentences found.`;
    default:
      return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url1, url2 } = (await request.json()) as {
      url1?: string;
      url2?: string;
    };

    if (!url1 || !url2) {
      return NextResponse.json(
        { success: false, error: 'Both url1 and url2 are required' },
        { status: 400 }
      );
    }

    const u1 = normalizeUrl(url1);
    const u2 = normalizeUrl(url2);
    if (!u1 || !u2) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL(s)' },
        { status: 400 }
      );
    }

    if (u1 === u2) {
      return NextResponse.json({
        success: true,
        url1: u1,
        url2: u2,
        similarity: 100,
        level: 'duplicate',
        commonSentences: [],
        recommendation:
          'Both URLs are identical. Pages are 100% duplicate by definition.',
      });
    }

    const [r1, r2] = await Promise.all([fetchHtml(u1), fetchHtml(u2)]);

    if (!r1.ok || !r1.html) {
      return NextResponse.json(
        {
          success: false,
          error: r1.error || `Failed to fetch ${u1} (status ${r1.status})`,
        },
        { status: 502 }
      );
    }
    if (!r2.ok || !r2.html) {
      return NextResponse.json(
        {
          success: false,
          error: r2.error || `Failed to fetch ${u2} (status ${r2.status})`,
        },
        { status: 502 }
      );
    }

    const text1 = extractBodyText(r1.html);
    const text2 = extractBodyText(r2.html);

    if (!text1 || !text2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract enough body text from one or both pages.',
        },
        { status: 422 }
      );
    }

    const tokens1 = tokenize(text1);
    const tokens2 = tokenize(text2);
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const jaccard = jaccardSimilarity(set1, set2);
    const cosine = cosineSimilarity(tokens1, tokens2);

    const sentences1 = extractSentences(text1);
    const sentences2 = extractSentences(text2);
    const overlap = sentenceOverlap(sentences1, sentences2);

    // Combined similarity score (weighted average)
    // - Jaccard is conservative; cosine tends higher; sentence overlap percent is most direct
    const similarity = Math.round(
      Math.min(
        100,
        Math.max(
          0,
          jaccard * 100 * 0.35 + cosine * 100 * 0.35 + overlap.percent * 0.3
        )
      )
    );

    const level = levelFromSimilarity(similarity);
    const recommendation = buildRecommendation(
      level,
      similarity,
      overlap.common.length
    );

    return NextResponse.json({
      success: true,
      url1: u1,
      url2: u2,
      similarity,
      level,
      metrics: {
        jaccard: Math.round(jaccard * 1000) / 10,
        cosine: Math.round(cosine * 1000) / 10,
        sentenceOverlap: Math.round(overlap.percent * 10) / 10,
      },
      commonSentences: overlap.common.slice(0, 20),
      recommendation,
    });
  } catch (error: unknown) {
    console.error('[seo/duplicate-content] error:', error);
    const message =
      error instanceof Error ? error.message : 'Duplicate content check failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
