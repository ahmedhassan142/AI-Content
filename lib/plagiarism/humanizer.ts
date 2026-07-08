/**
 * Content Humanizer — rewrites content to sound more human.
 *
 * Steps:
 *  1. Removes hedging language ("it could be argued that", "one might say
 *     that", "to a certain extent", etc.).
 *  2. Replaces AI-typical phrases with conversational alternatives (the same
 *     detection list as the checker, but conversational replacements).
 *  3. Adds contractions ("it is" → "it's", "do not" → "don't", etc. — 40+
 *     contraction rules).
 *  4. Breaks up long sentences (>35 words) at natural break points.
 *  5. Cleans up grammar artifacts.
 *  6. Re-runs runPlagiarismCheck on the humanized content.
 *
 * Exports: humanizeContent(content, oldReport, userId?, isGuest?, title?, keywords?)
 */

import {
  runPlagiarismCheck,
  type PlagiarismReport,
  splitSentences,
  countPhrase,
} from './checker';

/* ============================================================================
 * Hedging language — these phrases soften statements and signal AI/textbook
 * writing. We simply remove them (with appropriate cleanup).
 * ========================================================================== */

const HEDGING_PHRASES: string[] = [
  'it could be argued that',
  'it can be argued that',
  'one might argue that',
  'one could argue that',
  'one might say that',
  'it might be said that',
  'it is sometimes said that',
  'it is often said that',
  'it could be said that',
  'to a certain extent',
  'to some extent',
  'to a large extent',
  'to a great extent',
  'in some respects',
  'in a sense',
  'in a way',
  'in a manner of speaking',
  'arguably',
  'perhaps',
  'potentially',
  'seemingly',
  'supposedly',
  'purportedly',
  'allegedly',
  'more or less',
  'so to speak',
  'as it were',
  'as one might say',
  'for the most part',
  'by and large',
  'on the whole',
  'generally speaking',
  'strictly speaking',
  'in a sense,',
  'kind of',
  'sort of',
  'it is worth noting that',
  'it should be noted that',
  'it is important to note that',
  'it is interesting to note that',
  'it is worth mentioning that',
];

/* ============================================================================
 * AI-typical phrase replacements — conversational alternatives.
 * Keys must match AI_PHRASES in checker.ts.
 * ========================================================================== */

const AI_HUMANIZE: Record<string, string> = {
  'delve into': 'dig into',
  'delve deeper': 'dig deeper',
  leverage: 'use',
  'foster a': 'grow a',
  'holistic approach': 'big-picture look',
  'comprehensive guide': 'full guide',
  'seamless experience': 'smooth ride',
  'robust solution': 'solid fix',
  'innovative solutions': 'fresh ideas',
  'in the realm of': 'in',
  'it is important to note': 'keep in mind',
  'it is worth noting': 'worth knowing',
  'it is crucial to understand': "here's the thing",
  'navigating the complexities': 'finding your way through',
  'ever-evolving landscape': 'always-shifting world',
  'unleash the power of': 'tap into',
  'harness the potential of': 'make the most of',
  'embark on a journey': 'set out',
  'treasure trove of information': 'goldmine of info',
  'wealth of knowledge': 'a lot to learn',
  'unlock the secrets': 'figure out',
  demystify: 'clear up',
  'nuanced understanding': 'good handle on',
  'tailored to your needs': 'made just for you',
  "in today's digital age": 'these days',
  'tapestry of': 'mix of',
  'symphony of': 'mix of',
  orchestrate: 'line up',
  'myriad of': 'tons of',
  'plethora of': 'plenty of',
  underpin: 'back up',
  'pave the way for': 'make room for',
  'at the forefront of': 'leading the way in',
  'underscores the importance': 'drives home why it matters',
  'landscape of': 'world of',
  bolster: 'shore up',
  augment: 'add to',
  facilitate: 'make easier',
  robust: 'sturdy',
  nuanced: 'layered',
  intricate: 'twisty',
  elucidate: 'lay out',
  underscore: 'drive home',
  'paramount importance': 'huge deal',
  'in essence': 'basically',
  moreover: 'plus',
  furthermore: 'and',
  consequently: 'so',
  nevertheless: 'still',
  'in the world of': 'in',
};

/* ============================================================================
 * Contraction rules — applied word-boundary safe and case-insensitive.
 * 40+ rules.
 * ========================================================================== */

