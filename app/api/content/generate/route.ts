import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { groqClient } from '@/lib/grokClient';
import { runPlagiarismCheck } from '@/lib/plagiarism/checker';
import { fireEvent } from '@/lib/webhooks/sender';

export const runtime = 'nodejs';

/**
 * Stop words excluded from keyword extraction.
 */
const STOP_WORDS = new Set<string>([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for',
  'with', 'and', 'or', 'but', 'not', 'it', 'this', 'that', 'as', 'at', 'by',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'if',
  'then', 'than', 'so', 'such', 'no', 'nor', 'only', 'own', 'same', 'too',
  'very', 'just', 'about', 'above', 'after', 'again', 'all', 'also', 'any',
  'because', 'before', 'between', 'both', 'down', 'during', 'each', 'few',
  'from', 'further', 'here', 'how', 'into', 'more', 'most', 'other', 'out',
  'over', 'own', 'their', 'them', 'they', 'there', 'these', 'those', 'through',
  'under', 'until', 'up', 'we', 'what', 'when', 'where', 'which', 'while',
  'who', 'whom', 'why', 'you', 'your', 'yours', 'i', 'me', 'my', 'mine',
  'he', 'she', 'him', 'her', 'his', 'hers', 'its', 'our', 'ours',
  'am', 'get', 'got', 'getting', 'make', 'made', 'making', 'like', 'one',
  'two', 'three', 'use', 'used', 'using', 'via', 'per', 'etc', 'within',
  'across', 'along', 'around', 'off', 'since', 'yet', 'still', 'even',
  // Additional non-keyword words
  'furthermore', 'moreover', 'however', 'therefore', 'thus', 'hence',
  'nevertheless', 'nonetheless', 'accordingly', 'consequently', 'otherwise',
  'additionally', 'similarly', 'conversely', 'rather', 'instead',
  'deliberate', 'deliberately', 'essentially', 'basically', 'generally',
  'typically', 'usually', 'often', 'sometimes', 'always', 'never',
  'important', 'importantly', 'note', 'noted', 'noting',
  'guide', 'section', 'part', 'step', 'steps', 'process',
  'way', 'ways', 'thing', 'things', 'point', 'points',
  'good', 'great', 'better', 'best', 'bad', 'new', 'old',
  'first', 'second', 'third', 'last', 'final', 'next', 'previous',
  'many', 'much', 'some', 'any', 'every', 'each', 'another',
  'able', 'unable', 'possible', 'impossible',
  'need', 'needs', 'needed', 'want', 'wants', 'wanted',
  'help', 'helps', 'helped', 'helping',
  'ensure', 'ensures', 'ensuring',
  'provide', 'provides', 'provided', 'providing',
  'allow', 'allows', 'allowed', 'allowing',
  'enable', 'enables', 'enabled', 'enabling',
  'include', 'includes', 'included', 'including',
  'consider', 'considers', 'considered',
  'approach', 'approaches', 'approached',
  'practice', 'practices', 'practiced',
  'matter', 'matters', 'mattered',
  'decision', 'decisions', 'decision-makers',
  'stakeholder', 'stakeholders',
  'practitioner', 'practitioners',
  'framework', 'frameworks',
  'outcome', 'outcomes',
  'principle', 'principles',
  'strategy', 'strategies',
  'clear', 'conclusion', 'introduction', 'summary', 'overview',
  'today', 'world', 'area', 'domain', 'field', 'topic',
]);

/**
 * Tokenizes text: lowercase, strip punctuation, split on whitespace.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Extracts the top SEO keywords / bigrams from generated content.
 * Returns the top 7 keywords/phrases sorted by frequency (desc).
 */
