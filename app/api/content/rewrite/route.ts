import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { groqClient } from '@/lib/grokClient';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { content, tone, length, isGuest, guestSessionId } = body;
    
    let userId;
    
    // Check if this is a guest request
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      console.log('Guest rewrite request for session:', guestSessionId);
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
    
    // Rewrite content using Groq API
    const rewrittenContent = await groqClient.rewriteContent({
      content,
      tone: tone || 'professional',
      length: length || 'medium'
    });
    
    // Get SEO keywords for the rewritten content
    const seoKeywords = await groqClient.generateSEOKeywords(rewrittenContent);
    
    // Check grammar issues
    const grammarIssues = await groqClient.checkGrammar(rewrittenContent);
    
    return NextResponse.json({
      success: true,
      content: rewrittenContent,
      originalContent: content,
      seoKeywords,
      grammarIssues,
      metadata: {
        tone: tone || 'professional',
        length: length || 'medium',
        originalWordCount: content.split(' ').length,
        newWordCount: rewrittenContent.split(' ').length,
        generatedAt: new Date().toISOString(),
        model: 'llama-3.3-70b-groq'
      }
    });
    
  } catch (error: any) {
    console.error('Rewrite error:', error);
    
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to rewrite content';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false
      },
      { status: 500 }
    );
  }
}