const CONTRACTIONS: { from: string; to: string }[] = [
  { from: 'it is', to: "it's" },
  { from: 'it has', to: "it's" },
  { from: 'it will', to: "it'll" },
  { from: 'it would', to: "it'd" },
  { from: 'it is not', to: "it isn't" },
  { from: 'is not', to: "isn't" },
  { from: 'are not', to: "aren't" },
  { from: 'was not', to: "wasn't" },
  { from: 'were not', to: "weren't" },
  { from: 'do not', to: "don't" },
  { from: 'does not', to: "doesn't" },
  { from: 'did not', to: "didn't" },
  { from: 'have not', to: "haven't" },
  { from: 'has not', to: "hasn't" },
  { from: 'had not', to: "hadn't" },
  { from: 'will not', to: "won't" },
  { from: 'would not', to: "wouldn't" },
  { from: 'should not', to: "shouldn't" },
  { from: 'could not', to: "couldn't" },
  { from: 'cannot', to: "can't" },
  { from: 'can not', to: "can't" },
  { from: 'must not', to: "mustn't" },
  { from: 'shall not', to: "shan't" },
  { from: 'i am', to: "I'm" },
  { from: 'i have', to: "I've" },
  { from: 'i will', to: "I'll" },
  { from: 'i would', to: "I'd" },
  { from: 'you are', to: "you're" },
  { from: 'you have', to: "you've" },
  { from: 'you will', to: "you'll" },
  { from: 'you would', to: "you'd" },
  { from: 'we are', to: "we're" },
  { from: 'we have', to: "we've" },
  { from: 'we will', to: "we'll" },
  { from: 'we would', to: "we'd" },
  { from: 'they are', to: "they're" },
  { from: 'they have', to: "they've" },
  { from: 'they will', to: "they'll" },
  { from: 'they would', to: "they'd" },
  { from: 'he is', to: "he's" },
  { from: 'he has', to: "he's" },
  { from: 'he will', to: "he'll" },
  { from: 'he would', to: "he'd" },
  { from: 'she is', to: "she's" },
  { from: 'she has', to: "she's" },
  { from: 'she will', to: "she'll" },
  { from: 'she would', to: "she'd" },
  { from: 'that is', to: "that's" },
  { from: 'that has', to: "that's" },
  { from: 'that will', to: "that'll" },
  { from: 'there is', to: "there's" },
  { from: 'there has', to: "there's" },
  { from: 'there will', to: "there'll" },
  { from: 'who is', to: "who's" },
  { from: 'who has', to: "who's" },
  { from: 'what is', to: "what's" },
  { from: 'what has', to: "what's" },
  { from: 'where is', to: "where's" },
  { from: 'how is', to: "how's" },
  { from: 'why is', to: "why's" },
  { from: 'let us', to: "let's" },
];

/* ============================================================================
 * Helpers
 * ========================================================================== */

interface HumanizeChange {
  type:
    | 'hedging'
    | 'ai_phrase'
    | 'contraction'
    | 'long_sentence'
    | 'grammar';
  before: string;
  after: string;
  description: string;
}

