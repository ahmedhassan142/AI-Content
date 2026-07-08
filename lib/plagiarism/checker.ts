/**
 * Plagiarism Checker — 3-layer analysis engine.
 *
 * Layer 1 (Internal): Compares the input content against the user's saved
 *   content stored in MongoDB. Uses TF-IDF + cosine similarity at the document
 *   level and Jaccard similarity on 3-word shingles at the sentence level.
 *   Skipped for guests.
 *
 * Layer 2 (Heuristic): Detects generic phrases, AI-typical phrases, repeated
 *   sentences, keyword stuffing, and extracts the top keywords.
 *
 * Layer 3 (Fixer suggestions): Classifies each paragraph into a risk bucket
 *   (safe/low/medium/high) and recommends a fix type
 *   (rewrite/add_citation/add_example/remove/keep).
 *
 * Scoring:
 *   Plagiarism Risk   = Exact Match 40% + Semantic Similarity 30%
 *                       + Repeated Content 15% + Generic Phrase 10% + AI Phrase 5%
 *   Originality Score = 100 - Plagiarism Risk
 *   Human Quality     = Specific Examples 20% + Original Insight 20%
 *                       + Natural Flow 15% + Sentence Variation 15%
 *                       + Low Repetition 10% + Readability 10% + Helpful Depth 10%
 */

import Content from '@/models/Content';
import connectDB from '@/lib/mongodb';

/* ============================================================================
 * Phrase databases (used both for detection here and as the source-of-truth
 * list for the fixer / humanizer replacement maps).
 * ========================================================================== */

export const GENERIC_PHRASES: string[] = [
  "in today's fast-paced world",
  "at the end of the day",
  "plays a crucial role",
  "is crucial for",
  "cutting-edge",
  "in conclusion",
  "first and foremost",
  "last but not least",
  "it goes without saying",
  "needless to say",
  "when it comes to",
  "the bottom line is",
  "in this day and age",
  "a myriad of",
  "a plethora of",
  "in light of",
  "with regard to",
  "in order to",
  "due to the fact that",
  "for the purpose of",
  "in the event that",
  "in spite of the fact that",
  "until such time as",
  "with reference to",
  "in the vicinity of",
  "as a matter of fact",
  "if you will",
  "quite frankly",
  "generally speaking",
  "strictly speaking",
  "for all intents and purposes",
  "in the grand scheme of things",
  "from a broader perspective",
  "moving forward",
  "going forward",
  "by and large",
  "more often than not",
  "nine times out of ten",
  "in the realm of",
  "in the world of",
  "in the landscape of",
  "navigate the complexities of",
  "an integral part of",
  "a vital component of",
  "a key driver of",
  "shape the future of",
  "across the board",
  "set the stage for",
  "pave the way for",
  "open the door to",
  "shed light on",
  "bring to the table",
  "get the ball rolling",
  "on the same page",
  "in the loop",
  "low-hanging fruit",
  "elephant in the room",
  "perfect storm",
  "game-changer",
  "paradigm shift",
  "think outside the box",
  "best practices",
  "value-add",
  "reinvent the wheel",
  "moving the needle",
  "boil the ocean",
];

export const AI_PHRASES: string[] = [
  "delve into",
  "delve deeper",
  "leverage",
  "foster a",
  "holistic approach",
  "comprehensive guide",
  "seamless experience",
  "robust solution",
  "innovative solutions",
  "in the realm of",
  "it is important to note",
  "it is worth noting",
  "it is crucial to understand",
  "navigating the complexities",
  "ever-evolving landscape",
  "unleash the power of",
  "harness the potential of",
  "embark on a journey",
  "treasure trove of information",
  "wealth of knowledge",
  "unlock the secrets",
  "demystify",
  "nuanced understanding",
  "tailored to your needs",
  "in today's digital age",
  "tapestry of",
  "symphony of",
  "orchestrate",
  "myriad of",
  "plethora of",
  "underpin",
  "pave the way for",
  "at the forefront of",
  "underscores the importance",
  "landscape of",
  "bolster",
  "augment",
  "facilitate",
  "robust",
  "nuanced",
  "intricate",
  "elucidate",
  "underscore",
  "paramount importance",
  "in essence",
  "moreover",
  "furthermore",
  "consequently",
  "nevertheless",
  "in the world of",
];

/* Common English stopwords used by keyword extraction / TF-IDF pruning. */
const STOPWORDS = new Set<string>([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where',
  'why', 'how', 'what', 'who', 'whom', 'which', 'this', 'that', 'these',
  'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do',
  'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'will', 'would',
  'should', 'could', 'can', 'cannot', 'may', 'might', 'must', 'shall', 'of',
  'in', 'on', 'at', 'to', 'from', 'by', 'with', 'for', 'about', 'against',
  'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'once',
  'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'just', 'as', 'i', 'me', 'my', 'myself',
  'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself',
  'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
  'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
  'themselves', 'i\'m', 'you\'re', 'he\'s', 'she\'s', 'it\'s',
  'we\'re', 'they\'re', 'i\'ve', 'you\'ve', 'we\'ve', 'they\'ve',
  'i\'ll', 'you\'ll', 'he\'ll', 'she\'ll', 'we\'ll', 'they\'ll',
  'i\'d', 'you\'d', 'he\'d', 'she\'d', 'we\'d', 'they\'d', 'don\'t',
  'doesn\'t', 'didn\'t', 'won\'t', 'wouldn\'t', 'shouldn\'t', 'couldn\'t',
  'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t', 'hasn\'t', 'haven\'t',
  'hadn\'t', 'can\'t', 'mustn\'t',
]);