function extractKeywordsFromContent(content: string): string[] {
  if (!content || !content.trim()) return [];

  // Extract heading text (## and ### lines) — these are the most SEO-relevant
  const headingLines = content.match(/^#{1,3}\s+(.+)$/gm) || [];
  const headingWords: string[] = [];
  for (const line of headingLines) {
    const text = line.replace(/^#{1,3}\s+/, '').replace(/[*_`]/g, '');
    for (const word of text.toLowerCase().split(/\s+/)) {
      const clean = word.replace(/[^a-z0-9-]/g, '');
      if (clean.length > 3 && !STOP_WORDS.has(clean)) {
        headingWords.push(clean);
      }
    }
  }

  const tokens = tokenize(content);
  if (tokens.length === 0) return [];

  // --- Single-word frequency ---
  const singleFreq = new Map<string, number>();
  for (const t of tokens) {
    singleFreq.set(t, (singleFreq.get(t) || 0) + 1);
  }

  // --- Bigram frequency (2-word phrases) ---
  const bigramFreq = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    bigramFreq.set(bg, (bigramFreq.get(bg) || 0) + 1);
  }

  // Build candidate list with weighted scores.
  // Heading words get a 3x boost, bigrams get 1.5x boost
  type Candidate = { phrase: string; score: number; isBigram: boolean };
  const candidates: Candidate[] = [];

  for (const [word, count] of singleFreq) {
    if (count >= 2) {
      const boost = headingWords.includes(word) ? 3 : 1;
      candidates.push({ phrase: word, score: count * boost, isBigram: false });
    }
  }

  for (const [phrase, count] of bigramFreq) {
    if (count >= 2) {
      candidates.push({ phrase, score: count * 1.5, isBigram: true });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate and build result
  const chosen = new Set<string>();
  const result: string[] = [];
  for (const c of candidates) {
    if (result.length >= 7) break;
    if (chosen.has(c.phrase)) continue;

    // For bigrams, skip if both words already chosen as singles
    if (c.isBigram) {
      const [w1, w2] = c.phrase.split(' ');
      if (chosen.has(w1) && chosen.has(w2)) continue;
    }

    // Capitalize first letter
    const display = c.phrase
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    chosen.add(c.phrase);
    result.push(display);
  }

  // If we still don't have enough, add heading words
  if (result.length < 5 && headingWords.length > 0) {
    for (const w of headingWords) {
      if (result.length >= 7) break;
      const display = w.charAt(0).toUpperCase() + w.slice(1);
      if (!result.includes(display)) result.push(display);
    }
  }

  // Last resort fallback
  if (result.length === 0) {
    return ['Content Strategy', 'AI Tools', 'Digital Marketing', 'Content Creation', 'SEO'];
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      prompt,
      tone,
      length,
      language,
      type = 'general',
      isGuest,
      guestSessionId,
    } = body;

    let userId: string | undefined;
    let isGuestUser = false;

    // Check if this is a guest request
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      isGuestUser = true;
      console.log('Guest generation request for session:', guestSessionId);
    } else {
      // Regular authenticated user
      const token = getTokenFromRequest(request);

      if (!token) {
        console.error('No token found in request');
        return NextResponse.json(
          {
            error: 'Unauthorized - No token provided',
            success: false,
          },
          { status: 401 }
        );
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        console.error('Invalid token provided');
        return NextResponse.json(
          {
            error: 'Unauthorized - Invalid token',
            success: false,
          },
          { status: 401 }
        );
      }

      userId = decoded.userId;
    }

    if (!prompt) {
      return NextResponse.json(
        {
          error: 'Prompt is required',
          success: false,
        },
        { status: 400 }
      );
    }

    // Generate content using Groq API (falls back to local generator on error)
    const content = await groqClient.generateContent({
      prompt,
      tone,
      length,
      language,
      type,
    });

    // Try AI keywords first (works on Vercel), fall back to content-based extraction
    let seoKeywords: string[] = [];
    try {
      seoKeywords = await groqClient.generateSEOKeywords(content, prompt);
    } catch {
      seoKeywords = extractKeywordsFromContent(content);
    }

    // Skip AI grammar check for speed — the plagiarism checker already detects issues
    const grammarIssues: string[] = [];

    // Run the comprehensive plagiarism / originality check
    const plagiarismReport = await runPlagiarismCheck({
      content,
      title: prompt.slice(0, 80),
      keywords: seoKeywords,
      userId,
      isGuest: isGuestUser,
    });

    const plagiarismScore = plagiarismReport.originalityScore;
    const wordCount = content.split(' ').length;
    const generatedAt = new Date().toISOString();

    // Fire webhook event for authenticated users (non-blocking)
    if (!isGuestUser && userId) {
      fireEvent('content.generated', userId, {
        content,
        title: prompt.slice(0, 80),
        prompt,
        tone,
        length,
        language,
        type,
        seoKeywords,
        originalityScore: plagiarismReport.originalityScore,
        humanQualityScore: plagiarismReport.humanQualityScore,
        wordCount,
        generatedAt,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      content,
      seoKeywords,
      plagiarismScore,
      plagiarismReport,
      grammarIssues,
      isGuest: isGuestUser,
      metadata: {
        tone,
        length,
        language,
        type,
        wordCount,
        generatedAt,
        model: 'llama-3.3-70b-groq',
      },
    });
  } catch (error: any) {
    console.error('Generate error:', error);

    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      'Failed to generate content';
    const statusCode = error.response?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
        details:
          process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: statusCode }
    );
  }
}
