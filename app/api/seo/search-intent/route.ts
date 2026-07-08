import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

type IntentType =
  | 'transactional'
  | 'commercial'
  | 'informational'
  | 'navigational'
  | 'local';

interface IntentResult {
  intent: IntentType;
  confidence: number; // 0-100
  signals: string[];
  suggestions: string[];
}

// Word lists per intent
const SIGNALS: Record<IntentType, string[]> = {
  transactional: [
    'buy',
    'price',
    'cheap',
    'discount',
    'deal',
    'deals',
    'order',
    'purchase',
    'for sale',
    'shipping',
    'coupon',
    'subscribe',
    'cost',
    'pricing',
  ],
  commercial: [
    'best',
    'top',
    'review',
    'reviews',
    'vs',
    'versus',
    'comparison',
    'compare',
    'alternatives',
    'alternative',
    'ratings',
  ],
  informational: [
    'how',
    'what',
    'why',
    'when',
    'guide',
    'tutorial',
    'learn',
    'examples',
    'ideas',
    'tips',
    'meaning',
    'definition',
    'explain',
    'explained',
    'history of',
  ],
  navigational: [
    'login',
    'log in',
    'sign in',
    'signin',
    'official',
    'website',
    'home page',
    'homepage',
    'dashboard',
    'account',
  ],
  local: [
    'near me',
    'nearby',
    'in my area',
    'directions',
    'open now',
    'close to me',
    'around me',
  ],
};

// Common brand TLDs that suggest navigational intent
const BRAND_PATTERNS = [
  /\bfacebook\b/i,
  /\bgoogle\b/i,
  /\byoutube\b/i,
  /\bamazon\b/i,
  /\btwitter\b/i,
  /\bx\.com\b/i,
  /\blinkedin\b/i,
  /\binstagram\b/i,
  /\bgithub\b/i,
  /\bnetflix\b/i,
  /\bapple\b/i,
  /\bmicrosoft\b/i,
];

const CITY_PATTERN = /\bin\s+([a-z][a-z\s',.-]+)/i;

function detectLocal(keyword: string): boolean {
  if (SIGNALS.local.some((s) => keyword.includes(s))) return true;
  // Crude "in [city]" detection — true if there's an "in" followed by capitalized-ish word
  const m = keyword.match(CITY_PATTERN);
  if (m) {
    const candidate = m[1].trim();
    // Heuristic: skip common non-locative phrases like "in general", "in order", etc.
    const stopwords = [
      'general',
      'order',
      'total',
      'summary',
      'the',
      'fact',
      'addition',
      'this',
      'that',
      'which',
      'mind',
      'particular',
      'common',
    ];
    const firstWord = candidate.split(/\s+/)[0].toLowerCase();
    if (!stopwords.includes(firstWord)) return true;
  }
  return false;
}

function detectIntent(keyword: string): IntentResult {
  const signals: string[] = [];
  const scores: Record<IntentType, number> = {
    transactional: 0,
    commercial: 0,
    informational: 0,
    navigational: 0,
    local: 0,
  };

  for (const intent of Object.keys(SIGNALS) as IntentType[]) {
    for (const word of SIGNALS[intent]) {
      if (keyword.includes(word)) {
        scores[intent] += 1;
        signals.push(`"${word}" suggests ${intent} intent`);
      }
    }
  }

  // Brand detection → navigational
  for (const pattern of BRAND_PATTERNS) {
    if (pattern.test(keyword)) {
      scores.navigational += 1;
      signals.push(`Brand name detected → navigational intent`);
      break;
    }
  }

  // Local detection
  if (detectLocal(keyword)) {
    scores.local += 2;
    signals.push('Location modifier (e.g. "near me", "in [city]") → local intent');
  }

  // Question marks push toward informational
  if (keyword.includes('?')) {
    scores.informational += 1;
    signals.push('Question mark detected → informational intent');
  }

  // Pick the highest scoring intent
  let best: IntentType = 'informational';
  let bestScore = 0;
  for (const intent of Object.keys(scores) as IntentType[]) {
    if (scores[intent] > bestScore) {
      bestScore = scores[intent];
      best = intent;
    }
  }

  // If no signals, default to informational with low confidence
  if (bestScore === 0) {
    best = 'informational';
    signals.push('No strong signals — defaulting to informational (informational is the most common intent)');
  }

  // Confidence: more signals and a wider margin → higher
  const totalSignals = Object.values(scores).reduce((a, b) => a + b, 0);
  const runnerUp = Math.max(
    ...Object.entries(scores)
      .filter(([k]) => k !== best)
      .map(([, v]) => v)
  );
  const margin = bestScore - runnerUp;
  const confidence = Math.min(
    95,
    Math.round(50 + margin * 12 + Math.min(totalSignals, 5) * 5)
  );

  const suggestions = buildSuggestions(best, keyword);
  return { intent: best, confidence, signals, suggestions };
}

function buildSuggestions(intent: IntentType, keyword: string): string[] {
  switch (intent) {
    case 'transactional':
      return [
        'Use product/schema markup and clear CTAs ("Buy", "Add to cart").',
        'Optimize for conversion: speed, trust badges, pricing visibility.',
        'Target bottom-of-funnel ad campaigns on this keyword.',
        `Try variations: "${keyword} online", "${keyword} cheap", "buy ${keyword}".`,
      ];
    case 'commercial':
      return [
        'Publish comparison tables, "best of" lists, and review content.',
        'Include pros/cons, ratings, and screenshots.',
        'Add internal links to your product/category pages.',
        `Try variations: "best ${keyword}", "${keyword} reviews", "${keyword} alternatives".`,
      ];
    case 'informational':
      return [
        'Create long-form guides, tutorials, or how-to articles.',
        'Use clear headings, FAQ sections, and schema for HowTo/Article.',
        'Capture email or push users deeper into your funnel.',
        `Try variations: "how to ${keyword}", "what is ${keyword}", "${keyword} guide".`,
      ];
    case 'navigational':
      return [
        'Ensure your homepage / brand page is the canonical result.',
        'Use sitelinks schema and clear site navigation.',
        'Bid on brand terms in ads to protect your SERP real estate.',
        'Make sure your title tag contains your brand name.',
      ];
    case 'local':
      return [
        'Optimize Google Business Profile (hours, photos, reviews).',
        'Use LocalBusiness schema with NAP consistency.',
        'Include city/region in title, H1, and meta description.',
        'Build local citations and location-specific landing pages.',
      ];
    default:
      return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { keyword } = (await request.json()) as { keyword?: string };

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Keyword is required' },
        { status: 400 }
      );
    }

    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return NextResponse.json(
        { success: false, error: 'Keyword is required' },
        { status: 400 }
      );
    }

    const result = detectIntent(normalized);

    return NextResponse.json({
      success: true,
      keyword: normalized,
      ...result,
    });
  } catch (error: unknown) {
    console.error('[seo/search-intent] error:', error);
    const message =
      error instanceof Error ? error.message : 'Intent detection failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
