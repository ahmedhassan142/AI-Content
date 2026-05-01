import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY ||'';

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

    try {
      const requestBody: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      };

      const response = await axios.post(this.baseURL, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
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

    const lengthMap = {
      short: '100-200 words',
      medium: '300-500 words',
      long: '800-1200 words'
    };

    const typeInstructions = {
      blog: `Write a complete, valuable blog post that provides real information. Include:
- An engaging title with H1 heading
- Introduction that hooks the reader
- 3-5 main sections with H2 subheadings
- Bullet points or numbered lists where appropriate
- Practical tips or actionable advice
- A conclusion that summarizes key points
- Use emojis sparingly for visual appeal (📝, 💡, 🏠, etc.)
- Format with proper spacing and line breaks`,
      
      email: `Write a professional email with:
- Catchy subject line in brackets [Subject: ...]
- Professional greeting
- Clear value proposition
- Specific call to action
- Professional signature`,
      
      social: `Write engaging social media content with:
- Hook in first sentence
- Relevant hashtags (#Example)
- Emojis for engagement
- Clear call to action`,
      
      article: `Write a well-researched article with:
- Compelling title
- Introduction stating the problem
- Multiple sections with subheadings
- Data-backed insights
- Practical examples
- Strong conclusion`,
      
      general: `Write high-quality, valuable content that:
- Answers the user's query directly
- Provides actionable information
- Is easy to read and understand
- Includes examples where helpful`
    };

    const systemPrompt = `You are a professional content writer. Write DIRECTLY about the topic given.

CRITICAL RULES:
1. NEVER write about "writing content" - just write the actual content
2. NEVER say "Here is a blog post about X" - just start with the content
3. NEVER include meta-commentary like "I have written this content for you"
4. Write AS IF you are an expert sharing knowledge directly
5. The content should be ready to publish immediately
6. Use markdown formatting (headings, lists, bold text)
7. Be specific, not generic - use real examples and actionable advice

CONTENT TYPE: ${typeInstructions[type]}
TONE: ${tone}
LANGUAGE: ${language}
TARGET LENGTH: ${lengthMap[length as keyof typeof lengthMap]}

Remember: Write the ACTUAL content, not instructions about content.`;

    const userPrompt = `${prompt}

Write a ${tone} ${type} about this topic. Make it valuable, specific, and actionable.`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.8,
        maxTokens: length === 'short' ? 800 : length === 'medium' ? 1500 : 2500,
      });

      const generatedContent = response.choices[0].message.content;
      
      let cleanedContent = generatedContent.trim();
      
      const metaPhrases = [
        /^Here is a .*?:\s*/i,
        /^I've written a .*?:\s*/i,
        /^Here's your .*?:\s*/i,
        /^Below is .*?:\s*/i,
        /^As requested,.*?:\s*/i,
      ];
      
      for (const phrase of metaPhrases) {
        cleanedContent = cleanedContent.replace(phrase, '');
      }
      
      return cleanedContent;
    } catch (error) {
      console.error('Content generation failed:', error);
      return this.getFallbackContent(prompt, tone, length, language);
    }
  }

  async generateSEOKeywords(content: string): Promise<string[]> {
    const systemPrompt = `You are an SEO expert. Extract 5-7 relevant SEO keywords from the given content.
Return ONLY a JSON array of strings, no explanations.
Example: ["keyword 1", "keyword 2", "keyword 3"]`;

    const userPrompt = `Extract SEO keywords from this content:\n\n${content.substring(0, 2000)}`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.3,
        maxTokens: 200,
        //@ts-ignore
        responseFormat: { type: 'json_object' }
      });

      const result = response.choices[0].message.content;
      const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const keywords = JSON.parse(cleanResult);
      
      if (Array.isArray(keywords)) return keywords;
      if (keywords.keywords && Array.isArray(keywords.keywords)) return keywords.keywords;
      return this.getFallbackKeywords();
    } catch (error) {
      console.error('SEO keyword generation failed:', error);
      return this.getFallbackKeywords();
    }
  }

  async checkGrammar(content: string): Promise<string[]> {
    const systemPrompt = `You are a grammar expert. Check the following content for grammar issues.
Return ONLY a JSON object with an "issues" array.
Example: {"issues": ["Missing comma after introductory phrase", "Subject-verb agreement error"]}
If no issues found, return {"issues": []}`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content.substring(0, 3000) }
      ], {
        temperature: 0.2,
        maxTokens: 500,
        //@ts-ignore
        responseFormat: { type: 'json_object' }
      });

      const result = response.choices[0].message.content;
      const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanResult);
      return parsed.issues || [];
    } catch (error) {
      console.error('Grammar check failed:', error);
      return [];
    }
  }

  async checkPlagiarism(content: string): Promise<number> {
    console.log('=== Plagiarism Check Started ===');
    console.log('Content length:', content.length);
    console.log('Content preview:', content.substring(0, 200));
    
    const systemPrompt = `You are a plagiarism detection expert. Your task is to analyze the content below and give it a uniqueness score from 0-100.

RULES:
- 90-100: Very original, unique ideas, fresh examples
- 70-89: Mostly original, some common phrases
- 50-69: Average originality, some generic content
- 30-49: Below average, many common patterns
- 0-29: Highly templated or copied content

Return ONLY the number between 0-100. No other text, no explanation, no JSON. Just the number.`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this content for uniqueness. Return ONLY a number between 0-100:\n\n${content.substring(0, 1500)}` }
      ], {
        temperature: 0.5,
        maxTokens: 10,
      });

      const result = response.choices[0].message.content;
      console.log('Raw API response:', result);
      
      const match = result.match(/\d+/);
      const score = match ? parseInt(match[0]) : null;
      
      if (score && score >= 0 && score <= 100) {
        console.log('✅ Plagiarism score from API:', score);
        return score;
      }
      
      console.log('⚠️ Invalid score from API, using calculation fallback');
      return this.calculatePlagiarismScore(content);
      
    } catch (error: any) {
      console.error('❌ Plagiarism API error:', error.message);
      console.log('Using fallback calculation');
      return this.calculatePlagiarismScore(content);
    }
  }

  private calculatePlagiarismScore(content: string): number {
    console.log('Calculating plagiarism score algorithmically...');
    
    let score = 85;
    
    const templatedPhrases = [
      'in today', 'fast-paced', 'as we know', 'it is important',
      'first and foremost', 'last but not least', 'in conclusion',
      'to sum up', 'as a result', 'in the modern world'
    ];
    
    let templateCount = 0;
    templatedPhrases.forEach(phrase => {
      if (content.toLowerCase().includes(phrase)) {
        templateCount++;
      }
    });
    
    score -= templateCount * 5;
    console.log(`Found ${templateCount} templated phrases, score now: ${score}`);
    
    const words = content.toLowerCase().split(/\s+/);
    const wordFrequency: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 3) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
    
    const repeatedWords = Object.values(wordFrequency).filter(count => count > 5).length;
    score -= repeatedWords * 2;
    console.log(`Found ${repeatedWords} frequently repeated words, score now: ${score}`);
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const uniqueSentences = new Set(sentences.map(s => s.trim())).size;
    const sentenceVariety = uniqueSentences / sentences.length;
    
    if (sentenceVariety < 0.5) {
      score -= 15;
      console.log(`Low sentence variety (${sentenceVariety.toFixed(2)}), score now: ${score}`);
    } else if (sentenceVariety > 0.8) {
      score += 10;
      console.log(`High sentence variety (${sentenceVariety.toFixed(2)}), score now: ${score}`);
    }
    
    const finalScore = Math.min(100, Math.max(0, Math.floor(score)));
    console.log(`Final calculated score: ${finalScore}%`);
    
    return finalScore;
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
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ], {
        temperature: 0.7,
        maxTokens: 2000,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Rewrite failed:', error);
      return content;
    }
  }

  private getFallbackContent(prompt: string, tone: string, length: string, language: string): string {
    const templates = {
      short: `# ${prompt}

This is a ${tone} guide to help you understand this topic better.

## Key Points
- First important aspect to consider
- Second crucial element to understand  
- Final key takeaway for success

## Summary
Remember to apply these principles for the best results.`,
      
      medium: `# Understanding ${prompt}

## Introduction
${prompt} is an important topic that deserves attention. This ${tone} guide will help you navigate the key concepts.

## Main Principles
First, understand the fundamentals. Second, apply the practical techniques. Third, measure your results.

## Practical Applications
Many professionals have found success by following these steps. Start with small changes and build momentum.

## Conclusion
Take action today and see the difference.`,
      
      long: `# Complete Guide to ${prompt}

## Executive Summary
${prompt} offers significant opportunities for those who understand its principles.

## Core Concepts
### Foundation
Understanding the basics is crucial for success.

### Key Components
Several elements work together to create an effective approach.

## Implementation
### Step-by-Step Process
Follow these proven steps for the best results.

### Best Practices
Learn from successful examples and case studies.

## Conclusion
Start implementing these strategies today.`
    };

    let selectedTemplate = templates.medium;
    if (length === 'short') selectedTemplate = templates.short;
    if (length === 'long') selectedTemplate = templates.long;
    
    return selectedTemplate;
  }

  private getFallbackKeywords(): string[] {
    return [
      'content marketing',
      'digital strategy',
      'audience engagement',
      'brand development',
      'online presence'
    ];
  }
}

export const groqClient = new GroqClient();