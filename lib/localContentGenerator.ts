/**
 * Local Content Generator
 *
 * Produces structured, real blog/article content from a user prompt without
 * requiring any external AI API. Designed to be a graceful fallback when the
 * Groq API is unavailable, but is also valuable on its own as a deterministic,
 * high-quality content generator.
 *
 * Supports:
 *   - Topic extraction (strips "kindly create/write/generate a blog about" prefixes)
 *   - Title generation
 *   - Ten distinct section generators
 *   - Five tones (professional, casual, friendly, persuasive, humorous)
 *   - Three lengths (short ~180 words, medium ~450 words, long ~1000 words)
 *   - Five content types (blog, article, email, social, general)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tone = 'professional' | 'casual' | 'friendly' | 'persuasive' | 'humorous';
export type Length = 'short' | 'medium' | 'long';
export type ContentType = 'blog' | 'article' | 'email' | 'social' | 'general';

export interface LocalContentParams {
  prompt: string;
  tone: string;
  length: string;
  language: string;
  type?: ContentType | string;
}

interface SectionContext {
  topic: string;
  title: string;
  tone: Tone;
  length: Length;
  type: ContentType;
}

type SectionGenerator = (ctx: SectionContext) => string;

// ---------------------------------------------------------------------------
// Topic extraction
// ---------------------------------------------------------------------------

// Word-boundary anchored helpers so "an" doesn't get partially matched as "a".
// Each helper is wrapped in an outer non-capturing group so that the trailing
// `\b` (or lookahead) stays INSIDE the group when the helper is later made
// optional with `?`. Without this, `${ARTICLE}?` would expand to
// `(?:a|an|the)\b?`, which is an invalid regex ("nothing to repeat").
const ARTICLE = String.raw`(?:(?:an|the|a)\b)`;
const TYPE_WORD = String.raw`(?:(?:blog\s+posts?|blog|articles?|posts?|essays?|guides?|content|pieces?|write[-\s]?ups?|emails?|newsletters?|social\s+media\s+posts?|social\s+posts?|tweets?|captions?))`;
const INTRO_VERB = String.raw`(?:(?:create|write|generate|make|produce|draft|compose|build))`;
const INTRO_PHRASE = String.raw`(?:(?:kindly|please|can\s+you|could\s+you|hey|hi|hello)[!,\s]*)`;
const WANT_PHRASE = String.raw`(?:(?:i\s+(?:want|need|would\s+like|am\s+looking\s+for)\s+(?:you\s+to\s+)?)?)`;
const PREP = String.raw`(?:(?:about|on|regarding|covering|for|of))`;
const GIVE_PHRASE = String.raw`(?:(?:give\s+me|tell\s+me|show\s+me|i\s+want|i\s+need|i\s+would\s+like))`;

const PREFIX_PATTERNS: RegExp[] = [
  // "kindly create/write/generate (me) (a) (blog) (about) ..."
  new RegExp(
    `^\\s*${INTRO_PHRASE}?${WANT_PHRASE}${INTRO_VERB}\\s+(?:me\\s+)?${ARTICLE}?\\s*${TYPE_WORD}?\\s*${PREP}?\\s+`,
    'i'
  ),
  // "write/create/generate (me) (a) (blog) (about) ..."
  new RegExp(
    `^\\s*${INTRO_VERB}\\s+(?:me\\s+)?${ARTICLE}?\\s*${TYPE_WORD}?\\s*${PREP}?\\s+`,
    'i'
  ),
  // "give me / tell me / i want (a) (blog) (about) ..."
  new RegExp(
    `^\\s*${GIVE_PHRASE}\\s+${ARTICLE}?\\s*${TYPE_WORD}?\\s*${PREP}?\\s+`,
    'i'
  ),
  // "(a) (blog) (about) ..."
  new RegExp(
    `^\\s*${ARTICLE}?\\s*${TYPE_WORD}\\s+${PREP}\\s+`,
    'i'
  ),
  // leading "about/on/regarding ..." (drop the preposition only)
  new RegExp(`^\\s*${PREP}\\s+`, 'i'),
  // leading article followed by at least one more word — strip it so the topic
  // phrase is clean (e.g. "a new product launch" -> "new product launch").
  // The lookahead requires at least one more word, so we never strip "a" alone.
  new RegExp(`^\\s*${ARTICLE}\\s+(?=\\S)`, 'i'),
];

const TRAILING_PUNCT = /[.!?]+\s*$/;
// Trailing politeness words that should be stripped from a topic phrase.
const TRAILING_WORDS = /\s+(please|thanks|thank\s+you|thx|kindly|now|today|asap|urgent)$/i;

export function extractTopic(prompt: string): string {
  let topic = (prompt || '').trim();
  if (!topic) return 'this topic';

  // Strip surrounding quotes
  topic = topic.replace(/^["'`]|["'`]$/g, '');

  // Aggressive word-by-word prefix stripping.
  // This handles misspellings, typos, and variations that regex patterns miss.
  const INSTRUCTION_WORDS = new Set([
    'kindly', 'please', 'can', 'could', 'you', 'hey', 'hi', 'hello',
    'i', 'want', 'need', 'would', 'like', 'am', 'looking', 'for',
    'write', 'create', 'generate', 'make', 'produce', 'draft', 'compose', 'build',
    'me', 'us', 'my', 'our',
    'a', 'an', 'the', 'teh', 'th', 'da', 'dis', 'dis',
    'blog', 'blogs', 'article', 'articles', 'post', 'posts', 'essay', 'essays',
    'guide', 'guides', 'content', 'piece', 'pieces', 'writeup', 'write-ups',
    'email', 'newsletter', 'social', 'media', 'tweet', 'caption',
    'about', 'on', 'regarding', 'covering', 'of', 'to', 'in', 'for',
    'give', 'tell', 'show', 'get',
    'now', 'today', 'asap', 'urgent',
  ]);

  // Split into words and strip leading instruction words
  const words = topic.toLowerCase().split(/\s+/);
  let startIndex = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^a-z]/g, '');
    if (INSTRUCTION_WORDS.has(w)) {
      startIndex = i + 1;
    } else {
      break;
    }
  }

  // If we stripped everything, fall back to just removing the first few words
  if (startIndex >= words.length) {
    startIndex = Math.min(3, Math.floor(words.length / 2));
  }

  // Reconstruct the topic from the remaining words, preserving original capitalization
  const originalWords = topic.split(/\s+/);
  topic = originalWords.slice(startIndex).join(' ').trim();

  // Also try the regex patterns as a secondary cleanup
  let previous = '';
  let safety = 0;
  while (previous !== topic && safety < 6) {
    previous = topic;
    for (const pattern of PREFIX_PATTERNS) {
      topic = topic.replace(pattern, '').trim();
    }
    safety += 1;
  }

  // Strip trailing punctuation and politeness words
  topic = topic.replace(TRAILING_WORDS, '').trim();
  topic = topic.replace(TRAILING_PUNCT, '').trim();
  topic = topic.replace(TRAILING_WORDS, '').trim();
  topic = topic.replace(TRAILING_PUNCT, '').trim();

  if (!topic) return 'this topic';
  return topic;
}

// ---------------------------------------------------------------------------
// Title generation
// ---------------------------------------------------------------------------

const TITLE_TEMPLATES: Record<ContentType, ((topic: string) => string)[]> = {
  blog: [
    (t) => `${capitalize(t)}: A Practical Guide`,
    (t) => `Understanding ${capitalize(t)}: What You Need to Know`,
    (t) => `${capitalize(t)} Explained: Tips, Tools, and Takeaways`,
    (t) => `A Beginner's Guide to ${capitalize(t)}`,
    (t) => `Mastering ${capitalize(t)}: A Step-by-Step Approach`,
  ],
  article: [
    (t) => `${capitalize(t)}: A Comprehensive Overview`,
    (t) => `The State of ${capitalize(t)}: Insights and Analysis`,
    (t) => `${capitalize(t)} in Practice: Lessons and Strategies`,
    (t) => `Inside ${capitalize(t)}: Principles, Pitfalls, and Pathways`,
  ],
  email: [
    (t) => `[Subject] ${capitalize(t)}: Ideas Worth Your Time`,
    (t) => `[Subject] A Quick Note on ${capitalize(t)}`,
    (t) => `[Subject] ${capitalize(t)}: Next Steps for You`,
  ],
  social: [
    (t) => `${capitalize(t)} — here's what matters 🚀`,
    (t) => `Thinking about ${capitalize(t)}? Read this 👇`,
    (t) => `${capitalize(t)} in 60 seconds ⏱️`,
  ],
  general: [
    (t) => `${capitalize(t)}: Everything You Should Know`,
    (t) => `A Clear Guide to ${capitalize(t)}`,
    (t) => `${capitalize(t)}: Principles, Practice, and Next Steps`,
  ],
};

function pickTitle(type: ContentType, topic: string): string {
  const templates = TITLE_TEMPLATES[type] || TITLE_TEMPLATES.general;
  const idx = topic.length % templates.length;
  return templates[idx](topic);
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeTone(tone: string): Tone {
  const t = (tone || '').toLowerCase().trim();
  if (t.startsWith('pro')) return 'professional';
  if (t.startsWith('cas')) return 'casual';
  if (t.startsWith('frien')) return 'friendly';
  if (t.startsWith('pers')) return 'persuasive';
  if (t.startsWith('hum')) return 'humorous';
  return 'professional';
}

function normalizeLength(length: string): Length {
  const l = (length || '').toLowerCase().trim();
  if (l.startsWith('short')) return 'short';
  if (l.startsWith('long')) return 'long';
  return 'medium';
}

function normalizeType(type: string | undefined): ContentType {
  const t = (type || 'general').toLowerCase().trim();
  if (t.startsWith('blog')) return 'blog';
  if (t.startsWith('article') || t.startsWith('art')) return 'article';
  if (t.startsWith('email') || t.startsWith('mail')) return 'email';
  if (t.startsWith('social') || t.startsWith('post') || t.startsWith('tweet')) return 'social';
  return 'general';
}

// ---------------------------------------------------------------------------
// Tone voices
// ---------------------------------------------------------------------------

interface ToneVoice {
  intro: (topic: string, length: Length) => string;
  conclusion: (topic: string, length: Length) => string;
  connector: string;
}

const TONE_VOICES: Record<Tone, ToneVoice> = {
  professional: {
    intro: (topic, length) =>
      length === 'short'
        ? `${capitalize(topic)} has become a critical focus for professionals and decision-makers. This guide covers the principles that matter most.`
        : `In recent years, ${topic} has emerged as a critical area of focus for professionals, practitioners, and decision-makers alike. This guide examines the core principles, practical applications, and proven strategies that define success in ${topic}, providing a structured framework you can apply immediately.`,
    conclusion: (topic, length) =>
      length === 'short'
        ? `${capitalize(topic)} rewards deliberate practice. Ground your work in these principles, measure consistently, and refine over time.`
        : `Ultimately, ${topic} rewards deliberate practice and continuous refinement. By grounding your approach in the principles outlined above and measuring your results consistently, you can build a sustainable, evidence-based practice that delivers measurable value over time.`,
    connector: 'Furthermore,',
  },
  casual: {
    intro: (topic, length) =>
      length === 'short'
        ? `Curious about ${topic}? Let's break it down in plain language — no jargon, just the stuff that matters.`
        : `So, you're curious about ${topic}? Good — it's one of those things that seems complicated until you see how it actually works. Let's break it down in plain language, no jargon, no fluff, just the stuff that matters when you're getting started.`,
    conclusion: (topic, length) =>
      length === 'short'
        ? `That's the gist of ${topic}. Pick one tip, try it today, and build from there.`
        : `And that's the gist of it. ${capitalize(topic)} isn't nearly as intimidating once you've got the basics down. Pick one tip from this guide, try it today, and build from there — you'll be surprised how quickly it clicks.`,
    connector: 'On top of that,',
  },
  friendly: {
    intro: (topic, length) =>
      length === 'short'
        ? `Hey! Wondering where to start with ${topic}? You're in the right place — let's walk through the essentials together.`
        : `Hey there! If you've been wondering where to start with ${topic}, you're in the right place. We'll walk through the essentials together, step by step, so you can build real confidence without feeling overwhelmed.`,
    conclusion: (topic, length) =>
      length === 'short'
        ? `Thanks for reading! Every expert started where you are now — you've got this.`
        : `Thanks for sticking with me through this guide to ${topic}. Take what resonates, leave what doesn't, and remember — every expert started exactly where you are right now. You've got this!`,
    connector: 'And hey,',
  },
  persuasive: {
    intro: (topic, length) =>
      length === 'short'
        ? `If you're not taking ${topic} seriously yet, now is the moment. Here's why it matters and what to do about it.`
        : `If you're not paying attention to ${topic} yet, now is the moment to start. The individuals and organizations that take ${topic} seriously today will be the ones who lead tomorrow — and those who hesitate will spend years catching up. Here's exactly why it matters and what you should do about it.`,
    conclusion: (topic, length) =>
      length === 'short'
        ? `The case for ${topic} is clear. Start now, measure relentlessly, and the results will follow.`
        : `The case for investing in ${topic} has never been clearer. The principles, tools, and strategies in this guide are not optional nice-to-haves — they are the levers that separate leaders from laggards. Start now, measure relentlessly, and the results will speak for themselves.`,
    connector: 'More importantly,',
  },
  humorous: {
    intro: (topic, length) =>
      length === 'short'
        ? `Ah, ${topic} — the topic everyone pretends to understand at dinner parties. Good news: by the end of this, you actually will.`
        : `Ah, ${topic} — the topic everyone pretends to understand at dinner parties while quietly hoping nobody asks a follow-up question. Good news: by the end of this guide, you'll actually know what you're talking about, and you can finally stop changing the subject.`,
    conclusion: (topic, length) =>
      length === 'short'
        ? `So there you have it — ${topic}, demystified. Next time it comes up at a party, you can smile knowingly.`
        : `So there you have it — ${topic}, demystified and (mostly) joke-free. Go forth, apply what you've learned, and the next time someone brings up ${topic} at a party, you can smile knowingly instead of pretending to refill your drink.`,
    connector: 'Best of all,',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function heading(text: string): string {
  return `\n\n## ${text}\n\n`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? capitalize(w) : w))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Section generators (length-aware)
// ---------------------------------------------------------------------------

const sectionWhatIs: SectionGenerator = ({ topic, tone, length }) => {
  const connector = TONE_VOICES[tone].connector;
  if (length === 'short') {
    return (
      heading(`What Is ${capitalize(topic)}?`) +
      `${connector} ${topic} is best understood as a deliberate approach to achieving specific outcomes in this area — combining strategy, execution, and continuous learning. Stakeholders include practitioners, decision-makers, and end users, each shaping the results.\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`What Is ${capitalize(topic)}?`) +
      `${connector} at its core, ${topic} is best understood as a deliberate approach to achieving specific outcomes within this domain, combining strategy, execution, and continuous learning. Think of it as a dynamic practice that spans planning, measurement, and refinement, where practitioners, decision-makers, and end users each play a role in shaping results.\n`
    );
  }
  return (
    heading(`What Is ${capitalize(topic)}?`) +
    `${connector} at its core, ${topic} refers to the set of ideas, practices, and outcomes that shape how people engage with this subject in real-world settings. Rather than a single definition, it helps to think of ${topic} as a dynamic combination of strategy, execution, and continuous learning. When you understand it through that lens, the moving parts start to make sense:\n\n` +
    `- **Definition:** ${capitalize(topic)} is best understood as a deliberate approach to achieving specific outcomes within this domain.\n` +
    `- **Scope:** It spans planning, execution, measurement, and refinement.\n` +
    `- **Stakeholders:** Practitioners, decision-makers, and end users all play a role in shaping results.\n`
  );
};

const sectionWhyMatters: SectionGenerator = ({ topic, tone, length }) => {
  const connector = TONE_VOICES[tone].connector;
  if (length === 'short') {
    return (
      heading(`Why ${capitalize(topic)} Matters`) +
      `Ignoring ${topic} is rarely a neutral choice. The cost of inaction compounds, while the benefits — productivity, reputation, resilience — show up across multiple areas. ${connector} small improvements here often unlock gains elsewhere.\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`Why ${capitalize(topic)} Matters`) +
      `Ignoring ${topic} is rarely a neutral choice. The cost of inaction compounds over time, while the benefits of engaging deliberately show up across productivity, reputation, financial outcomes, and long-term resilience. ${connector} the ripple effects are usually wider than people expect — a small improvement here often unlocks gains elsewhere.\n`
    );
  }
  return (
    heading(`Why ${capitalize(topic)} Matters`) +
    `Ignoring ${topic} is rarely a neutral choice. The cost of inaction tends to compound over time, while the benefits of engaging with it deliberately show up across multiple areas — productivity, reputation, financial outcomes, and long-term resilience. Organizations and individuals who treat ${topic} as a strategic priority consistently outperform those who treat it as an afterthought. ${connector} the ripple effects are usually wider than people expect: a small improvement here often unlocks gains elsewhere.\n`
  );
};

const sectionGettingStarted: SectionGenerator = ({ topic, length }) => {
  const base = heading(`Getting Started with ${capitalize(topic)}`);
  if (length === 'short') {
    return (
      base +
      `Start with a single, narrow goal, then expand as you build competence:\n\n` +
      `1. **Define one outcome** you want from ${topic} in the next 30 days.\n` +
      `2. **Pick one practice** and commit to it for two weeks.\n` +
      `3. **Track one or two metrics** and adjust weekly.\n`
    );
  }
  if (length === 'medium') {
    return (
      base +
      `Starting with ${topic} does not require a complete overhaul of what you already do. Begin with a clear, narrow goal, then expand as you build competence:\n\n` +
      `1. **Define one specific outcome** you want from ${topic} in the next 30 days.\n` +
      `2. **Audit your current state** — what you already do, what is missing, and what is working against you.\n` +
      `3. **Pick a single practice** to adopt first, and commit to it for at least two weeks before adding anything new.\n` +
      `4. **Track a small number of metrics** and review weekly.\n`
    );
  }
  return (
    base +
    `Starting with ${topic} does not require a complete overhaul of what you already do. The most reliable approach is to begin with a clear, narrow goal, then expand as you build competence. Here is a practical starting sequence:\n\n` +
    `1. **Define one specific outcome** you want from ${topic} in the next 30 days.\n` +
    `2. **Audit your current state** — what you already do, what you are missing, and what is actively working against you.\n` +
    `3. **Pick a single practice** to adopt first, and commit to it for at least two weeks before adding anything new.\n` +
    `4. **Track a small number of metrics** so you can tell whether the change is actually helping.\n` +
    `5. **Review and adjust weekly**, doubling down on what works and dropping what does not.\n`
  );
};

const sectionKeyPrinciples: SectionGenerator = ({ topic, length }) => {
  if (length === 'short') {
    return (
      heading(`Key Principles of ${capitalize(topic)}`) +
      `- **Clarity over complexity.**\n- **Consistency beats intensity.**\n- **Evidence over opinion.**\n- **Iterate in public.**\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`Key Principles of ${capitalize(topic)}`) +
      `Strong ${topic} practice rests on a handful of principles that hold up across contexts:\n\n` +
      `- **Clarity over complexity:** A simple, clearly defined approach almost always beats an elaborate one nobody understands.\n` +
      `- **Consistency beats intensity:** Small, repeatable actions compound. Sporadic bursts of effort do not.\n` +
      `- **Evidence over opinion:** Make decisions based on what actually moves your metrics.\n` +
      `- **Iterate in public:** Ship, learn, adjust. Waiting for perfection is the most expensive form of procrastination.\n`
    );
  }
  return (
    heading(`Key Principles of ${capitalize(topic)}`) +
    `Strong ${topic} practice rests on a handful of principles that hold up across contexts. Internalize these, and most tactical decisions become much easier:\n\n` +
    `- **Clarity over complexity:** A simple, clearly defined approach almost always beats an elaborate one nobody understands.\n` +
    `- **Consistency beats intensity:** Small, repeatable actions compound. Sporadic bursts of effort do not.\n` +
    `- **Evidence over opinion:** Make decisions based on what actually moves your metrics, not on what feels right.\n` +
    `- **Iterate in public:** Ship, learn, adjust. Waiting for perfection is the most expensive form of procrastination.\n` +
    `- **Context over best practice:** What worked for someone else may not work for you — adapt, do not copy.\n`
  );
};

const sectionCommonMistakes: SectionGenerator = ({ topic, tone, length }) => {
  const connector = TONE_VOICES[tone].connector;
  if (length === 'short') {
    return (
      heading(`Common Mistakes to Avoid`) +
      `- **Trying to do everything at once.**\n- **Copying without adapting.**\n- **Optimizing before learning.**\n- **Quitting too early.**\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`Common Mistakes to Avoid`) +
      `Most people who struggle with ${topic} are not failing because the topic is hard — they keep stepping on the same landmines:\n\n` +
      `- **Trying to do everything at once.** Spread too thin, nothing gets done well.\n` +
      `- **Copying without adapting.** What works for someone else may not fit your context.\n` +
      `- **Optimizing before learning.** Tweaking details before you understand the basics wastes time.\n` +
      `- **Ignoring the data.** ${connector} if you are not measuring, you are guessing.\n` +
      `- **Quitting too early.** Most gains in ${topic} show up after the boring middle phase.\n`
    );
  }
  return (
    heading(`Common Mistakes to Avoid`) +
    `Most people who struggle with ${topic} are not failing because the topic is hard — they are failing because they keep stepping on the same landmines. Here are the ones worth watching for:\n\n` +
    `- **Trying to do everything at once.** Spread too thin, nothing gets done well.\n` +
    `- **Copying without adapting.** What works for someone else may not fit your context.\n` +
    `- **Optimizing before learning.** Tweaking details before you understand the basics wastes time.\n` +
    `- **Ignoring the data.** Feelings are not feedback. ${connector} if you are not measuring, you are guessing.\n` +
    `- **Quitting too early.** Most gains in ${topic} show up after the boring middle phase, not before it.\n` +
    `- **Chasing novelty over fundamentals.** New tools rarely fix a shaky foundation.\n`
  );
};

const sectionTools: SectionGenerator = ({ topic, length }) => {
  if (length === 'short') {
    return (
      heading(`Tools and Resources for ${capitalize(topic)}`) +
      `Start with one tool per category: planning (a simple doc), reference (a book or reputable newsletter), community (a forum or group), and measurement (a basic dashboard). Adding more before you have a workflow is procrastination dressed up as productivity.\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`Tools and Resources for ${capitalize(topic)}`) +
      `You do not need an expensive stack, but the right tools remove friction. Consider:\n\n` +
      `- **Planning tools:** Documents, spreadsheets, or project apps to capture goals and track progress.\n` +
      `- **Reference material:** Books and reputable newsletters that go deeper than surface-level content.\n` +
      `- **Communities:** Forums or groups where practitioners share what is working now.\n` +
      `- **Measurement tools:** Dashboards that turn raw activity into a few useful signals.\n\n` +
      `Start with one tool per category. Adding more before you have a workflow is just procrastination dressed up as productivity.\n`
    );
  }
  return (
    heading(`Tools and Resources for ${capitalize(topic)}`) +
    `You do not need an expensive stack to make progress with ${topic}, but the right tools do remove friction. Consider these categories as you build your setup:\n\n` +
    `- **Planning tools:** Simple documents, spreadsheets, or project management apps to capture goals and track progress.\n` +
    `- **Reference material:** Books, long-form articles, and reputable newsletters that go deeper than surface-level content.\n` +
    `- **Communities:** Forums, Slack or Discord groups, and local meetups where practitioners share what is working right now.\n` +
    `- **Measurement tools:** Dashboards or reports that turn raw activity into a small number of useful signals.\n\n` +
    `Start with one tool per category. Adding more before you have a workflow is just procrastination dressed up as productivity.\n`
  );
};

const sectionPracticalExample: SectionGenerator = ({ topic, tone, length }) => {
  const connector = TONE_VOICES[tone].connector;
  if (length === 'short') {
    return (
      heading(`A Practical Example`) +
      `Picture a small team taking ${topic} seriously for one quarter. They pick one metric to improve by 15%, commit to a two-week sprint, review the numbers, and run the next sprint. ${connector} nothing here is glamorous — and that is exactly the point.\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`A Practical Example`) +
      `Imagine a small team that decides to take ${topic} seriously for one quarter. They start by agreeing on a single outcome — improving one core metric by 15% — then audit their current approach, identify two high-impact changes, and commit to a two-week sprint. At the end of the sprint, they review the numbers, keep what worked, and run the next sprint. ${connector} nothing here is glamorous, which is exactly the point: consistent, small, evidence-driven moves are what produce real results in ${topic}.\n`
    );
  }
  return (
    heading(`A Practical Example`) +
    `Imagine a small team that decides to take ${topic} seriously for one quarter. They start by agreeing on a single outcome — say, improving one core metric by 15%. They audit their current approach, identify two high-impact changes, and commit to a two-week sprint. At the end of the sprint, they review the numbers, keep what worked, and run the next sprint.\n\n` +
    `After a month, the metric has moved. More importantly, the team has built a repeatable rhythm: pick one outcome, ship one change, measure, repeat. ${connector} nothing here is glamorous, which is exactly the point — consistent, small, evidence-driven moves are what produce real results in ${topic}.\n`
  );
};

const sectionMeasuringSuccess: SectionGenerator = ({ topic, length }) => {
  if (length === 'short') {
    return (
      heading(`Measuring Success`) +
      `Pick two or three metrics that genuinely reflect your goal, move within a reasonable timeframe, and are hard to game. Review them on a fixed cadence — weekly for fast-moving work, monthly for longer initiatives — and treat every review as a decision point, not a report.\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`Measuring Success`) +
      `If you cannot tell whether ${topic} is working, you cannot improve it. Pick two or three metrics that genuinely reflect your goal — not vanity numbers that look good but tell you nothing. Good metrics are tied to outcomes you care about, move within a reasonable timeframe, and are hard to game. Review them weekly for fast-moving work or monthly for longer initiatives, and treat every review as a decision point, not a report.\n`
    );
  }
  return (
    heading(`Measuring Success`) +
    `If you cannot tell whether ${topic} is working, you cannot improve it. Pick two or three metrics that genuinely reflect your goal — not vanity numbers that look good but tell you nothing. Good metrics for ${topic} tend to share a few traits:\n\n` +
    `- **They are tied to an outcome you actually care about.**\n` +
    `- **They move within a reasonable timeframe**, so you get feedback before you lose interest.\n` +
    `- **They are hard to game.** If a metric is easy to manipulate, it will be.\n\n` +
    `Review your metrics on a fixed cadence — weekly for fast-moving work, monthly for longer initiatives — and treat every review as a decision point, not a report.\n`
  );
};

const sectionAdvanced: SectionGenerator = ({ topic, tone, length }) => {
  const connector = TONE_VOICES[tone].connector;
  if (length === 'short') {
    return (
      heading(`Advanced Strategies`) +
      `Once the fundamentals run smoothly: systematize wins into repeatable processes, automate the boring parts, and stress-test your assumptions with cheap experiments. ${connector} some of the best ideas in ${topic} come from adjacent fields.\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`Advanced Strategies`) +
      `Once the fundamentals of ${topic} are running smoothly, a few advanced moves tend to unlock disproportionate gains:\n\n` +
      `- **Systematize what works.** Turn repeatable wins into documented processes.\n` +
      `- **Automate the boring parts.** Free up attention for the work that requires judgment.\n` +
      `- **Stress-test assumptions.** Run small, cheap experiments to challenge what you think you know.\n` +
      `- **Borrow from adjacent fields.** ${connector} some of the best ideas in ${topic} come from disciplines that have nothing to do with it on the surface.\n`
    );
  }
  return (
    heading(`Advanced Strategies`) +
    `Once the fundamentals of ${topic} are running smoothly, a few advanced moves tend to unlock disproportionate gains:\n\n` +
    `- **Systematize what works.** Turn repeatable wins into documented processes so they survive team changes and busy weeks.\n` +
    `- **Automate the boring parts.** Free up attention for the work that actually requires judgment.\n` +
    `- **Stress-test your assumptions.** Run small, cheap experiments to challenge what you think you know about ${topic}.\n` +
    `- **Borrow from adjacent fields.** ${connector} some of the best ideas in ${topic} come from disciplines that have nothing to do with it on the surface.\n` +
    `- **Invest in compounding assets.** Templates, playbooks, and reusable research pay off for years.\n`
  );
};

const sectionWhatNext: SectionGenerator = ({ topic, tone, length }) => {
  const connector = TONE_VOICES[tone].connector;
  if (length === 'short') {
    return (
      heading(`What to Do Next`) +
      `Reading about ${topic} is not the same as practicing it. Pick the smallest thing from this guide that still matters, and do it today. ${connector} momentum comes from action, not from more information.\n`
    );
  }
  if (length === 'medium') {
    return (
      heading(`What to Do Next`) +
      `Reading about ${topic} is not the same as practicing it. Pick one thing from this guide — ideally the smallest thing that still matters — and do it today, then pick the next one. ${connector} momentum in ${topic} comes from action, not from accumulating more information.\n`
    );
  }
  return (
    heading(`What to Do Next`) +
    `Reading about ${topic} is not the same as practicing it. Pick one thing from this guide — ideally the smallest thing that still matters — and do it today. Then pick the next one. Momentum in ${topic} comes from action, not from accumulating more information, and the people who get results are almost always the ones who start before they feel ready.\n`
  );
};

const SECTION_GENERATORS: Record<string, SectionGenerator> = {
  whatIs: sectionWhatIs,
  whyMatters: sectionWhyMatters,
  gettingStarted: sectionGettingStarted,
  keyPrinciples: sectionKeyPrinciples,
  commonMistakes: sectionCommonMistakes,
  tools: sectionTools,
  practicalExample: sectionPracticalExample,
  measuringSuccess: sectionMeasuringSuccess,
  advanced: sectionAdvanced,
  whatNext: sectionWhatNext,
};

// Section selection per length — keeps content focused and within target word counts.
const LENGTH_SECTIONS: Record<Length, string[]> = {
  short: ['whatIs', 'whyMatters', 'whatNext'],
  medium: ['whatIs', 'whyMatters', 'gettingStarted', 'commonMistakes', 'whatNext'],
  long: [
    'whatIs',
    'whyMatters',
    'gettingStarted',
    'keyPrinciples',
    'commonMistakes',
    'tools',
    'practicalExample',
    'measuringSuccess',
    'advanced',
    'whatNext',
  ],
};

// ---------------------------------------------------------------------------
// Type-specific writers
// ---------------------------------------------------------------------------

function buildBlogArticle(ctx: SectionContext): string {
  const sections = LENGTH_SECTIONS[ctx.length];
  const voice = TONE_VOICES[ctx.tone];

  const parts: string[] = [];
  parts.push(`# ${ctx.title}`);
  parts.push('');
  parts.push(voice.intro(ctx.topic, ctx.length));

  for (const key of sections) {
    const gen = SECTION_GENERATORS[key];
    if (gen) parts.push(gen(ctx));
  }

  parts.push(heading('Conclusion'));
  parts.push(voice.conclusion(ctx.topic, ctx.length));

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function buildEmail(ctx: SectionContext): string {
  const voice = TONE_VOICES[ctx.tone];
  const intro = voice.intro(ctx.topic, ctx.length);
  const conclusion = voice.conclusion(ctx.topic, ctx.length);

  const body = LENGTH_SECTIONS[ctx.length]
    .slice(1, -1) // drop the opening "whatIs" and closing "whatNext" sections
    .map((key) => {
      const gen = SECTION_GENERATORS[key];
      return gen ? gen(ctx) : '';
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const parts: string[] = [];
  parts.push(`# ${ctx.title}`);
  parts.push('');
  parts.push(`Hi there,`);
  parts.push('');
  parts.push(intro);
  parts.push('');
  parts.push(body);
  parts.push('');
  parts.push(conclusion);
  parts.push('');
  parts.push(`Best regards,`);
  parts.push(`The ${titleCase(ctx.topic)} Team`);
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function buildSocial(ctx: SectionContext): string {
  const voice = TONE_VOICES[ctx.tone];
  const topic = ctx.topic;
  const intro = voice.intro(topic, ctx.length);

  const bullets = [
    `• Start with one clear goal — clarity beats complexity.`,
    `• Track 2-3 metrics that actually reflect your outcome.`,
    `• Review weekly, double down on what works.`,
    `• Consistency compounds — small moves beat big bursts.`,
  ];

  const bulletCount = ctx.length === 'short' ? 2 : ctx.length === 'medium' ? 3 : 4;

  const lines: string[] = [];
  lines.push(`${ctx.title}`);
  lines.push('');
  lines.push(intro);
  lines.push('');
  for (const b of bullets.slice(0, bulletCount)) {
    lines.push(b);
  }
  lines.push('');
  lines.push(voice.conclusion(topic, ctx.length).split('. ')[0] + '.');
  lines.push('');
  const hashtag = topic.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 24) || 'content';
  lines.push(`#${hashtag} #growth #strategy`);
  return lines.join('\n').trim() + '\n';
}

function buildGeneral(ctx: SectionContext): string {
  // Treat "general" like a polished article.
  return buildBlogArticle(ctx);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function generateLocalContent(params: LocalContentParams): string {
  const topic = extractTopic(params.prompt);
  const tone = normalizeTone(params.tone);
  const length = normalizeLength(params.length);
  const type = normalizeType(params.type as string | undefined);
  const title = pickTitle(type, topic);

  const ctx: SectionContext = { topic, title, tone, length, type };

  switch (type) {
    case 'email':
      return buildEmail(ctx);
    case 'social':
      return buildSocial(ctx);
    case 'blog':
    case 'article':
      return buildBlogArticle(ctx);
    case 'general':
    default:
      return buildGeneral(ctx);
  }
}

// ---------------------------------------------------------------------------
// Keyword generation
// ---------------------------------------------------------------------------

// Minimal stopword list used when tokenising the TOPIC. We intentionally keep
// this small so that meaningful words like "work" (in "remote work") are NOT
// stripped from the topic phrase. The bigger STOPWORDS set below is used only
// for generic content n-gram analysis.
const TOPIC_STOPWORDS = new Set<string>([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'about', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'they',
  'them', 'their', 'what', 'which', 'who', 'whom', 'how', 'why', 'where',
  'would', 'could', 'should', 'can', 'will', 'shall', 'may', 'might', 'must',
]);

const STOPWORDS = new Set<string>([
  // All TOPIC_STOPWORDS are also generic stopwords.
  ...TOPIC_STOPWORDS,
  // Additional generic words we do not want as standalone keywords.
  'if', 'then', 'else', 'when', 'from', 'up', 'down', 'out', 'off', 'over',
  'under', 'again', 'further', 'once', 'here', 'there', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now', 'also',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'against', 'around', 'along', 'across', 'onto', 'because',
  // Generic content/structure words that make poor keywords on their own.
  'come', 'get', 'go', 'know', 'make', 'need', 'one', 'two', 'three',
  'use', 'using', 'used', 'want', 'way', 'well', 'work', 'works', 'working',
  'even', 'ever', 'still', 'first', 'second', 'third', 'next', 'last',
  'new', 'old', 'good', 'great', 'best', 'better', 'less',
  'right', 'left', 'high', 'low', 'big', 'small', 'top', 'bottom',
  'thing', 'things', 'stuff', 'part', 'parts', 'side', 'sides',
  'help', 'helps', 'helping', 'try', 'trying', 'start', 'starts', 'started',
  'guide', 'read', 'reading', 'tips', 'tip', 'idea', 'ideas', 'example',
  'examples', 'today', 'tomorrow', 'yesterday', 'week', 'month', 'year',
  'day', 'days', 'time', 'times', 'people', 'person', 'team', 'teams',
  'approach', 'approaches', 'result', 'results', 'metric', 'metrics',
  'data', 'measure', 'measuring', 'measured',
  'practice', 'practices', 'practitioners', 'decision', 'decisions',
  'action', 'actions', 'change', 'changes', 'changed', 'changing',
  'case', 'cases', 'point', 'points', 'hey', 'hi', 'hello',
  'content', 'topic', 'subject', 'area', 'areas', 'domain', 'domains',
  'rule', 'rules', 'requirement', 'requirements',
  'improvement', 'improvements', 'improve', 'improved', 'improving',
  'success', 'successful', 'succeed', 'achieve', 'achieves', 'achieving',
  'matter', 'matters', 'mattering', 'ignore', 'ignoring', 'ignored',
  'really', 'actually', 'simply', 'basically', 'literally',
  'everyone', 'someone', 'anyone', 'nobody', 'everybody',
  'tools', 'tool', 'resource', 'resources', 'material', 'materials',
  'community', 'communities', 'group', 'groups', 'forum', 'forums',
  'newsletter', 'newsletters', 'book', 'books', 'article', 'articles',
  'blog', 'blogs', 'post', 'posts', 'email', 'emails',
]);

function tokenizeTopic(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9'-]{1,}/g) || []).filter(
    (w) => w.length > 1 && !TOPIC_STOPWORDS.has(w)
  );
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9'-]{1,}/g) || []).filter(
    (w) => w.length > 2 && !STOPWORDS.has(w)
  );
}

function extractNgramsWithFreq(tokens: string[], maxN: number): Map<string, number> {
  const freq = new Map<string, number>();
  for (let n = 1; n <= maxN; n += 1) {
    for (let i = 0; i <= tokens.length - n; i += 1) {
      const slice = tokens.slice(i, i + n);
      if (slice.every((w) => STOPWORDS.has(w))) continue;
      const phrase = slice.join(' ');
      freq.set(phrase, (freq.get(phrase) || 0) + 1);
    }
  }
  return freq;
}

export function generateLocalKeywords(prompt: string, content: string): string[] {
  const topic = extractTopic(prompt || content);
  const topicLower = topic.toLowerCase().trim();

  // Use the topic-preserving tokenizer so multi-word topics like
  // "remote work" survive intact (the generic STOPWORDS list strips "work").
  const topicTokens = tokenizeTopic(topic);

  // Build canonical topic phrase from the surviving topic tokens. This is the
  // highest-priority keyword and is always included verbatim.
  const canonicalTopic = topicTokens.length > 0 ? topicTokens.join(' ') : topicLower;

  // --- Phase 1: Topic-derived keywords (deterministic, always relevant) ----
  const result: string[] = [];
  const seen = new Set<string>();
  const addUnique = (phrase: string) => {
    if (!phrase) return;
    const lower = phrase.toLowerCase();
    if (seen.has(lower)) return;
    // Reject phrases with duplicate consecutive words (e.g. "productivity tips tips").
    const words = lower.split(/\s+/);
    for (let i = 1; i < words.length; i += 1) {
      if (words[i] === words[i - 1]) return;
    }
    seen.add(lower);
    result.push(phrase);
  };

  addUnique(canonicalTopic);

  // Topic + common SEO suffixes — guaranteed on-topic keyword variations.
  // Skip suffixes that duplicate the final word of the topic (e.g. don't
  // produce "productivity tips tips" when the topic already ends in "tips").
  const topicSuffixes = [
    'guide',
    'tips',
    'strategies',
    'best practices',
    'for beginners',
    'benefits',
    'examples',
    'tools',
  ];
  const lastTopicWord = topicTokens[topicTokens.length - 1] || '';
  for (const suffix of topicSuffixes) {
    if (result.length >= 6) break;
    const suffixFirstWord = suffix.split(' ')[0];
    if (lastTopicWord && suffixFirstWord === lastTopicWord) continue;
    addUnique(`${canonicalTopic} ${suffix}`);
  }

  // --- Phase 2: Content-derived phrases that contain a topic word ----------
  // Only consider phrases that contain at least one topic word, to guarantee
  // relevance to the user's prompt.
  const topicWordSet = new Set(topicTokens);
  const contentTokens = tokenize(content || '');
  const candidatePhrases = new Map<string, number>();

  for (let n = 2; n <= 3; n += 1) {
    for (let i = 0; i <= contentTokens.length - n; i += 1) {
      const slice = contentTokens.slice(i, i + n);
      // Must contain at least one topic word.
      if (!slice.some((w) => topicWordSet.has(w))) continue;
      // Reject if any word in the slice is a generic stopword (we want clean
      // noun phrases, not "the X" or "and Y").
      if (slice.some((w) => TOPIC_STOPWORDS.has(w))) continue;
      const phrase = slice.join(' ');
      candidatePhrases.set(phrase, (candidatePhrases.get(phrase) || 0) + 1);
    }
  }

  // Sort content-derived candidates by frequency, then by length (prefer
  // longer, more specific phrases on ties).
  const sortedContentPhrases = Array.from(candidatePhrases.entries())
    .map(([phrase, count]) => ({
      phrase,
      count,
      words: phrase.split(' ').length,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.words - a.words;
    });

  for (const { phrase } of sortedContentPhrases) {
    if (result.length >= 7) break;
    // Skip if this candidate is a substring of an already-added phrase, or
    // vice versa — keeps the keyword set diverse.
    const lower = phrase.toLowerCase();
    let redundant = false;
    for (const s of seen) {
      if (s === lower) {
        redundant = true;
        break;
      }
      if (s.length > lower.length && s.includes(lower)) {
        redundant = true;
        break;
      }
      if (lower.length > s.length && lower.includes(s)) {
        redundant = true;
        break;
      }
    }
    if (redundant) continue;
    addUnique(phrase);
  }

  // --- Phase 3: Fallback to guarantee at least 5 keywords ------------------
  const fallback = [
    canonicalTopic,
    `${canonicalTopic} guide`,
    `${canonicalTopic} tips`,
    `${canonicalTopic} strategies`,
    `${canonicalTopic} best practices`,
    'content strategy',
    'audience engagement',
  ];
  for (const f of fallback) {
    if (result.length >= 7) break;
    addUnique(f);
  }

  return result.slice(0, 8);
}

export default generateLocalContent;