/** Build a case-insensitive, word-boundary regex for a phrase. */
function phraseRegex(phrase: string, flags = 'gi'): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`, flags);
}

/**
 * Replace every occurrence of `phrase` with `replacement`, preserving the
 * leading and trailing boundary characters.
 */
function replacePhrase(
  text: string,
  phrase: string,
  replacement: string
): { text: string; count: number } {
  if (!phrase) return { text, count: 0 };
  const re = phraseRegex(phrase, 'gi');
  let count = 0;
  const newText = text.replace(re, (full, lead, trail) => {
    count++;
    const leadChar = lead || '';
    const trailChar = trail || '';
    if (replacement === '') {
      // Removing the phrase — collapse whitespace cleanly.
      if (leadChar.match(/\s/) && trailChar.match(/\s/)) return ' ';
      if (leadChar === '' && trailChar === '') return '';
      return leadChar.match(/\s/) ? trailChar : leadChar + trailChar;
    }
    // Preserve capitalization.
    let rep = replacement;
    const inputFirstLetter = full.charAt((leadChar || '').length);
    const phraseFirstLetter = phrase.charAt(0);
    if (
      inputFirstLetter === phraseFirstLetter.toUpperCase() &&
      phraseFirstLetter !== phraseFirstLetter.toUpperCase()
    ) {
      rep = replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return `${leadChar}${rep}${trailChar}`;
  });
  return { text: newText, count };
}

/** Strip hedging language. */
function stripHedging(text: string): { text: string; changes: HumanizeChange[] } {
  let working = text;
  const changes: HumanizeChange[] = [];

  // Longest-first so multi-word phrases match before sub-phrases.
  const sorted = [...HEDGING_PHRASES].sort((a, b) => b.length - a.length);

  for (const phrase of sorted) {
    if (countPhrase(working.toLowerCase(), phrase) === 0) continue;
    const { text: after, count } = replacePhrase(working, phrase, '');
    if (count > 0) {
      working = after;
      changes.push({
        type: 'hedging',
        before: phrase,
        after: '(removed)',
        description: `Removed ${count} hedging phrase(s) "${phrase}".`,
      });
    }
  }
  return { text: working, changes };
}

/** Apply AI-typical phrase replacements (conversational). */
function applyAiReplacements(
  text: string
): { text: string; changes: HumanizeChange[] } {
  let working = text;
  const changes: HumanizeChange[] = [];
  const keys = Object.keys(AI_HUMANIZE).sort((a, b) => b.length - a.length);

  for (const phrase of keys) {
    if (countPhrase(working.toLowerCase(), phrase) === 0) continue;
    const { text: after, count } = replacePhrase(
      working,
      phrase,
      AI_HUMANIZE[phrase]
    );
    if (count > 0) {
      working = after;
      changes.push({
        type: 'ai_phrase',
        before: phrase,
        after: AI_HUMANIZE[phrase],
        description: `Replaced ${count} AI-typical phrase(s) "${phrase}" → "${AI_HUMANIZE[phrase]}".`,
      });
    }
  }
  return { text: working, changes };
}

/** Apply contraction rules. */
function applyContractions(text: string): { text: string; changes: HumanizeChange[] } {
  let working = text;
  const changes: HumanizeChange[] = [];

  // Longest-first so "it is not" matches before "it is".
  const sorted = [...CONTRACTIONS].sort(
    (a, b) => b.from.length - a.from.length
  );

  for (const { from, to } of sorted) {
    const re = phraseRegex(from, 'gi');
    let count = 0;
    const before = working;
    working = working.replace(re, (full, lead, trail) => {
      // Skip if the contraction would cross a sentence boundary.
      if (lead === '.' || trail === '.') return full;
      count++;
      let rep = to;
      // Capitalize if at the start of a sentence.
      const inputFirstLetter = full.charAt((lead || '').length);
      const fromFirstLetter = from.charAt(0);
      if (
        inputFirstLetter === fromFirstLetter.toUpperCase() &&
        fromFirstLetter !== fromFirstLetter.toUpperCase()
      ) {
        rep = to.charAt(0).toUpperCase() + to.slice(1);
      }
      return `${lead || ''}${rep}${trail || ''}`;
    });
    if (count > 0 && before !== working) {
      changes.push({
        type: 'contraction',
        before: from,
        after: to,
        description: `Applied ${count} contraction(s) "${from}" → "${to}".`,
      });
    }
  }
  return { text: working, changes };
}

/**
 * Break long sentences (>35 words) at natural break points
 * (", and ", ", but ", ", which ", ", so ", ", because ").
 */
function breakLongSentences(
  text: string
): { text: string; changes: HumanizeChange[] } {
  const changes: HumanizeChange[] = [];
  const paragraphs = text.split(/\n\s*\n+/);
  const outParagraphs: string[] = [];

  const breakers = [
    { re: /, and /i, replacement: '. And ' },
    { re: /, but /i, replacement: '. But ' },
    { re: /, which /i, replacement: '. This ' },
    { re: /, so /i, replacement: '. So ' },
    { re: /, because /i, replacement: '. That is because ' },
    { re: /; /g, replacement: '. ' },
  ];

  for (const para of paragraphs) {
    const sentences = splitSentences(para);
    const newSentences: string[] = [];

    for (const sentence of sentences) {
      const wordCount = (sentence.match(/\S+/g) || []).length;
      if (wordCount <= 35) {
        newSentences.push(sentence);
        continue;
      }

      const working = sentence;
      let didSplit = false;

      // Try each breaker in order — break once if possible.
      for (const { re, replacement } of breakers) {
        const match = working.match(re);
        if (!match || match.index === undefined) continue;
        // Split at the first occurrence.
        const idx = match.index;
        const first = working.slice(0, idx).trim();
        const rest = (working.slice(idx + match[0].length) || '').trim();
        if (
          first.split(/\s+/).length >= 5 &&
          rest.split(/\s+/).length >= 5
        ) {
          const broken = `${first}${replacement}${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
          // Recurse if the second half is still too long.
          const recursed = breakLongSentences(rest);
          if (recursed.changes.length > 0) {
            newSentences.push(
              `${first}${replacement}${recursed.text.charAt(0).toUpperCase()}${recursed.text.slice(1)}`
            );
          } else {
            newSentences.push(broken);
          }
          changes.push({
            type: 'long_sentence',
            before: sentence,
            after: broken,
            description: `Broke a ${wordCount}-word sentence at "${match[0].trim()}".`,
          });
          didSplit = true;
          break;
        }
      }

      if (!didSplit) {
        newSentences.push(sentence);
      }
    }

    outParagraphs.push(newSentences.join(' '));
  }

  return { text: outParagraphs.join('\n\n'), changes };
}

