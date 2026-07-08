/**
 * AI Provider with Retry/Backoff/Fallback System
 * -----------------------------------------------
 * Priority chain:
 *   1. OpenRouter (primary — works from this server)
 *   2. Groq (secondary — region-blocked from this server, may work from other deployments)
 *   3. Gemini (tertiary — quota may be 0 from this region)
 *   4. Local generator (final fallback — always works)
 *
 * Error handling:
 *   401 = key wrong → skip provider
 *   403 = region/permission → skip provider
 *   404 = wrong model → try next model
 *   429 = rate limit → wait + retry with backoff
 *   500+ = server error → try next model
 */
import axios from 'axios';
import { generateLocalContent, generateLocalKeywords } from './localContentGenerator';

// ---------- Configuration ----------

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

// Models ordered by speed — only tested working models
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',      // ~4-7s, 30B — fastest, good quality
  'openai/gpt-oss-20b:free',                   // ~11s, 20B — good quality fallback
  'tencent/hy3:free',                          // ~6s, fast — lightweight fallback
];

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'llama3-8b-8192',
];

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

// ---------- Types ----------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
}

// ---------- Retry/Backoff ----------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  const base = Math.min(2000 * Math.pow(2, attempt), 10000);
  const jitter = Math.random() * 1000;
  return base + jitter;
}

// ---------- Provider: OpenRouter ----------

async function callOpenRouter(messages: ChatMessage[], options: AIOptions = {}): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key not configured');

  const { temperature = 0.7, maxTokens = 2000 } = options;
  const maxRetries = 2;

  for (const model of OPENROUTER_MODELS.slice(0, 3)) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const response = await axios.post(OPENROUTER_API_URL,
          { model, messages, temperature, max_tokens: maxTokens },
          { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ai-content.app', 'X-Title': 'AI Content Writer' }, timeout: 30000 }
        );
        const content = response.data?.choices?.[0]?.message?.content;
        if (content && content.trim()) {
          console.log(`[AI] OpenRouter success: model=${model}, chars=${content.length}`);
          return content.trim();
        }
        break;
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 429) { attempt++; if (attempt <= maxRetries) { await sleep(backoffDelay(attempt)); continue; } break; }
        if (status === 401 || status === 403) throw new Error(`OpenRouter blocked: ${status}`);
        break;
      }
    }
  }
  throw new Error('All OpenRouter models failed');
}

// ---------- Provider: Groq ----------

async function callGroq(messages: ChatMessage[], options: AIOptions = {}): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('Groq API key not configured');

  const { temperature = 0.7, maxTokens = 2000 } = options;
  const maxRetries = 2;

  for (const model of GROQ_MODELS) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const response = await axios.post(GROQ_API_URL,
          { model, messages, temperature, max_tokens: maxTokens },
          { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        const content = response.data?.choices?.[0]?.message?.content;
        if (content && content.trim()) {
          console.log(`[AI] Groq success: model=${model}, chars=${content.length}`);
          return content.trim();
        }
        break;
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 429) { attempt++; if (attempt <= maxRetries) { await sleep(backoffDelay(attempt)); continue; } break; }
        if (status === 401) throw new Error('Groq key invalid');
        if (status === 403) throw new Error('Groq region blocked');
        break;
      }
    }
  }
  throw new Error('All Groq models failed');
}

// ---------- Provider: Gemini ----------

async function callGemini(messages: ChatMessage[], options: AIOptions = {}): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');

  const { temperature = 0.7, maxTokens = 2000 } = options;
  const maxRetries = 2;

  // Convert OpenAI-style messages to Gemini format
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');

  for (const model of GEMINI_MODELS) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const body: any = {
          contents: userMsgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        };
        if (systemMsg) {
          body.systemInstruction = { parts: [{ text: systemMsg.content }] };
        }

        const response = await axios.post(url, body, { timeout: 30000, headers: { 'Content-Type': 'application/json' } });
        const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content && content.trim()) {
          console.log(`[AI] Gemini success: model=${model}, chars=${content.length}`);
          return content.trim();
        }
        break;
      } catch (err: any) {
        const status = err.response?.status;
        const errorData = err.response?.data;
        // Gemini 429 = RESOURCE_EXHAUSTED (quota)
        if (status === 429) {
          attempt++;
          if (attempt <= maxRetries) {
            // Gemini tells us retryDelay — respect it
            const retryDelay = errorData?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
            let delayMs = backoffDelay(attempt);
            if (retryDelay) {
              const parsed = parseFloat(retryDelay);
              if (!isNaN(parsed) && parsed > 0) delayMs = parsed * 1000;
            }
            console.log(`[AI] Gemini 429 (quota), retry ${attempt}/${maxRetries} in ${Math.round(delayMs)}ms`);
            await sleep(delayMs);
            continue;
          }
          // Quota exhausted — try next model
          console.log(`[AI] Gemini quota exhausted for ${model}, trying next`);
          break;
        }
        // 400 = "User location is not supported" or invalid request
        if (status === 400) {
          const msg = errorData?.error?.message || '';
          if (msg.includes('location is not supported')) {
            console.log(`[AI] Gemini region not supported for ${model}`);
            break;
          }
        }
        if (status === 401 || status === 403) throw new Error(`Gemini blocked: ${status}`);
        break;
      }
    }
  }
  throw new Error('All Gemini models failed');
}

