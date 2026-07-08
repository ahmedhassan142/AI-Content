/**
 * Plagiarism Fixer — rewrites content to reduce plagiarism.
 *
 * Steps:
 *  1. Replaces 60+ generic phrases with specific alternatives.
 *  2. Replaces 50+ AI-typical phrases with plain-language alternatives.
 *  3. Removes duplicate sentences (keeps the first occurrence).
 *  4. Reduces keyword stuffing with synonyms.
 *  5. Cleans up grammar artifacts (double spaces, orphaned punctuation, capitalization).
 *  6. Re-runs runPlagiarismCheck on the fixed content.
 *
 * Exports: fixPlagiarism(content, oldReport, userId?, isGuest?, title?, keywords?)
 */

import {
  runPlagiarismCheck,
  type PlagiarismReport,
  splitSentences,
  splitParagraphs,
  countPhrase,
  normalizeSentence,
} from './checker';

/* ============================================================================
 * Generic phrase replacements (plain, specific language)
 * Keys must match GENERIC_PHRASES in checker.ts.
 * ========================================================================== */

const GENERIC_FIXES: Record<string, string> = {
  "in today's fast-paced world": 'today',
  'at the end of the day': 'ultimately',
  'plays a crucial role': 'matters',
  'is crucial for': 'matters for',
  'cutting-edge': 'modern',
  'in conclusion': 'so',
  'first and foremost': 'first',
  'last but not least': 'finally',
  'it goes without saying': 'obviously',
  'needless to say': 'obviously',
  'when it comes to': 'for',
  'the bottom line is': 'so',
  'in this day and age': 'today',
  'a myriad of': 'many',
  'a plethora of': 'many',
  'in light of': 'because of',
  'with regard to': 'about',
  'in order to': 'to',
  'due to the fact that': 'because',
  'for the purpose of': 'for',
  'in the event that': 'if',
  'in spite of the fact that': 'although',
  'until such time as': 'until',
  'with reference to': 'about',
  'in the vicinity of': 'near',
  'as a matter of fact': 'in fact',
  'if you will': '',
  'quite frankly': 'frankly',
  'generally speaking': 'usually',
  'strictly speaking': '',
  'for all intents and purposes': 'essentially',
  'in the grand scheme of things': 'overall',
  'from a broader perspective': 'overall',
  'moving forward': 'next',
  'going forward': 'next',
  'by and large': 'mostly',
  'more often than not': 'usually',
  'nine times out of ten': 'usually',
  'in the realm of': 'in',
  'in the world of': 'in',
  'in the landscape of': 'in',
  'navigate the complexities of': 'handle',
  'an integral part of': 'part of',
  'a vital component of': 'part of',
  'a key driver of': 'a cause of',
  'shape the future of': 'shape',
  'across the board': 'everywhere',
  'set the stage for': 'prepare for',
  'pave the way for': 'prepare for',
  'open the door to': 'allow',
  'shed light on': 'explain',
  'bring to the table': 'offer',
  'get the ball rolling': 'start',
  'on the same page': 'agreed',
  'in the loop': 'informed',
  'low-hanging fruit': 'easy wins',
  'elephant in the room': 'obvious issue',
  'perfect storm': 'bad mix',
  'game-changer': 'big change',
  'paradigm shift': 'shift',
  'think outside the box': 'think differently',
  'best practices': 'good practices',
  'value-add': 'value',
  'reinvent the wheel': 'redo existing work',
  'moving the needle': 'making progress',
  'boil the ocean': 'do too much',
};

/* ============================================================================
 * AI-typical phrase replacements (plain language)
 * Keys must match AI_PHRASES in checker.ts.
 * ========================================================================== */

