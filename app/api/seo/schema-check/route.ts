import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const maxDuration = 30;

const USER_AGENT =
  'Mozilla/5.0 (compatible; AIContentSeoBot/1.0; +https://ai-content.app/bot)';
const FETCH_TIMEOUT_MS = 15000;

interface SchemaResult {
  type: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  raw: unknown;
}

// Required fields per schema.org type (simplified for SEO validation)
const REQUIRED_FIELDS: Record<string, string[]> = {
  Organization: ['name', 'url'],
  Article: ['headline', 'datePublished'],
  NewsArticle: ['headline', 'datePublished'],
  BlogPosting: ['headline', 'datePublished'],
  Product: ['name', 'offers'],
  LocalBusiness: ['name', 'address'],
  Event: ['name', 'startDate', 'location'],
  Recipe: ['name', 'recipeIngredient'],
  Review: ['itemReviewed', 'reviewRating'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  HowTo: ['step'],
  VideoObject: ['name', 'uploadDate'],
  Person: ['name'],
  WebSite: ['name', 'url'],
  WebPage: ['name'],
};

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

function validateSchema(parsed: unknown): SchemaResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      type: 'Unknown',
      valid: false,
      errors: ['Schema is not a valid JSON object.'],
      warnings,
      raw: parsed,
    };
  }

  const obj = parsed as Record<string, unknown>;
  let type = 'Unknown';

  if (Array.isArray(obj['@type'])) {
    type = (obj['@type'] as string[]).filter(Boolean).join(', ');
  } else if (typeof obj['@type'] === 'string') {
    type = obj['@type'];
  } else {
    errors.push('Missing required property: @type');
  }

  // Check @context
  if (!obj['@context']) {
    warnings.push('Missing @context. Add "https://schema.org" for best results.');
  }

  // Required field validation per type
  if (type && type !== 'Unknown') {
    const primaryType = type.split(',')[0].trim();
    const required = REQUIRED_FIELDS[primaryType];
    if (required) {
      for (const field of required) {
        if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
          errors.push(`Missing required field for ${primaryType}: "${field}"`);
        }
      }
    } else {
      warnings.push(`No required-field schema defined for type "${primaryType}".`);
    }

    // Type-specific sanity warnings
    if (primaryType === 'Organization' && !obj['logo']) {
      warnings.push('Organization schema: "logo" is recommended.');
    }
    if (primaryType === 'Article' && !obj['author']) {
      warnings.push('Article schema: "author" is recommended.');
    }
    if (primaryType === 'Product' && !obj['image']) {
      warnings.push('Product schema: "image" is recommended.');
    }
    if (primaryType === 'LocalBusiness' && !obj['telephone']) {
      warnings.push('LocalBusiness schema: "telephone" is recommended.');
    }
  }

  return {
    type,
    valid: errors.length === 0,
    errors,
    warnings,
    raw: parsed,
  };
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

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
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
    const scriptTags = $('script[type="application/ld+json"]').toArray();

    const schemas: SchemaResult[] = [];
    for (const el of scriptTags) {
      const rawText = $(el).html() || '';
      const trimmed = rawText.trim();
      if (!trimmed) {
        schemas.push({
          type: 'Unknown',
          valid: false,
          errors: ['Empty JSON-LD block.'],
          warnings: [],
          raw: null,
        });
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        schemas.push({
          type: 'Unknown',
          valid: false,
          errors: [`Invalid JSON: ${message}`],
          warnings: [],
          raw: trimmed,
        });
        continue;
      }

      // JSON-LD can be a single object, an array of objects, or a @graph
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          schemas.push(validateSchema(item));
        }
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as Record<string, unknown>)['@graph'])
      ) {
        const graph = (parsed as Record<string, unknown>)[
          '@graph'
        ] as unknown[];
        for (const item of graph) {
          schemas.push(validateSchema(item));
        }
      } else {
        schemas.push(validateSchema(parsed));
      }
    }

    return NextResponse.json({
      success: true,
      hasSchema: schemas.length > 0,
      count: schemas.length,
      schemas,
      url: normalizedUrl,
    });
  } catch (error: unknown) {
    console.error('[seo/schema-check] error:', error);
    const message =
      error instanceof Error ? error.message : 'Schema check failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
