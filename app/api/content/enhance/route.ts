import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { groqClient } from '@/lib/grokClient';
import { runPlagiarismCheck } from '@/lib/plagiarism/checker';
import { fixPlagiarism } from '@/lib/plagiarism/fixer';
import { fireEvent } from '@/lib/webhooks/sender';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      content,
      aspect,
      currentScore,
      title,
      keywords,
      isGuest,
      guestSessionId,
    } = body;

    let userId: string | undefined;
    let isGuestUser = false;

    // Check if this is a guest request
    if (isGuest && guestSessionId) {
      userId = guestSessionId;
      isGuestUser = true;
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

      userId = decoded.userId;
    }

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const effectiveTitle: string =
      typeof title === 'string' && title.trim().length > 0
        ? title.slice(0, 80)
        : content.slice(0, 80);
    const effectiveKeywords: string[] = Array.isArray(keywords) ? keywords : [];

    // If aspect is 'plagiarism' or not specified, use the plagiarism fixer.
    const isPlagiarismReduction = aspect === 'plagiarism' || !aspect;

    if (isPlagiarismReduction) {
      // 1) Run the current plagiarism check to establish a baseline report.
      const currentReport = await runPlagiarismCheck({
        content,
        title: effectiveTitle,
        keywords: effectiveKeywords,
        userId,
        isGuest: isGuestUser,
      });

      const originalScore = currentReport.originalityScore;

      // 2) Apply the plagiarism fixer.
      const {
        fixedContent,
        newReport,
        changes,
        improvement,
      } = await fixPlagiarism(
        content,
        currentReport,
        userId,
        isGuestUser,
        effectiveTitle,
        effectiveKeywords
      );

      const newScore = newReport.originalityScore;
      const fixedAt = new Date().toISOString();

      // 3) Fire webhook event for authenticated users (non-blocking).
      if (!isGuestUser && userId) {
        fireEvent('plagiarism.fixed', userId, {
          originalContent: content,
          fixedContent,
          originalScore,
          newScore,
          improvement,
          changes,
          title: effectiveTitle,
          fixedAt,
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        content: fixedContent,
        originalContent: content,
        aspect: 'plagiarism',
        originalScore,
        newScore,
        improvement,
        changes,
        plagiarismReport: newReport,
        metadata: {
          generatedAt: fixedAt,
        },
      });
    }

    // Non-plagiarism enhancement aspects (clarity, conciseness, etc.) still
    // route through the Groq chat completion API.
    const aspectPrompts: Record<string, string> = {
      clarity:
        'Improve the clarity and readability of this content. Make it easier to understand.',
      conciseness:
        'Make this content more concise by removing unnecessary words while keeping the key message.',
      engagement:
        'Make this content more engaging and compelling for readers.',
      seo: 'Optimize this content for SEO by adding relevant keywords naturally.',
      grammar:
        'Fix any grammar, spelling, or punctuation issues in this content.',
      tone:
        'Adjust the tone to be more professional and authoritative.',
    };

    const selectedPrompt = aspectPrompts[aspect] || aspectPrompts.clarity;

    const systemPrompt = `${selectedPrompt}

RULES:
1. Maintain the core message and key information
2. Do not change facts or important details
3. Output only the enhanced content, no explanations
4. Keep the same length approximately`;

    const enhancedResponse = await groqClient.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      {
        temperature: 0.7,
        maxTokens: 2500,
      }
    );

    const result = enhancedResponse.choices[0].message.content;

    return NextResponse.json({
      success: true,
      content: result,
      originalContent: content,
      aspect,
      originalScore: typeof currentScore === 'number' ? currentScore : null,
      newScore: null,
      improvement: null,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Enhance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enhance content' },
      { status: 500 }
    );
  }
}
