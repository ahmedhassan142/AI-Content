import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export const GroqModels = {
  LLAMA_3_70B: 'llama3-70b-8192',
  LLAMA_3_8B: 'llama3-8b-8192',
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  MIXTRAL: 'mixtral-8x7b-32768',
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ContentGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export class GroqClient {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  constructor(
    apiKey: string = GROQ_API_KEY,
    baseURL: string = GROQ_API_URL,
    defaultModel: string = GroqModels.LLAMA_3_3_70B
  ) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.defaultModel = defaultModel;
  }

  async chatCompletion(messages: ChatMessage[], options: ContentGenerationOptions = {}) {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 2000,
      topP = 0.9,
    } = options;

    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
    };

    try {
      const response = await axios.post(this.baseURL, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      });

      return response.data;
    } catch (error) {
      console.error('Groq API error:', error);
      throw error;
    }
  }

  async generateContent(params: {
    prompt: string;
    tone: string;
    length: string;
    language: string;
    type?: 'blog' | 'email' | 'social' | 'article' | 'general';
  }): Promise<string> {
    const { prompt, tone, length, language, type = 'general' } = params;

    const lengthInstruction =
      length === 'short'
        ? 'Keep it concise (200-400 words).'
        : length === 'long'
          ? 'Make it comprehensive and detailed (800-1200 words).'
          : 'Make it medium length (400-800 words).';

    const systemPrompt = `You are a professional content writer. Create high-quality, engaging ${type} content in ${language}.
Tone: ${tone}
${lengthInstruction}

Requirements:
- Write compelling, original content
- Use proper formatting and structure
- Include relevant details and examples
- Avoid generic phrases and clichés
- Do not add any meta-commentary about the content
- Output only the content itself, no preamble or explanation`;

    const userPrompt = `Write ${type} content about: ${prompt}`;

    try {
      const response = await this.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.7,
          maxTokens: 2000,
        }
      );

      const content = response.choices[0].message.content.trim();

      // Clean up common meta phrases the model sometimes prepends.
      const metaPhrases = [
        /^here('?s| is) the (rewritten |updated )?content:?\s*/i,
        /^sure,? here('?s| is) the content:?\s*/i,
        /^content:?\s*/i,
        /^(here('?s| is)|sure!?)\s+/i,
      ];
      let cleaned = content;
      for (const phrase of metaPhrases) {
        cleaned = cleaned.replace(phrase, '');
      }
      return cleaned.trim();
    } catch (error) {
      console.error('Content generation failed:', error);
      return '';
    }
  }

  async generateSEOKeywords(content: string, prompt?: string): Promise<string[]> {
    const systemPrompt = `You are an SEO expert. Analyze the given content and generate 5-10 highly relevant SEO keywords.
Return ONLY a JSON object with a "keywords" array of strings.
Example: {"keywords": ["content marketing", "SEO strategy", "digital marketing"]}
Do not include any other text or explanation.`;

    const userPrompt = prompt
      ? `Original topic/prompt: ${prompt}\n\nContent to analyze:\n${content.substring(0, 3000)}`
      : `Analyze this content and extract SEO keywords:\n\n${content.substring(0, 3000)}`;

    try {
      const response = await this.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.5,
          maxTokens: 500,
        }
      );

      const result = response.choices[0].message.content;
      const cleanResult = result
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleanResult);
      return parsed.keywords || [];
    } catch (error) {
      console.error('SEO keyword generation failed:', error);
      return ['content marketing', 'digital strategy', 'audience engagement', 'brand development', 'online presence'];
    }
  }

  async checkGrammar(content: string): Promise<string[]> {
    const systemPrompt = `You are a grammar expert. Check the following content for grammar issues.
Return ONLY a JSON object with an "issues" array.
Example: {"issues": ["Missing comma after introductory phrase", "Subject-verb agreement error"]}
If no issues found, return {"issues": []}`;

    try {
      const response = await this.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content.substring(0, 3000) },
        ],
        {
          temperature: 0.2,
          maxTokens: 500,
        }
      );

      const result = response.choices[0].message.content;
      const cleanResult = result
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleanResult);
      return parsed.issues || [];
    } catch (error) {
      console.error('Grammar check failed:', error);
      return [];
    }
  }

  async checkPlagiarism(content: string): Promise<number> {
    const systemPrompt = `You are a plagiarism detection expert. Your task is to analyze the content below and give it a uniqueness score from 0-100.

RULES:
- 90-100: Very original, unique ideas, fresh examples
- 70-89: Mostly original, some common phrases
- 50-69: Average originality, some generic content
- 30-49: Below average, many common patterns
- 0-29: Highly templated or copied content

Return ONLY the number between 0-100. No other text, no explanation, no JSON. Just the number.`;

    try {
      const response = await this.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this content for uniqueness. Return ONLY a number between 0-100:\n\n${content.substring(0, 1500)}` },
        ],
        {
          temperature: 0.5,
          maxTokens: 10,
        }
      );

      const result = response.choices[0].message.content;
      const match = result.match(/\d+/);
      const score = match ? parseInt(match[0]) : null;

      if (score !== null && score >= 0 && score <= 100) {
        return score;
      }

      return 85;
    } catch (error) {
      console.error('Plagiarism check failed:', error);
      return 85;
    }
  }

  async rewriteContent(params: {
    content: string;
    tone: string;
    length: string;
  }): Promise<string> {
    const { content, tone, length } = params;

    const systemPrompt = `Rewrite the following content with these specifications:
- New tone: ${tone}
- Target length: ${length === 'short' ? 'shorter' : length === 'long' ? 'longer' : 'same'} than original
- Maintain the core message and key information
- Improve clarity and engagement
- Use fresh vocabulary and sentence structures
- DO NOT add meta-commentary
- Output only the rewritten content`;

    try {
      const response = await this.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content },
        ],
        {
          temperature: 0.7,
          maxTokens: 2000,
        }
      );

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Rewrite failed:', error);
      return content;
    }
  }
}

export const groqClient = new GroqClient();
