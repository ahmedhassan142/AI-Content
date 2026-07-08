import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { groqClient } from '@/lib/grokClient';
import { runPlagiarismCheck } from '@/lib/plagiarism/checker';
import { fireEvent } from '@/lib/webhooks/sender';
import { generateLocalKeywords } from '@/lib/localContentGenerator';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      prompt,
      tone,
      length,
      language,
      type = 'general',
      isGuest,
      guestSessionId,
    } = body;

    let userId: string | undefined;
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
        return NextResponse.json(
          {
            error: 'Unauthorized - No token provided',
            success: false,
          },
          { status: 401 }
        );
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        console.error('Invalid token provided');
        return NextResponse.json(
          {
            error: 'Unauthorized - Invalid token',
            success: false,
          },
          { status: 401 }
        );
      }

      userId = decoded.userId;
    }

    if (!prompt) {
      return NextResponse.json(
        {
          error: 'Prompt is required',
          success: false,
        },
        { status: 400 }
      );
    }

    // Generate content using Groq API (falls back to local generator on error)
    const content = await groqClient.generateContent({
      prompt,
      tone,
      length,
      language,
      type,
    });

    // Get SEO keywords — use local generator for speed (AI keywords are slow)
    const seoKeywords = generateLocalKeywords(prompt, content);

    // Skip AI grammar check for speed — the plagiarism checker already detects issues
    const grammarIssues: string[] = [];

    // Run the comprehensive plagiarism / originality check
    const plagiarismReport = await runPlagiarismCheck({
      content,
      title: prompt.slice(0, 80),
      keywords: seoKeywords,
      userId,
      isGuest: isGuestUser,
    });

    const plagiarismScore = plagiarismReport.originalityScore;
    const wordCount = content.split(' ').length;
    const generatedAt = new Date().toISOString();

    // Fire webhook event for authenticated users (non-blocking)
    if (!isGuestUser && userId) {
      fireEvent('content.generated', userId, {
        content,
        title: prompt.slice(0, 80),
        prompt,
        tone,
        length,
        language,
        type,
        seoKeywords,
        originalityScore: plagiarismReport.originalityScore,
        humanQualityScore: plagiarismReport.humanQualityScore,
        wordCount,
        generatedAt,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      content,
      seoKeywords,
      plagiarismScore,
      plagiarismReport,
      grammarIssues,
      isGuest: isGuestUser,
      metadata: {
        tone,
        length,
        language,
        type,
        wordCount,
        generatedAt,
        model: 'llama-3.3-70b-groq',
      },
    });
  } catch (error: any) {
    console.error('Generate error:', error);

    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      'Failed to generate content';
    const statusCode = error.response?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
        details:
          process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: statusCode }
    );
  }
}
