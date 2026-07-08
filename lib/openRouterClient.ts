/**
 * OpenRouter Client
 * -----------------
 * Connects to OpenRouter's API (https://openrouter.ai) which provides access
 * to many AI models including free tiers of Llama, Gemma, Nemotron, etc.
 *
 * This is used as the primary AI provider because Groq is blocked from this
 * server's region (Cloudflare 403). OpenRouter is accessible and has free models.
 */
import axios from 'axios';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Free models on OpenRouter, ordered by SPEED (fastest first)
// We prioritize speed over quality for a better UX
export const FREE_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',          // 30B — fast and reliable
  'google/gemma-4-26b-a4b-it:free',                // 26B — good balance
  'meta-llama/llama-3.2-3b-instruct:free',         // 3B — very fast
  'liquid/lfm-2.5-1.2b-instruct:free',             // 1.2B — fastest
  'nvidia/nemotron-3-super-120b-a12b:free',         // 120B — slower but higher quality
  'google/gemma-4-31b-it:free',                     // 31B — good quality
  'nvidia/nemotron-3-ultra-550b-a55b:free',         // 550B — best but slowest
  'meta-llama/llama-3.3-70b-instruct:free',         // Llama 3.3 70B
];

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Call OpenRouter's chat completion API.
 * Tries multiple free models until one succeeds.
 */
export async function openRouterChatCompletion(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured. Set it in your .env file.');
  }

  const {
    temperature = 0.7,
    maxTokens = 2000,
  } = options;

  let lastError: any = null;

  // Try at most 3 models to avoid long waits
  const modelsToTry = (options.model ? [options.model] : FREE_MODELS).slice(0, 3);

  for (const model of modelsToTry) {
    try {
      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-content.app',
            'X-Title': 'AI Content Writer',
          },
          timeout: 30000, // 30 seconds per model (was 60s)
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return content.trim();
      }
    } catch (err: any) {
      lastError = err;
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error?.message || '';

      // 429 = rate limited, try next model
      // 404 = model not found, try next model
      // 500+ = server error, try next model
      if (status === 429 || status === 404 || (status && status >= 500)) {
        continue;
      }

      // 400 = bad request, don't try other models
      if (status === 400) {
        throw new Error(`OpenRouter API error: ${errorMsg}`);
      }

      // Network error, try next model
      continue;
    }
  }

  // All models failed
  if (lastError) {
    throw new Error(`All OpenRouter models failed. Last error: ${lastError.response?.data?.error?.message || lastError.message}`);
  }
  throw new Error('OpenRouter returned no content from any model.');
}

/**
 * Generate content using OpenRouter.
 * Falls back to the local generator if OpenRouter fails.
 */
export async function generateContentWithOpenRouter(params: {
  prompt: string;
  tone: string;
  length: string;
  language: string;
  type?: string;
}): Promise<string> {
  const { prompt, tone, length, language, type = 'general' } = params;

  const lengthMap: Record<string, string> = {
    short: '150-250 words',
    medium: '400-600 words',
    long: '800-1200 words',
  };

  const typeInstructions: Record<string, string> = {
    blog: `Write a complete, valuable blog post. Include:
- An engaging title as H1 (using #)
- Introduction that hooks the reader
- 3-5 main sections with H2 subheadings (using ##)
- Bullet points or numbered lists where appropriate
- Practical tips or actionable advice
- A conclusion that summarizes key points
- Use markdown formatting`,
    article: `Write a well-researched article. Include:
- A compelling title as H1
- Introduction stating the problem
- Multiple sections with H2 subheadings
- Data-backed insights and practical examples
- A strong conclusion`,
    email: `Write a professional email with:
- Subject line in brackets [Subject: ...]
- Professional greeting
- Clear value proposition
- Specific call to action
- Professional signature`,
    social: `Write engaging social media content with:
- Hook in first sentence
- Relevant hashtags
- Clear call to action`,
    general: `Write high-quality content with:
- A clear title as H1
- Proper structure with headings
- Specific, actionable information
- Markdown formatting`,
  };

  const systemPrompt = `You are a professional content writer. Write DIRECTLY about the topic given.

CRITICAL RULES:
1. NEVER write about "writing content" — just write the actual content
2. NEVER say "Here is a blog post about X" — just start with the content
3. Write AS IF you are an expert sharing knowledge directly
4. The content should be ready to publish immediately
5. Use markdown formatting (headings, lists, bold text)
6. Be specific, not generic — use real examples and actionable advice
7. Write in ${language}
8. Tone: ${tone}
9. Target length: ${lengthMap[length] || '400-600 words'}

CONTENT TYPE: ${typeInstructions[type] || typeInstructions.general}

Remember: Write the ACTUAL content, not instructions about content.`;

  const userPrompt = `Topic: ${prompt}

Write a ${tone} ${type} about this topic. Make it valuable, specific, and actionable. Write in ${language}.`;

  return openRouterChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.8,
      maxTokens: length === 'short' ? 800 : length === 'medium' ? 1500 : 3000,
    }
  );
}

/**
 * Generate SEO keywords using OpenRouter.
 */
export async function generateSEOKeywordsWithOpenRouter(content: string, prompt?: string): Promise<string[]> {
  const systemPrompt = `You are an SEO expert. Extract 5-7 relevant SEO keywords from the given content.
Return ONLY a JSON array of strings, no explanations.
Example: ["keyword 1", "keyword 2", "keyword 3"]`;

  const userPrompt = `Extract SEO keywords from this content:\n\n${content.substring(0, 2000)}`;

  try {
    const result = await openRouterChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 200 }
    );

    const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const keywords = JSON.parse(cleanResult);

    if (Array.isArray(keywords)) return keywords.slice(0, 7);
    if (keywords.keywords && Array.isArray(keywords.keywords)) return keywords.keywords.slice(0, 7);
    throw new Error('Invalid response format');
  } catch (err) {
    throw new Error('Failed to generate SEO keywords via OpenRouter');
  }
}

/**
 * Check grammar using OpenRouter.
 */
export async function checkGrammarWithOpenRouter(content: string): Promise<string[]> {
  const systemPrompt = `You are a grammar expert. Check the following content for grammar issues.
Return ONLY a JSON object with an "issues" array.
Example: {"issues": ["Missing comma after introductory phrase"]}
If no issues found, return {"issues": []}`;

  try {
    const result = await openRouterChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content.substring(0, 3000) },
      ],
      { temperature: 0.2, maxTokens: 300 }
    );

    const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResult);
    return parsed.issues || [];
  } catch (err) {
    return [];
  }
}