/** Clean up grammar artifacts. */
function cleanGrammar(text: string): { text: string; changes: HumanizeChange[] } {
  const before = text;
  const changes: HumanizeChange[] = [];

  let working = text;

  // Collapse runs of whitespace.
  working = working.replace(/[ \t]{2,}/g, ' ');

  // Remove spaces before punctuation.
  working = working.replace(/\s+([,.!?;:])/g, '$1');

  // Ensure a single space after punctuation (but not after decimals).
  working = working.replace(/([,.!?;:])(?=[A-Za-z])/g, '$1 ');

  // Fix orphaned punctuation.
  working = working.replace(/\s+\./g, '.');

  // Capitalize the first letter of every sentence.
  working = working.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead, ch) => {
    return lead + ch.toUpperCase();
  });

  // Capitalize the first letter of every paragraph.
  working = working.replace(/(?:^|\n\n)([a-z])/g, (match, ch) => {
    return match.charAt(0) + ch.toUpperCase();
  });

  // Fix double punctuation.
  working = working.replace(/([.!?])\1+/g, '$1');

  // Fix " ," → ",".
  working = working.replace(/\s+,/g, ',');

  // Collapse 3+ newlines to 2.
  working = working.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace.
  working = working.replace(/^\s+|\s+$/g, '');

  // Ensure the document ends with terminal punctuation.
  if (working.length > 0 && !/[.!?]["')\]]?$/.test(working)) {
    working = working + '.';
  }

  // Fix capitalization of standalone "i" (e.g., "i think" → "I think").
  working = working.replace(/\bi\b/g, 'I');

  if (before !== working) {
    changes.push({
      type: 'grammar',
      before: '(grammar artifacts)',
      after: '(cleaned)',
      description: 'Cleaned up spacing, punctuation, and capitalization.',
    });
  }

  return { text: working, changes };
}

/* ============================================================================
 * Main entry point
 * ========================================================================== */

export interface HumanizeResult {
  humanizedContent: string;
  newReport: PlagiarismReport;
  changes: HumanizeChange[];
  improvement: {
    plagiarismRiskDelta: number;
    originalityScoreDelta: number;
    humanQualityScoreDelta: number;
    aiPhrasesRemoved: number;
    hedgingRemoved: number;
    contractionsAdded: number;
    longSentencesBroken: number;
  };
}

export async function humanizeContent(
  content: string,
  oldReport: PlagiarismReport,
  userId?: string,
  isGuest?: boolean,
  title?: string,
  keywords?: string[]
): Promise<HumanizeResult> {
  let working = content;
  const allChanges: HumanizeChange[] = [];

  // 1. Strip hedging language.
  const hedgingPass = stripHedging(working);
  working = hedgingPass.text;
  allChanges.push(...hedgingPass.changes);

  // 2. Replace AI-typical phrases (conversational alternatives).
  const aiPass = applyAiReplacements(working);
  working = aiPass.text;
  allChanges.push(...aiPass.changes);

  // 3. Apply contractions.
  const contractionPass = applyContractions(working);
  working = contractionPass.text;
  allChanges.push(...contractionPass.changes);

  // 4. Break up long sentences.
  const longPass = breakLongSentences(working);
  working = longPass.text;
  allChanges.push(...longPass.changes);

  // 5. Clean up grammar artifacts.
  const grammarPass = cleanGrammar(working);
  working = grammarPass.text;
  allChanges.push(...grammarPass.changes);

  // 6. Re-run the plagiarism check.
  const newReport = await runPlagiarismCheck({
    content: working,
    title,
    keywords,
    userId,
    isGuest: isGuest ?? !userId,
  });

  const aiPhrasesRemoved =
    (oldReport.aiPhrasesFound.reduce((acc, p) => acc + p.count, 0) || 0) -
    (newReport.aiPhrasesFound.reduce((acc, p) => acc + p.count, 0) || 0);
  const hedgingRemoved = allChanges.filter((c) => c.type === 'hedging').length;
  const contractionsAdded = allChanges.filter(
    (c) => c.type === 'contraction'
  ).length;
  const longSentencesBroken = allChanges.filter(
    (c) => c.type === 'long_sentence'
  ).length;

  return {
    humanizedContent: working,
    newReport,
    changes: allChanges,
    improvement: {
      plagiarismRiskDelta:
        newReport.plagiarismRisk - oldReport.plagiarismRisk,
      originalityScoreDelta:
        newReport.originalityScore - oldReport.originalityScore,
      humanQualityScoreDelta:
        newReport.humanQualityScore - oldReport.humanQualityScore,
      aiPhrasesRemoved: Math.max(0, aiPhrasesRemoved),
      hedgingRemoved,
      contractionsAdded,
      longSentencesBroken,
    },
  };
}
