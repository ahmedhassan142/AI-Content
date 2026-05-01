import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { groqClient } from '@/lib/grokClient';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { content, aspect, currentScore, isGuest, guestSessionId } = body;
    
    let userId;
    
    // Check if this is a guest request
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      console.log('Guest enhance request for session:', guestSessionId);
    } else {
      const token = getTokenFromRequest(request);
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const decoded = verifyToken(token);
      if (!decoded) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }
    
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    
    // If aspect is 'plagiarism' or not specified, use plagiarism reduction
    const isPlagiarismReduction = aspect === 'plagiarism' || !aspect;
    
    let systemPrompt = '';
    let temperature = 0.7;
    
    if (isPlagiarismReduction) {
      systemPrompt = `You are a content enhancement expert. Your task is to rewrite the content to make it MORE UNIQUE and ORIGINAL while keeping the same meaning.

Current uniqueness score: ${currentScore || 'unknown'}%
Target: Achieve 85%+ uniqueness

REQUIREMENTS:
1. Replace common phrases with unique expressions
2. Vary sentence structures significantly
3. Use more specific examples and details
4. Add unique perspectives and insights
5. Remove all templated language
6. Keep the same core message and length
7. Make it sound natural and engaging
8. DO NOT add meta-commentary
9. Output ONLY the enhanced content

OUTPUT ONLY THE ENHANCED CONTENT, NO EXPLANATIONS.`;
      temperature = 0.85;
    } else {
      const aspectPrompts: Record<string, string> = {
        clarity: 'Improve the clarity and readability of this content. Make it easier to understand.',
        conciseness: 'Make this content more concise by removing unnecessary words while keeping the key message.',
        engagement: 'Make this content more engaging and compelling for readers.',
        seo: 'Optimize this content for SEO by adding relevant keywords naturally.',
        grammar: 'Fix any grammar, spelling, or punctuation issues in this content.',
        tone: 'Adjust the tone to be more professional and authoritative.'
      };
      
      const selectedPrompt = aspectPrompts[aspect] || aspectPrompts.clarity;
      
      systemPrompt = `${selectedPrompt}
      
RULES:
1. Maintain the core message and key information
2. Do not change facts or important details
3. Output only the enhanced content, no explanations
4. Keep the same length approximately`;
    }
    
    const enhancedContent = await groqClient.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content }
    ], {
      temperature: temperature,
      maxTokens: 2500
    });
    
    const result = enhancedContent.choices[0].message.content;
    
    // If plagiarism reduction, calculate new score
    let newScore = null;
    if (isPlagiarismReduction && currentScore) {
      newScore = await groqClient.checkPlagiarism(result);
    }
    
    return NextResponse.json({
      success: true,
      content: result,
      originalContent: content,
      aspect: isPlagiarismReduction ? 'plagiarism' : aspect,
      originalScore: currentScore,
      newScore: newScore,
      improvement: newScore && currentScore ? newScore - currentScore : null,
      metadata: {
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('Enhance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enhance content' },
      { status: 500 }
    );
  }
}