const AI_FIXES: Record<string, string> = {
  'delve into': 'dig into',
  'delve deeper': 'dig deeper',
  leverage: 'use',
  'foster a': 'build a',
  'holistic approach': 'full-picture approach',
  'comprehensive guide': 'full guide',
  'seamless experience': 'smooth experience',
  'robust solution': 'strong solution',
  'innovative solutions': 'new solutions',
  'in the realm of': 'in',
  'it is important to note': 'note that',
  'it is worth noting': 'note that',
  'it is crucial to understand': 'you should understand that',
  'navigating the complexities': 'handling the issues',
  'ever-evolving landscape': 'changing field',
  'unleash the power of': 'use',
  'harness the potential of': 'use',
  'embark on a journey': 'start',
  'treasure trove of information': 'great source of information',
  'wealth of knowledge': 'lot of knowledge',
  'unlock the secrets': 'learn',
  demystify: 'explain',
  'nuanced understanding': 'clear understanding',
  'tailored to your needs': 'made for you',
  "in today's digital age": 'today',
  'tapestry of': 'mix of',
  'symphony of': 'mix of',
  orchestrate: 'coordinate',
  'myriad of': 'many',
  'plethora of': 'many',
  underpin: 'support',
  'pave the way for': 'prepare for',
  'at the forefront of': 'leading',
  'underscores the importance': 'shows the importance',
  'landscape of': 'field of',
  bolster: 'strengthen',
  augment: 'add to',
  facilitate: 'help',
  robust: 'strong',
  nuanced: 'detailed',
  intricate: 'complex',
  elucidate: 'explain',
  underscore: 'highlight',
  'paramount importance': 'great importance',
  'in essence': 'basically',
  moreover: 'also',
  furthermore: 'also',
  consequently: 'so',
  nevertheless: 'still',
  'in the world of': 'in',
};

/* ============================================================================
 * Synonym map for keyword-stuffing reduction.
 * Each entry is a list of synonyms — we rotate through them so we don't
 * simply replace every occurrence with the same word.
 * ========================================================================== */

const SYNONYMS: Record<string, string[]> = {
  content: ['material', 'writing', 'text', 'copy'],
  strategy: ['plan', 'approach', 'method', 'tactic'],
  marketing: ['promotion', 'advertising', 'outreach', 'campaigns'],
  business: ['company', 'firm', 'organization', 'enterprise'],
  customer: ['client', 'buyer', 'shopper', 'user'],
  product: ['item', 'offering', 'solution', 'good'],
  service: ['offering', 'help', 'support', 'assistance'],
  solution: ['answer', 'fix', 'remedy', 'approach'],
  important: ['key', 'critical', 'essential', 'vital'],
  effective: ['useful', 'powerful', 'strong', 'working'],
  quality: ['standard', 'grade', 'caliber', 'value'],
  data: ['information', 'details', 'facts', 'figures'],
  technology: ['tech', 'tools', 'systems', 'software'],
  people: ['individuals', 'users', 'audience', 'folks'],
  help: ['assist', 'support', 'aid', 'guide'],
  improve: ['boost', 'lift', 'raise', 'strengthen'],
  create: ['build', 'make', 'produce', 'craft'],
  understand: ['grasp', 'get', 'see', 'follow'],
  provide: ['give', 'offer', 'supply', 'deliver'],
  ensure: ['make sure', 'guarantee', 'secure', 'confirm'],
};

/* ============================================================================
 * Helpers
 * ========================================================================== */

interface FixChange {
  type:
    | 'generic_phrase'
    | 'ai_phrase'
    | 'duplicate_sentence'
    | 'keyword_stuffing'
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
 * leading and trailing boundary characters. Returns the new text and the
 * number of replacements performed.
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
    // Decide whether to keep a leading space.
    const leadChar = lead || '';
    const trailChar = trail || '';
    if (replacement === '') {
      // Removing the phrase — collapse surrounding whitespace cleanly.
      return leadChar.match(/\s/) && trailChar.match(/\s/) ? ' ' : leadChar + trailChar;
    }
    // Preserve capitalization of the first letter when the phrase starts a sentence.
    let rep = replacement;
    if (leadChar === '' || leadChar === '.') {
      const firstLetter = phrase.charAt(0);
      const inputFirstLetter = full.charAt((leadChar || '').length);
      if (inputFirstLetter === firstLetter.toUpperCase() && firstLetter !== firstLetter.toUpperCase()) {
        rep = replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
    }
    return `${leadChar}${rep}${trailChar}`;
  });
  return { text: newText, count };
}

