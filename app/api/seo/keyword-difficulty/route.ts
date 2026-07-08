import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'very hard';

interface Factor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
  delta: number; // change to difficulty
}

interface DifficultyResult {
  keyword: string;
  difficulty: number; // 0-100
  level: DifficultyLevel;
  factors: Factor[];
}

const TRANSACTIONAL_WORDS = [
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
  'cost',
  'pricing',
  'sale',
  'coupon',
];

const COMMERCIAL_WORDS = [
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
];

const QUESTION_WORDS = [
  'how',
  'what',
  'why',
  'when',
  'who',
  'which',
  'where',
  'guide',
  'tutorial',
  'learn',
  'examples',
  'explain',
  'explained',
];

const LOCAL_WORDS = ['near me', 'nearby', 'in my area', 'directions', 'open now'];

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'in',
  'on',
  'and',
  'or',
  'to',
  'for',
  'with',
  'is',
  'are',
  'be',
]);

function levelFromScore(score: number): DifficultyLevel {
  if (score < 30) return 'easy';
  if (score < 55) return 'medium';
  if (score < 80) return 'hard';
  return 'very hard';
}

function estimateDifficulty(keyword: string): DifficultyResult {
  const factors: Factor[] = [];
  let difficulty = 40; // baseline

  const words = keyword.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => !STOPWORDS.has(w));
  const wordCount = words.length;

  // 1. Word count — longer tail = easier
  if (wordCount >= 5) {
    difficulty -= 15;
    factors.push({
      name: 'Long-tail keyword (5+ words)',
      impact: 'positive',
      detail: `Long-tail queries have less competition.`,
      delta: -15,
    });
  } else if (wordCount >= 3) {
    difficulty -= 8;
    factors.push({
      name: 'Mid-tail keyword (3-4 words)',
      impact: 'positive',
      detail: `Multi-word queries are usually less competitive.`,
      delta: -8,
    });
  } else if (wordCount === 1) {
    difficulty += 25;
    factors.push({
      name: 'Single-word keyword',
      impact: 'negative',
      detail: `Head terms are extremely competitive.`,
      delta: +25,
    });
  } else if (wordCount === 2) {
    difficulty += 8;
    factors.push({
      name: 'Two-word keyword',
      impact: 'negative',
      detail: `Short terms tend to be competitive.`,
      delta: +8,
    });
  }

  // 2. Transactional words → harder
  const transactionalHits = TRANSACTIONAL_WORDS.filter((w) =>
    keyword.includes(w)
  );
  if (transactionalHits.length > 0) {
    const delta = 12 * transactionalHits.length;
    difficulty += delta;
    factors.push({
      name: 'Transactional intent',
      impact: 'negative',
      detail: `Contains: ${transactionalHits.join(
        ', '
      )}. Money keywords attract heavy competition.`,
      delta: +delta,
    });
  }

  // 3. Commercial words (best/top/review) → harder
  const commercialHits = COMMERCIAL_WORDS.filter((w) => keyword.includes(w));
  if (commercialHits.length > 0) {
    const delta = 8 * commercialHits.length;
    difficulty += delta;
    factors.push({
      name: 'Commercial intent',
      impact: 'negative',
      detail: `Contains: ${commercialHits.join(
        ', '
      )}. Aggregators dominate listicle SERPs.`,
      delta: +delta,
    });
  }

  // 4. Question words → easier
  const questionHits = QUESTION_WORDS.filter((w) => keyword.includes(w));
  if (questionHits.length > 0) {
    const delta = 10 * questionHits.length;
    difficulty -= delta;
    factors.push({
      name: 'Question / informational',
      impact: 'positive',
      detail: `Contains: ${questionHits.join(
        ', '
      )}. Informational queries often have lower competition.`,
      delta: -delta,
    });
  }

  // 5. Local intent → easier
  const localHits = LOCAL_WORDS.filter((w) => keyword.includes(w));
  if (localHits.length > 0) {
    const delta = 12;
    difficulty -= delta;
    factors.push({
      name: 'Local intent',
      impact: 'positive',
      detail: `Local pack limits global competition.`,
      delta: -delta,
    });
  }

  // 6. Very short meaningful words → harder
  if (meaningful.length > 0) {
    const avgLen =
      meaningful.reduce((a, w) => a + w.length, 0) / meaningful.length;
    if (avgLen <= 4) {
      difficulty += 8;
      factors.push({
        name: 'Short generic words',
        impact: 'negative',
        detail: `Average word length is ${avgLen.toFixed(
          1
        )} chars — short generic terms are hard.`,
        delta: +8,
      });
    } else if (avgLen >= 7) {
      difficulty -= 5;
      factors.push({
        name: 'Long specific words',
        impact: 'positive',
        detail: `Average word length is ${avgLen.toFixed(
          1
        )} chars — specific terms are easier.`,
        delta: -5,
      });
    }
  }

  // 7. Numbers in keyword (e.g. "top 10") → slightly easier (listicle)
  if (/\b\d+\b/.test(keyword)) {
    difficulty -= 5;
    factors.push({
      name: 'Contains a number',
      impact: 'positive',
      detail: 'Numbered listicles often have clear featured-snippet opportunities.',
      delta: -5,
    });
  }

  // Clamp
  difficulty = Math.max(5, Math.min(95, Math.round(difficulty)));
  const level = levelFromScore(difficulty);

  return { keyword, difficulty, level, factors };
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

    const result = estimateDifficulty(normalized);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error('[seo/keyword-difficulty] error:', error);
    const message =
      error instanceof Error ? error.message : 'Difficulty estimation failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
