import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { groqClient } from '@/lib/grokClient';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { prompt, tone, length, language, type = 'general', isGuest, guestSessionId } = body;
    
    let userId;
    let isGuestUser = false;
    
    // Check if this is a guest request
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      isGuestUser = true;
      console.log('Guest generation request for session:', guestSessionId);
    } else {
      // Regular authenticated user
      const token = getTokenFromRequest(request);
      
      if (!token) {
        console.error('No token found in request');
        return NextResponse.json({ 
          error: 'Unauthorized - No token provided',
          success: false 
        }, { status: 401 });
      }
      
      const decoded = verifyToken(token);
      
      if (!decoded) {
        console.error('Invalid token provided');
        return NextResponse.json({ 
          error: 'Unauthorized - Invalid token',
          success: false 
        }, { status: 401 });
      }
      
      userId = decoded.userId;
    }
    
    if (!prompt) {
      return NextResponse.json({ 
        error: 'Prompt is required',
        success: false 
      }, { status: 400 });
    }
    
    // Generate content using Groq API
    const content = await groqClient.generateContent({
      prompt,
      tone,
      length,
      language,
      type
    });
    
    // Get SEO keywords from the generated content
    const seoKeywords = await groqClient.generateSEOKeywords(content);
    
    // Check grammar issues
    const grammarIssues = await groqClient.checkGrammar(content);
    
    // Check plagiarism score
    const plagiarismScore = await groqClient.checkPlagiarism(content);
    
    return NextResponse.json({
      success: true,
      content,
      seoKeywords,
      plagiarismScore,
      grammarIssues,
      isGuest: isGuestUser,
      metadata: {
        tone,
        length,
        language,
        type,
        wordCount: content.split(' ').length,
        generatedAt: new Date().toISOString(),
        model: 'llama-3.3-70b-groq'
      }
    });
    
  } catch (error: any) {
    console.error('Generate error:', error);
    
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to generate content';
    const statusCode = error.response?.status || 500;
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: statusCode }
    );
  }
}