/* ============================================================================
 * Public interfaces
 * ========================================================================== */

export interface PlagiarismCheckInput {
  content: string;
  title?: string;
  keywords?: string[];
  userId?: string;
  isGuest?: boolean;
}

export type MatchSource =
  | 'internal'
  | 'heuristic'
  | 'ai_phrase'
  | 'generic_phrase'
  | 'repeated'
  | 'keyword_stuffing';

export type MatchType =
  | 'exact'
  | 'semantic'
  | 'repeated'
  | 'generic_phrase'
  | 'ai_phrase'
  | 'keyword_stuffing';

export interface PlagiarismMatch {
  source: MatchSource;
  type: MatchType;
  matchedText: string;
  matchedFrom?: string;
  similarity: number; // 0-100
  startIndex?: number;
  endIndex?: number;
  suggestion?: string;
}

export interface SentenceAnalysis {
  text: string;
  index: number;
  wordCount: number;
  issues: string[];
  similarity: number; // 0-100, max similarity against saved docs
  isRepeated: boolean;
  isLong: boolean;
}

export interface ParagraphAnalysis {
  index: number;
  text: string;
  wordCount: number;
  risk: 'safe' | 'low' | 'medium' | 'high';
  fixType: 'rewrite' | 'add_citation' | 'add_example' | 'remove' | 'keep';
  issues: string[];
  sentences: SentenceAnalysis[];
  suggestion: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  description?: string;
}

export interface SeoCheckResult {
  [key: string]: unknown;
}

export interface PlagiarismReport {
  content: string;
  title?: string;
  keywords?: string[];
  isGuest: boolean;

  // Scores
  plagiarismRisk: number; // 0-100
  originalityScore: number; // 100 - plagiarismRisk
  humanQualityScore: number; // 0-100

  // Layer 1: Internal
  internalMatches: PlagiarismMatch[];
  exactMatchScore: number;
  semanticSimilarityScore: number;
  repeatedContentScore: number;

  // Layer 2: Heuristic
  genericPhraseScore: number;
  aiPhraseScore: number;
  genericPhrasesFound: { phrase: string; count: number; suggestion: string }[];
  aiPhrasesFound: { phrase: string; count: number; suggestion: string }[];
  repeatedSentences: string[];
  keywordStuffing: { word: string; count: number; expectedMax: number }[];
  topKeywords: { word: string; count: number; frequency: number }[];

  // Layer 3: Fixer suggestions
  paragraphs: ParagraphAnalysis[];
  sentences: SentenceAnalysis[];

  // Checklists
  originalityChecklist: ChecklistItem[];
  humanQualityChecklist: ChecklistItem[];
  seoChecklist: ChecklistItem[];

  // Metadata
  stats: {
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    avgWordsPerSentence: number;
    uniqueWordRatio: number;
    longSentenceCount: number;
  };

  generatedAt: string;
}

/* ============================================================================
 * Text utility functions
 * ========================================================================== */

/** Normalize text into a lowercase alphanumeric token stream. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(Boolean);
}

/** Tokenize but drop stopwords. Used by keyword extraction + TF-IDF pruning. */
export function tokenizeContentWords(text: string): string[] {
  return tokenize(text).filter((w) => !STOPWORDS.has(w) && w.length > 2);
}

/** Split content into sentences using a simple but effective heuristic. */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  // Protect common abbreviations from being treated as sentence boundaries.
  const protectedText = text.replace(
    /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|Inc|Ltd|Co|U\.S|U\.K)\./gi,
    (m) => m.replace('.', '\u0001')
  );
  const parts = protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z"'\d(])/)
    .map((s) => s.replace(/\u0001/g, '.').trim())
    .filter((s) => s.length > 0);
  return parts;
}

/** Split content into paragraphs (separated by one or more blank lines). */
export function splitParagraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Generate n-word shingles from a token stream. */
export function generateShingles(tokens: string[], n = 3): Set<string> {
  const shingles = new Set<string>();
  if (tokens.length < n) return shingles;
  for (let i = 0; i <= tokens.length - n; i++) {
    shingles.add(tokens.slice(i, i + n).join(' '));
  }
  return shingles;
}

/** Jaccard similarity between two sets, returned as 0-100. */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return (intersection / union) * 100;
}

/** Term frequency map. */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

/**
 * Build an IDF map across a corpus of token arrays.
 * IDF(t) = ln( (1 + N) / (1 + df(t)) ) + 1   (smoothed, like sklearn).
 */
function computeIDF(corpus: string[][]): Map<string, number> {
  const N = Math.max(corpus.length, 1);
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const seen = new Set(doc);
    for (const term of seen) df.set(term, (df.get(term) || 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((1 + N) / (1 + count)) + 1);
  }
  return idf;
}