/** Apply a full replacement map (e.g. GENERIC_FIXES) and log every change. */
function applyReplacementMap(
  text: string,
  map: Record<string, string>,
  type: FixChange['type'],
  label: string
): { text: string; changes: FixChange[] } {
  let working = text;
  const changes: FixChange[] = [];

  // Sort keys by length descending so multi-word phrases match before their
  // individual word sub-parts (e.g. "in the realm of" before "in").
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);

  for (const phrase of keys) {
    if (countPhrase(working.toLowerCase(), phrase) === 0) continue;
    const before = working;
    const { text: after, count } = replacePhrase(working, phrase, map[phrase]);
    if (count > 0) {
      working = after;
      changes.push({
        type,
        before: phrase,
        after: map[phrase] || '(removed)',
        description: `Replaced ${count} occurrence(s) of ${label} "${phrase}" → "${map[phrase] || '(removed)'}".`,
      });
      // Guard against accidental infinite loops — none expected, but safe.
      if (before === after) break;
    }
  }
  return { text: working, changes };
}

/** Remove duplicate sentences (keeping the first occurrence). */
function removeDuplicateSentences(text: string): { text: string; changes: FixChange[] } {
  const paragraphs = splitParagraphs(text);
  const changes: FixChange[] = [];
  const seen = new Set<string>();
  const cleanedParagraphs: string[] = [];

  for (const para of paragraphs) {
    const sentences = splitSentences(para);
    const kept: string[] = [];
    for (const sentence of sentences) {
      const norm = normalizeSentence(sentence);
      if (norm.split(' ').length < 4) {
        kept.push(sentence);
        continue;
      }
      if (seen.has(norm)) {
        changes.push({
          type: 'duplicate_sentence',
          before: sentence,
          after: '(removed)',
          description: 'Removed duplicate sentence.',
        });
      } else {
        seen.add(norm);
        kept.push(sentence);
      }
    }
    cleanedParagraphs.push(kept.join(' '));
  }

  return { text: cleanedParagraphs.join('\n\n'), changes };
}

/** Reduce keyword stuffing by rotating over-used words through synonyms. */
function reduceKeywordStuffing(
  text: string,
  oldReport: PlagiarismReport
): { text: string; changes: FixChange[] } {
  const changes: FixChange[] = [];
  if (!oldReport.keywordStuffing || oldReport.keywordStuffing.length === 0) {
    return { text, changes };
  }

  let working = text;
  for (const { word, count, expectedMax } of oldReport.keywordStuffing) {
    const synonyms = SYNONYMS[word.toLowerCase()];
    if (!synonyms || synonyms.length === 0) continue;
    if (count <= expectedMax) continue;

    // We need to replace (count - expectedMax) occurrences — but for safety
    // we cap at the synonym list length so we don't repeat the same synonym
    // ad nauseam.
    const toReplace = Math.min(count - expectedMax, synonyms.length * 2);
    if (toReplace <= 0) continue;

    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the word with case-insensitive whole-word boundaries.
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    let replaced = 0;
    let synIdx = 0;

    const before = working;
    working = working.replace(re, (match) => {
      if (replaced >= toReplace) return match;
      const syn = synonyms[synIdx % synonyms.length];
      synIdx++;
      replaced++;
      // Preserve capitalization.
      if (match.charAt(0) === match.charAt(0).toUpperCase()) {
        return syn.charAt(0).toUpperCase() + syn.slice(1);
      }
      return syn;
    });

    if (replaced > 0 && before !== working) {
      changes.push({
        type: 'keyword_stuffing',
        before: `"${word}" × ${count}`,
        after: `"${word}" × ${count - replaced} (rotated in synonyms)`,
        description: `Reduced keyword stuffing for "${word}" — replaced ${replaced} occurrence(s) with synonyms (${synonyms
          .slice(0, Math.min(replaced, synonyms.length))
          .join(', ')}).`,
      });
    }
  }

  return { text: working, changes };
}