// ---------- Main Entry Points ----------

export async function generateAIContent(params: {
  prompt: string; tone: string; length: string; language: string; type?: string;
}): Promise<{ content: string; provider: string }> {
  const { prompt, tone, length, language, type = 'general' } = params;

  const lengthMap: Record<string, string> = {
    short: '150-250 words', medium: '400-600 words', long: '800-1200 words',
  };

  const systemPrompt = `You are a professional content writer. Write DIRECTLY about the topic.

CRITICAL RULES:
1. NEVER write about "writing content" — just write the actual content
2. NEVER say "Here is a blog post about X" — just start with the content
3. Write AS IF you are an expert sharing knowledge directly
4. Use markdown formatting (headings, lists, bold text)
5. Be specific, not generic — use real examples and actionable advice
6. Write in ${language}
7. Tone: ${tone}
8. Target length: ${lengthMap[length] || '400-600 words'}

CONTENT TYPE: ${type}
Write the ACTUAL content, not instructions about content.`;

  const userPrompt = `Topic: ${prompt}\n\nWrite a ${tone} ${type} about this topic. Make it valuable, specific, and actionable.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const maxTokens = length === 'short' ? 800 : length === 'medium' ? 1500 : 3000;

  // Clean meta-commentary helper
  const cleanMeta = (text: string) => {
    let cleaned = text.trim();
    for (const phrase of [/^Here is a .*?:\s*/i, /^I've written a .*?:\s*/i, /^Here's your .*?:\s*/i, /^Below is .*?:\s*/i, /^As requested,.*?:\s*/i, /^Sure!?[:,]?\s*/i, /^Okay[,!]?\s*/i]) {
      cleaned = cleaned.replace(phrase, '');
    }
    return cleaned;
  };

  // 1. Try OpenRouter
  try {
    console.log('[AI] Trying OpenRouter...');
    const content = await callOpenRouter(messages, { temperature: 0.8, maxTokens });
    return { content: cleanMeta(content), provider: 'openrouter' };
  } catch (err: any) { console.log('[AI] OpenRouter failed:', err.message); }

  // 2. Try Groq
  try {
    console.log('[AI] Trying Groq...');
    const content = await callGroq(messages, { temperature: 0.8, maxTokens });
    return { content: cleanMeta(content), provider: 'groq' };
  } catch (err: any) { console.log('[AI] Groq failed:', err.message); }

  // 3. Try Gemini
  try {
    console.log('[AI] Trying Gemini...');
    const content = await callGemini(messages, { temperature: 0.8, maxTokens });
    return { content: cleanMeta(content), provider: 'gemini' };
  } catch (err: any) { console.log('[AI] Gemini failed:', err.message); }

  // 4. Final fallback
  console.log('[AI] Using local content generator');
  return { content: generateLocalContent({ prompt, tone, length, language, type }), provider: 'local' };
}

export async function generateAIKeywords(content: string, prompt?: string): Promise<string[]> {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are an SEO expert. Extract 5-7 relevant SEO keywords from the content. Return ONLY a JSON array of strings.' },
    { role: 'user', content: content.substring(0, 2000) },
  ];

  for (const provider of [callOpenRouter, callGroq, callGemini]) {
    try {
      const result = await provider(messages, { temperature: 0.3, maxTokens: 200 });
      const clean = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const keywords = JSON.parse(clean);
      if (Array.isArray(keywords)) return keywords.slice(0, 7);
    } catch {}
  }
  return generateLocalKeywords(prompt || content, content);
}