/** Compute a TF-IDF vector for a single document given an IDF map. */
function computeTFIDF(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = termFrequency(tokens);
  const vec = new Map<string, number>();
  for (const [term, freq] of tf) {
    const weight = idf.get(term);
    if (weight === undefined) continue;
    vec.set(term, (freq / Math.max(tokens.length, 1)) * weight);
  }
  return vec;
}

/** Cosine similarity between two sparse vectors, returned as 0-100. */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, v] of a) {
    normA += v * v;
    const w = b.get(k);
    if (w !== undefined) dot += v * w;
  }
  for (const [, v] of b) normB += v * v;
  if (normA === 0 || normB === 0) return 0;
  return (dot / (Math.sqrt(normA) * Math.sqrt(normB))) * 100;
}

/* ============================================================================
 * Layer 1: Internal plagiarism check (MongoDB comparison)
 * ========================================================================== */

interface InternalCheckResult {
  matches: PlagiarismMatch[];
  exactMatchScore: number;
  semanticSimilarityScore: number;
  repeatedContentScore: number;
  maxSentenceSimilarityByIndex: number[];
}

async function runInternalCheck(
  content: string,
  userId: string,
  sentences: string[]
): Promise<InternalCheckResult> {
  const empty: InternalCheckResult = {
    matches: [],
    exactMatchScore: 0,
    semanticSimilarityScore: 0,
    repeatedContentScore: 0,
    maxSentenceSimilarityByIndex: sentences.map(() => 0),
  };

  try {
    await connectDB();
    const savedDocs = await Content.find({ userId, isGuest: false })
      .select('title content -_id')
      .limit(50)
      .lean();

    if (!savedDocs || savedDocs.length === 0) return empty;

    // Build corpus = current content + every saved doc (for IDF).
    const currentTokens = tokenize(content);
    const savedTokenLists = savedDocs.map((d) =>
      tokenize((d as { content?: string }).content || '')
    );
    const corpus = [currentTokens, ...savedTokenLists];
    const idf = computeIDF(corpus);

    const currentVec = computeTFIDF(currentTokens, idf);

    let maxExact = 0;
    let maxSemantic = 0;
    let maxRepeated = 0;
    const matches: PlagiarismMatch[] = [];
    const maxSentenceSimByIndex = sentences.map(() => 0);

    // Pre-compute shingles for each input sentence (for Jaccard check).
    const inputSentenceShingles = sentences.map((s) =>
      generateShingles(tokenize(s), 3)
    );

    for (let di = 0; di < savedDocs.length; di++) {
      const doc = savedDocs[di] as { title?: string; content?: string };
      const docContent: string = doc.content || '';
      const docTokens = savedTokenLists[di];

      // Document-level cosine similarity.
      const docVec = computeTFIDF(docTokens, idf);
      const docSim = cosineSimilarity(currentVec, docVec);
      if (docSim > maxSemantic) maxSemantic = docSim;

      if (docSim >= 30) {
        matches.push({
          source: 'internal',
          type: 'semantic',
          matchedText:
            docContent.slice(0, 200) + (docContent.length > 200 ? '...' : ''),
          matchedFrom: doc.title || `Saved document #${di + 1}`,
          similarity: Number(docSim.toFixed(2)),
          suggestion:
            docSim >= 70
              ? 'This content closely matches one of your previously saved documents. Consider rewriting or citing it.'
              : 'This content shares substantial overlap with a saved document. Review for originality.',
        });
      }

      // Sentence-level Jaccard similarity (3-word shingles).
      const docSentences = splitSentences(docContent);
      const docSentenceShingles = docSentences.map((s) =>
        generateShingles(tokenize(s), 3)
      );

      for (let i = 0; i < sentences.length; i++) {
        const inputShingles = inputSentenceShingles[i];
        if (inputShingles.size === 0) continue;

        for (let j = 0; j < docSentences.length; j++) {
          const docShingles = docSentenceShingles[j];
          if (docShingles.size === 0) continue;

          const sim = jaccardSimilarity(inputShingles, docShingles);
          if (sim > maxSentenceSimByIndex[i]) maxSentenceSimByIndex[i] = sim;

          if (sim >= 70) {
            if (sim > maxExact) maxExact = sim;
            matches.push({
              source: 'internal',
              type: 'exact',
              matchedText: sentences[i],
              matchedFrom: `${doc.title || `Saved document #${di + 1}`} — sentence ${j + 1}`,
              similarity: Number(sim.toFixed(2)),
              suggestion:
                'Near-exact match against saved content. Rewrite this sentence in your own words or add a citation.',
            });
            break; // one strong match per sentence is enough
          } else if (sim >= 50) {
            if (sim > maxRepeated) maxRepeated = sim;
          }
        }
      }
    }

    return {
      matches,
      exactMatchScore: Number(maxExact.toFixed(2)),
      semanticSimilarityScore: Number(maxSemantic.toFixed(2)),
      repeatedContentScore: Number(maxRepeated.toFixed(2)),
      maxSentenceSimilarityByIndex: maxSentenceSimByIndex.map((v) =>
        Number(v.toFixed(2))
      ),
    };
  } catch (err) {
    console.error('Internal plagiarism check failed:', err);
    return empty;
  }
}