/** Clean up common grammar artifacts introduced by the prior steps. */
function cleanGrammar(text: string): { text: string; changes: FixChange[] } {
  const changes: FixChange[] = [];
  const before = text;

  let working = text;

  // Collapse runs of whitespace.
  working = working.replace(/[ \t]{2,}/g, ' ');

  // Trim trailing spaces on each line.
  working = working.replace(/ +\n/g, '\n');

  // Remove spaces before punctuation.
  working = working.replace(/\s+([,.!?;:])/g, '$1');

  // Ensure a single space after punctuation (but not after decimals).
  working = working.replace(/([,.!?;:])(?=[A-Za-z])/g, '$1 ');

  // Fix orphaned punctuation (e.g. " ." → ".").
  working = working.replace(/\s+\./g, '.');

  // Capitalize the first letter of every sentence.
  working = working.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead, ch) => {
    return lead + ch.toUpperCase();
  });

  // Capitalize the first letter of every paragraph.
  working = working.replace(/(?:^|\n\n)([a-z])/g, (_, ch) => _.charAt(0) + ch.toUpperCase());

  // Fix double punctuation (".." → ".", ",," → ",").
  working = working.replace(/([.!?])\1+/g, '$1');

  // Fix " ," → ",".
  working = working.replace(/\s+,/g, ',');

  // Collapse 3+ newlines to 2.
  working = working.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace.
  working = working.replace(/^\s+|\s+$/g, '');

  // Ensure the document ends with terminal punctuation.
  if (working.length > 0 && !/[.!?]["')\]]?$/.test(working)) {
    working = working + '.';
  }

  if (before !== working) {
    changes.push({
      type: 'grammar',
      before: '(grammar artifacts)',
      after: '(cleaned)',
      description: 'Cleaned up double spaces, orphaned punctuation, and capitalization.',
    });
  }

  return { text: working, changes };
}

/* ============================================================================
 * Main entry point
 * ========================================================================== */

export interface FixResult {
  fixedContent: string;
  newReport: PlagiarismReport;
  changes: FixChange[];
  improvement: {
    plagiarismRiskDelta: number; // negative = improvement
    originalityScoreDelta: number; // positive = improvement
    humanQualityScoreDelta: number;
    genericPhrasesRemoved: number;
    aiPhrasesRemoved: number;
    duplicateSentencesRemoved: number;
  };
}

export async function fixPlagiarism(
  content: string,
  oldReport: PlagiarismReport,
  userId?: string,
  isGuest?: boolean,
  title?: string,
  keywords?: string[]
): Promise<FixResult> {
  let working = content;
  const allChanges: FixChange[] = [];

  // 1. Replace generic phrases.
  const genericPass = applyReplacementMap(
    working,
    GENERIC_FIXES,
    'generic_phrase',
    'generic phrase'
  );
  working = genericPass.text;
  allChanges.push(...genericPass.changes);

  // 2. Replace AI-typical phrases.
  const aiPass = applyReplacementMap(
    working,
    AI_FIXES,
    'ai_phrase',
    'AI-typical phrase'
  );
  working = aiPass.text;
  allChanges.push(...aiPass.changes);

  // 3. Remove duplicate sentences.
  const dupPass = removeDuplicateSentences(working);
  working = dupPass.text;
  allChanges.push(...dupPass.changes);

  // 4. Reduce keyword stuffing.
  const stuffPass = reduceKeywordStuffing(working, oldReport);
  working = stuffPass.text;
  allChanges.push(...stuffPass.changes);

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

  const genericPhrasesRemoved =
    (oldReport.genericPhrasesFound.reduce((acc, p) => acc + p.count, 0) || 0) -
    (newReport.genericPhrasesFound.reduce((acc, p) => acc + p.count, 0) || 0);
  const aiPhrasesRemoved =
    (oldReport.aiPhrasesFound.reduce((acc, p) => acc + p.count, 0) || 0) -
    (newReport.aiPhrasesFound.reduce((acc, p) => acc + p.count, 0) || 0);
  const duplicateSentencesRemoved =
    (oldReport.repeatedSentences?.length || 0) -
    (newReport.repeatedSentences?.length || 0);

  return {
    fixedContent: working,
    newReport,
    changes: allChanges,
    improvement: {
      plagiarismRiskDelta: newReport.plagiarismRisk - oldReport.plagiarismRisk,
      originalityScoreDelta:
        newReport.originalityScore - oldReport.originalityScore,
      humanQualityScoreDelta:
        newReport.humanQualityScore - oldReport.humanQualityScore,
      genericPhrasesRemoved: Math.max(0, genericPhrasesRemoved),
      aiPhrasesRemoved: Math.max(0, aiPhrasesRemoved),
      duplicateSentencesRemoved: Math.max(0, duplicateSentencesRemoved),
    },
  };
}