/* ============================================================================
 * Layer 2: Heuristic detection
 * ========================================================================== */

interface HeuristicCheckResult {
  genericPhraseScore: number;
  aiPhraseScore: number;
  genericPhrasesFound: { phrase: string; count: number; suggestion: string }[];
  aiPhrasesFound: { phrase: string; count: number; suggestion: string }[];
  repeatedSentences: string[];
  keywordStuffing: { word: string; count: number; expectedMax: number }[];
  topKeywords: { word: string; count: number; frequency: number }[];
  repeatedSentenceIndices: Set<number>;
}

/** Count occurrences of `phrase` in `text` (case-insensitive, word-boundary safe). */
export function countPhrase(text: string, phrase: string): number {
  if (!phrase) return 0;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'gi');
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/** Find the first index of `phrase` in `text` (case-insensitive). */
export function findPhraseIndex(text: string, phrase: string): number {
  if (!phrase) return -1;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|\\W)(${escaped})(\\W|$)`, 'i');
  const m = text.match(pattern);
  if (!m || m.index === undefined) return -1;
  const leading = m[1] || '';
  return m.index + leading.length;
}

/** Normalize a sentence for repeated-sentence detection. */
export function normalizeSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function runHeuristicCheck(
  content: string,
  sentences: string[],
  keywords: string[] = []
): HeuristicCheckResult {
  const lower = content.toLowerCase();
  const wordCount = tokenize(content).length || 1;

  // --- Generic phrase detection ---
  const genericPhrasesFound: {
    phrase: string;
    count: number;
    suggestion: string;
  }[] = [];
  let genericHits = 0;
  for (const phrase of GENERIC_PHRASES) {
    const count = countPhrase(lower, phrase);
    if (count > 0) {
      genericHits += count;
      genericPhrasesFound.push({
        phrase,
        count,
        suggestion: 'Replace with a specific, concrete phrase.',
      });
    }
  }
  // Score scales with density: 0 hits = 0, baseline 8 hits per 100 words = 100.
  const genericPhraseScore = Math.min(
    100,
    (genericHits / Math.max(8, wordCount / 100)) * 100
  );

  // --- AI phrase detection ---
  const aiPhrasesFound: { phrase: string; count: number; suggestion: string }[] =
    [];
  let aiHits = 0;
  for (const phrase of AI_PHRASES) {
    const count = countPhrase(lower, phrase);
    if (count > 0) {
      aiHits += count;
      aiPhrasesFound.push({
        phrase,
        count,
        suggestion: 'Replace with plain, conversational language.',
      });
    }
  }
  const aiPhraseScore = Math.min(
    100,
    (aiHits / Math.max(6, wordCount / 150)) * 100
  );

  // --- Repeated sentences ---
  const seen = new Map<string, number>(); // normalized -> first index
  const repeated: string[] = [];
  const repeatedIndices = new Set<number>();
  for (let i = 0; i < sentences.length; i++) {
    const norm = normalizeSentence(sentences[i]);
    if (norm.split(' ').length < 4) continue; // skip trivially short
    if (seen.has(norm)) {
      repeated.push(sentences[i]);
      repeatedIndices.add(i);
    } else {
      seen.set(norm, i);
    }
  }

  // --- Keyword stuffing ---
  // Scaled threshold: a single word may appear at most ~2% of the time, with
  // a floor of 5 occurrences for very short content.
  const expectedMax = Math.max(5, Math.round(wordCount * 0.02));
  const contentWords = tokenizeContentWords(content);
  const wordCounts = new Map<string, number>();
  for (const w of contentWords) wordCounts.set(w, (wordCounts.get(w) || 0) + 1);

  const keywordStuffing: { word: string; count: number; expectedMax: number }[] =
    [];
  for (const [word, count] of wordCounts) {
    if (count > expectedMax) {
      keywordStuffing.push({ word, count, expectedMax });
    }
  }
  // Also explicitly check the user-provided target keywords.
  if (keywords.length > 0) {
    for (const kw of keywords) {
      const k = kw.toLowerCase().trim();
      if (!k) continue;
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const count = (
        lower.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []
      ).length;
      if (
        count > expectedMax &&
        !keywordStuffing.find((s) => s.word === k)
      ) {
        keywordStuffing.push({ word: k, count, expectedMax });
      }
    }
  }
  keywordStuffing.sort((a, b) => b.count - a.count);

  // --- Top keywords ---
  const topKeywords = Array.from(wordCounts.entries())
    .map(([word, count]) => ({
      word,
      count,
      frequency: Number(((count / wordCount) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    genericPhraseScore: Number(genericPhraseScore.toFixed(2)),
    aiPhraseScore: Number(aiPhraseScore.toFixed(2)),
    genericPhrasesFound,
    aiPhrasesFound,
    repeatedSentences: repeated,
    keywordStuffing,
    topKeywords,
    repeatedSentenceIndices: repeatedIndices,
  };
}

/* ============================================================================
 * Layer 3: Paragraph / sentence analysis
 * ========================================================================== */

function analyzeSentences(
  sentences: string[],
  heuristic: HeuristicCheckResult,
  sentenceSimilarity: number[]
): SentenceAnalysis[] {
  return sentences.map((text, idx) => {
    const lower = text.toLowerCase();
    const wordCount = tokenize(text).length;
    const issues: string[] = [];

    if (heuristic.repeatedSentenceIndices.has(idx)) issues.push('repeated');
    if (GENERIC_PHRASES.some((p) => countPhrase(lower, p) > 0))
      issues.push('generic_phrase');
    if (AI_PHRASES.some((p) => countPhrase(lower, p) > 0))
      issues.push('ai_phrase');
    if (sentenceSimilarity[idx] >= 50) issues.push('internal_similarity');

    return {
      text,
      index: idx,
      wordCount,
      issues,
      similarity: sentenceSimilarity[idx] || 0,
      isRepeated: heuristic.repeatedSentenceIndices.has(idx),
      isLong: wordCount > 35,
    };
  });
}

function analyzeParagraphs(
  paragraphs: string[],
  heuristic: HeuristicCheckResult,
  sentenceSimilarityByIndex: number[]
): ParagraphAnalysis[] {
  let sentenceCursor = 0;
  return paragraphs.map((text, pIdx) => {
    const paraLower = text.toLowerCase();
    const paraSentences = splitSentences(text);
    const sentenceAnalyses: SentenceAnalysis[] = paraSentences.map((s) => {
      const lower = s.toLowerCase();
      const wordCount = tokenize(s).length;
      const issues: string[] = [];
      const normalized = normalizeSentence(s);
      const isRepeated = heuristic.repeatedSentences.some(
        (rs) => normalizeSentence(rs) === normalized
      );
      if (isRepeated) issues.push('repeated');
      if (GENERIC_PHRASES.some((p) => countPhrase(lower, p) > 0))
        issues.push('generic_phrase');
      if (AI_PHRASES.some((p) => countPhrase(lower, p) > 0))
        issues.push('ai_phrase');

      const sim = sentenceSimilarityByIndex[sentenceCursor] || 0;
      if (sim >= 50) issues.push('internal_similarity');
      sentenceCursor++;
      return {
        text: s,
        index: sentenceCursor - 1,
        wordCount,
        issues,
        similarity: sim,
        isRepeated,
        isLong: wordCount > 35,
      };
    });

    const wordCount = tokenize(text).length;
    const genericHits = GENERIC_PHRASES.reduce(
      (acc, p) => acc + countPhrase(paraLower, p),
      0
    );
    const aiHits = AI_PHRASES.reduce(
      (acc, p) => acc + countPhrase(paraLower, p),
      0
    );
    const repeatedHits = sentenceAnalyses.filter((s) => s.isRepeated).length;
    const maxSim = Math.max(0, ...sentenceAnalyses.map((s) => s.similarity));

    // Risk classification
    let risk: ParagraphAnalysis['risk'] = 'safe';
    let fixType: ParagraphAnalysis['fixType'] = 'keep';

    const riskScore =
      aiHits * 12 + genericHits * 8 + repeatedHits * 20 + maxSim * 0.4;

    if (riskScore >= 40 || maxSim >= 70) {
      risk = 'high';
      fixType = 'rewrite';
    } else if (riskScore >= 20 || maxSim >= 50) {
      risk = 'medium';
      fixType = maxSim >= 50 ? 'add_citation' : 'rewrite';
    } else if (riskScore >= 8 || genericHits > 0 || aiHits > 0) {
      risk = 'low';
      fixType = aiHits > 0 ? 'rewrite' : 'add_example';
    } else {
      risk = 'safe';
      fixType = 'keep';
    }

    if (repeatedHits > 0 && risk !== 'high') {
      fixType = 'remove';
    }

    const issues: string[] = [];
    if (genericHits > 0) issues.push(`generic_phrases:${genericHits}`);
    if (aiHits > 0) issues.push(`ai_phrases:${aiHits}`);
    if (repeatedHits > 0) issues.push(`repeated_sentences:${repeatedHits}`);
    if (maxSim >= 50) issues.push(`internal_similarity:${maxSim.toFixed(0)}`);

    const suggestion = buildParagraphSuggestion(risk, fixType, {
      genericHits,
      aiHits,
      repeatedHits,
      maxSim,
    });

    return {
      index: pIdx,
      text,
      wordCount,
      risk,
      fixType,
      issues,
      sentences: sentenceAnalyses,
      suggestion,
    };
  });
}

function buildParagraphSuggestion(
  _risk: ParagraphAnalysis['risk'],
  fixType: ParagraphAnalysis['fixType'],
  ctx: { genericHits: number; aiHits: number; repeatedHits: number; maxSim: number }
): string {
  if (fixType === 'keep') {
    return 'This paragraph reads cleanly. No action needed.';
  }
  const parts: string[] = [];
  if (ctx.aiHits > 0) parts.push(`${ctx.aiHits} AI-typical phrase(s)`);
  if (ctx.genericHits > 0) parts.push(`${ctx.genericHits} generic phrase(s)`);
  if (ctx.repeatedHits > 0) parts.push(`${ctx.repeatedHits} repeated sentence(s)`);
  if (ctx.maxSim >= 50)
    parts.push(`${ctx.maxSim.toFixed(0)}% similarity to saved content`);

  switch (fixType) {
    case 'rewrite':
      return `Rewrite this paragraph — ${parts.join(', ')}. Use your own voice and concrete details.`;
    case 'add_citation':
      return `Add a citation or attribution — ${parts.join(', ')}. The overlap with saved content is too high to leave unattributed.`;
    case 'add_example':
      return `Strengthen with a concrete example — ${parts.join(', ')}. Specifics reduce the generic feel.`;
    case 'remove':
      return `Remove or merge duplicate sentences — ${parts.join(', ')}.`;
    default:
      return 'Review this paragraph.';
  }
}

/* ============================================================================
 * Scoring
 * ========================================================================== */

interface ScoreComponents {
  plagiarismRisk: number;
  originalityScore: number;
  humanQualityScore: number;
  specificExamples: number;
  originalInsight: number;
  naturalFlow: number;
  sentenceVariation: number;
  lowRepetition: number;
  readability: number;
  helpfulDepth: number;
}

/** Count syllables in a word (rough heuristic). */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  cleaned = cleaned.replace(/^y/, '');
  const matches = cleaned.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/** A simplified Flesch reading-ease score (0-100). */
function fleschReadingEase(sentences: string[], words: string[]): number {
  if (sentences.length === 0 || words.length === 0) return 0;
  const totalSyllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = totalSyllables / words.length;
  const score = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  return Math.max(0, Math.min(100, score));
}

/** Standard deviation of an array of numbers. */
function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeScores(
  exactMatch: number,
  semanticSim: number,
  repeated: number,
  generic: number,
  ai: number,
  sentences: string[],
  words: string[],
  heuristic: HeuristicCheckResult
): ScoreComponents {
  // --- Plagiarism Risk ---
  const plagiarismRisk = Math.min(
    100,
    Math.round(
      exactMatch * 0.4 +
        semanticSim * 0.3 +
        repeated * 0.15 +
        generic * 0.1 +
        ai * 0.05
    )
  );
  const originalityScore = Math.max(0, 100 - plagiarismRisk);

  // --- Human Quality Score components ---
  const lower = sentences.join(' ').toLowerCase();
  const wordCount = words.length || 1;

  // Specific examples: signal words + numbers + percentages.
  const exampleMarkers = (
    lower.match(
      /\b(for example|for instance|such as|like|including|e\.g\.|case in point|imagine|consider)\b/g
    ) || []
  ).length;
  const numbers = (lower.match(/\b\d+(\.\d+)?%?\b/g) || []).length;
  const exampleScore = Math.min(100, exampleMarkers * 15 + numbers * 8);

  // Original insight: low generic-phrase density + low AI-phrase density
  const originalInsight = Math.max(
    0,
    Math.round(100 - (generic * 0.6 + ai * 0.4))
  );

  // Natural flow: low AI-phrase score => high natural flow
  const naturalFlow = Math.max(0, Math.round(100 - ai * 0.9 - generic * 0.2));

  // Sentence variation: stddev of sentence lengths
  const sentenceLengths = sentences.map((s) => tokenize(s).length);
  const variation = stdDev(sentenceLengths);
  const sentenceVariation = Math.min(100, Math.round(variation * 12));

  // Low repetition
  const repeatedRatio =
    heuristic.repeatedSentences.length / Math.max(sentences.length, 1);
  const lowRepetition = Math.round(
    (1 - Math.min(1, repeatedRatio)) * 100
  );

  // Readability (Flesch reading ease, scaled)
  const readability = Math.round(fleschReadingEase(sentences, words));

  // Helpful depth: word count + paragraph structure + presence of examples
  const depthFromLength = Math.min(100, (wordCount / 600) * 60);
  const depthFromExamples = Math.min(40, exampleMarkers * 10 + numbers * 4);
  const helpfulDepth = Math.min(
    100,
    Math.round(depthFromLength + depthFromExamples)
  );

  const humanQualityScore = Math.min(
    100,
    Math.round(
      exampleScore * 0.2 +
        originalInsight * 0.2 +
        naturalFlow * 0.15 +
        sentenceVariation * 0.15 +
        lowRepetition * 0.1 +
        readability * 0.1 +
        helpfulDepth * 0.1
    )
  );

  return {
    plagiarismRisk,
    originalityScore,
    humanQualityScore,
    specificExamples: exampleScore,
    originalInsight,
    naturalFlow,
    sentenceVariation,
    lowRepetition,
    readability,
    helpfulDepth,
  };
}

/* ============================================================================
 * Checklists
 * ========================================================================== */

function buildOriginalityChecklist(
  scores: ScoreComponents,
  heuristic: HeuristicCheckResult,
  internalMatches: PlagiarismMatch[]
): ChecklistItem[] {
  const highSeverityInternal = internalMatches.filter(
    (m) => m.similarity >= 70
  ).length;
  return [
    {
      id: 'no_internal_match',
      label: 'No high-similarity match against saved content',
      passed: highSeverityInternal === 0,
      description:
        highSeverityInternal === 0
          ? 'Content is sufficiently distinct from previously saved documents.'
          : `${highSeverityInternal} sentence(s) closely match saved content. Rewrite them.`,
    },
    {
      id: 'low_generic_phrases',
      label: 'Avoid generic / cliché phrases',
      passed: heuristic.genericPhrasesFound.length === 0,
      description:
        heuristic.genericPhrasesFound.length === 0
          ? 'No generic phrases detected.'
          : `${heuristic.genericPhrasesFound.length} generic phrase(s) found.`,
    },
    {
      id: 'low_ai_phrases',
      label: 'Avoid AI-typical phrasing',
      passed: heuristic.aiPhrasesFound.length === 0,
      description:
        heuristic.aiPhrasesFound.length === 0
          ? 'No AI-typical phrases detected.'
          : `${heuristic.aiPhrasesFound.length} AI-typical phrase(s) found.`,
    },
    {
      id: 'no_duplicate_sentences',
      label: 'No duplicated sentences',
      passed: heuristic.repeatedSentences.length === 0,
      description:
        heuristic.repeatedSentences.length === 0
          ? 'No repeated sentences detected.'
          : `${heuristic.repeatedSentences.length} repeated sentence(s) detected.`,
    },
    {
      id: 'no_keyword_stuffing',
      label: 'No keyword stuffing',
      passed: heuristic.keywordStuffing.length === 0,
      description:
        heuristic.keywordStuffing.length === 0
          ? 'Keyword density is within healthy limits.'
          : `${heuristic.keywordStuffing.length} word(s) appear too frequently.`,
    },
    {
      id: 'originality_above_threshold',
      label: 'Originality score ≥ 70',
      passed: scores.originalityScore >= 70,
      description: `Current originality score: ${scores.originalityScore}/100.`,
    },
  ];
}

function buildHumanQualityChecklist(
  scores: ScoreComponents
): ChecklistItem[] {
  return [
    {
      id: 'specific_examples',
      label: 'Includes specific examples / data',
      passed: scores.specificExamples >= 40,
      description: `Examples score: ${scores.specificExamples}/100.`,
    },
    {
      id: 'original_insight',
      label: 'Contains original insight',
      passed: scores.originalInsight >= 70,
      description: `Original insight score: ${scores.originalInsight}/100.`,
    },
    {
      id: 'natural_flow',
      label: 'Reads naturally (low AI phrasing)',
      passed: scores.naturalFlow >= 70,
      description: `Natural flow score: ${scores.naturalFlow}/100.`,
    },
    {
      id: 'sentence_variation',
      label: 'Varied sentence length',
      passed: scores.sentenceVariation >= 40,
      description: `Sentence variation score: ${scores.sentenceVariation}/100.`,
    },
    {
      id: 'low_repetition',
      label: 'Low repetition',
      passed: scores.lowRepetition >= 90,
      description: `Repetition score: ${scores.lowRepetition}/100.`,
    },
    {
      id: 'readability',
      label: 'Readable (Flesch ≥ 50)',
      passed: scores.readability >= 50,
      description: `Readability score: ${scores.readability}/100.`,
    },
    {
      id: 'helpful_depth',
      label: 'Provides helpful depth',
      passed: scores.helpfulDepth >= 50,
      description: `Helpful depth score: ${scores.helpfulDepth}/100.`,
    },
  ];
}

function buildSeoChecklist(
  title: string | undefined,
  keywords: string[] | undefined,
  content: string,
  heuristic: HeuristicCheckResult,
  stats: PlagiarismReport['stats']
): ChecklistItem[] {
  const titlePresent = !!title && title.trim().length > 0;
  const titleLength = title ? title.trim().length : 0;
  const wordCount = stats.wordCount;
  const firstParagraph = splitParagraphs(content)[0] || '';
  const keywordInTitle =
    keywords && keywords.length > 0
      ? keywords.filter(
          (k) => title && title.toLowerCase().includes(k.toLowerCase())
        ).length
      : 0;
  const keywordInFirstPara =
    keywords && keywords.length > 0
      ? keywords.filter((k) =>
          firstParagraph.toLowerCase().includes(k.toLowerCase())
        ).length
      : 0;
  const hasHeadings = /^#{1,6}\s/m.test(content) || /<h[1-6]/i.test(content);

  return [
    {
      id: 'title_present',
      label: 'Title is set',
      passed: titlePresent,
      description: titlePresent ? 'Title provided.' : 'Add a descriptive title.',
    },
    {
      id: 'title_length',
      label: 'Title length 30-60 characters',
      passed: titleLength >= 30 && titleLength <= 60,
      description: `Current title length: ${titleLength} characters.`,
    },
    {
      id: 'keyword_in_title',
      label: 'Primary keyword in title',
      passed: keywords && keywords.length > 0 ? keywordInTitle > 0 : true,
      description:
        keywords && keywords.length > 0
          ? `${keywordInTitle}/${keywords.length} keyword(s) appear in the title.`
          : 'No keywords supplied — skipping.',
    },
    {
      id: 'keyword_in_intro',
      label: 'Primary keyword in first paragraph',
      passed: keywords && keywords.length > 0 ? keywordInFirstPara > 0 : true,
      description:
        keywords && keywords.length > 0
          ? `${keywordInFirstPara}/${keywords.length} keyword(s) appear in the intro.`
          : 'No keywords supplied — skipping.',
    },
    {
      id: 'word_count',
      label: 'Content length ≥ 300 words',
      passed: wordCount >= 300,
      description: `Current word count: ${wordCount}.`,
    },
    {
      id: 'no_keyword_stuffing',
      label: 'No keyword stuffing',
      passed: heuristic.keywordStuffing.length === 0,
      description:
        heuristic.keywordStuffing.length === 0
          ? 'Keyword density is healthy.'
          : `${heuristic.keywordStuffing.length} over-repeated keyword(s).`,
    },
    {
      id: 'structure',
      label: 'Uses headings / structured paragraphs',
      passed: hasHeadings || splitParagraphs(content).length >= 3,
      description: hasHeadings
        ? 'Headings detected.'
        : splitParagraphs(content).length >= 3
        ? 'Multiple paragraphs detected.'
        : 'Add headings or break content into multiple paragraphs.',
    },
  ];
}

/* ============================================================================
 * Main entry point
 * ========================================================================== */

export async function runPlagiarismCheck(
  input: PlagiarismCheckInput
): Promise<PlagiarismReport> {
  const content: string = input.content || '';
  const title: string | undefined = input.title;
  const keywords: string[] = input.keywords || [];
  const isGuest: boolean = input.isGuest ?? !input.userId;
  const userId: string | undefined = input.userId;

  const sentences = splitSentences(content);
  const paragraphs = splitParagraphs(content);
  const words = tokenize(content);
  const wordCount = words.length;

  // ---- Layer 1: Internal (skip guests) ----
  let internal: InternalCheckResult;
  if (isGuest || !userId) {
    internal = {
      matches: [],
      exactMatchScore: 0,
      semanticSimilarityScore: 0,
      repeatedContentScore: 0,
      maxSentenceSimilarityByIndex: sentences.map(() => 0),
    };
  } else {
    internal = await runInternalCheck(content, userId, sentences);
  }

  // ---- Layer 2: Heuristic ----
  const heuristic = runHeuristicCheck(content, sentences, keywords);

  // ---- Layer 3: Paragraph + sentence analysis ----
  const sentenceAnalyses = analyzeSentences(
    sentences,
    heuristic,
    internal.maxSentenceSimilarityByIndex
  );
  const paragraphAnalyses = analyzeParagraphs(
    paragraphs,
    heuristic,
    internal.maxSentenceSimilarityByIndex
  );

  // ---- Scoring ----
  const scores = computeScores(
    internal.exactMatchScore,
    internal.semanticSimilarityScore,
    internal.repeatedContentScore,
    heuristic.genericPhraseScore,
    heuristic.aiPhraseScore,
    sentences,
    words,
    heuristic
  );

  // ---- Stats ----
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const stats: PlagiarismReport['stats'] = {
    wordCount,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    avgWordsPerSentence: sentences.length
      ? Number((wordCount / sentences.length).toFixed(2))
      : 0,
    uniqueWordRatio: wordCount
      ? Number((uniqueWords / wordCount).toFixed(2))
      : 0,
    longSentenceCount: sentenceAnalyses.filter((s) => s.isLong).length,
  };

  // ---- Checklists ----
  const originalityChecklist = buildOriginalityChecklist(
    scores,
    heuristic,
    internal.matches
  );
  const humanQualityChecklist = buildHumanQualityChecklist(scores);
  const seoChecklist = buildSeoChecklist(
    title,
    keywords,
    content,
    heuristic,
    stats
  );

  // ---- Assemble report ----
  const report: PlagiarismReport = {
    content,
    title,
    keywords,
    isGuest,

    plagiarismRisk: scores.plagiarismRisk,
    originalityScore: scores.originalityScore,
    humanQualityScore: scores.humanQualityScore,

    internalMatches: internal.matches,
    exactMatchScore: internal.exactMatchScore,
    semanticSimilarityScore: internal.semanticSimilarityScore,
    repeatedContentScore: internal.repeatedContentScore,

    genericPhraseScore: heuristic.genericPhraseScore,
    aiPhraseScore: heuristic.aiPhraseScore,
    genericPhrasesFound: heuristic.genericPhrasesFound,
    aiPhrasesFound: heuristic.aiPhrasesFound,
    repeatedSentences: heuristic.repeatedSentences,
    keywordStuffing: heuristic.keywordStuffing,
    topKeywords: heuristic.topKeywords,

    paragraphs: paragraphAnalyses,
    sentences: sentenceAnalyses,

    originalityChecklist,
    humanQualityChecklist,
    seoChecklist,

    stats,
    generatedAt: new Date().toISOString(),
  };

  return report;
}
