import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Content from '@/models/Content';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { fireEvent } from '@/lib/webhooks/sender';

export const runtime = 'nodejs';

/**
 * POST /api/content/publish-blog
 *
 * Publishes the current draft to all of the user's active webhooks that
 * subscribe to the `blog.published` event. Typically used to push AI-
 * generated content to the Tech Solutions portfolio blog at
 * https://ahtech.fun (or wherever the user has registered a webhook).
 *
 * Body:
 *   {
 *     title, content,
 *     type?, tone?, length?, language?,
 *     seoKeywords?,
 *     excerpt?, category?, tags?, author?,
 *     featuredImage?, featured?
 *   }
 *
 * Flow:
 *   1. Save the content to the user's library (so it shows up in History).
 *   2. Fire `blog.published` to all matching webhooks.
 *   3. Return the saved content + a flag confirming the webhook dispatch.
 *
 * The actual delivery happens asynchronously in `fireEvent`. To see the
 * per-webhook result, the user can check the Webhooks → Deliveries page.
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = decoded.userId;

    const body = await request.json();
    const {
      title,
      content,
      type,
      tone,
      length,
      language,
      seoKeywords,
      excerpt,
      category,
      tags,
      author,
      featuredImage,
      featured,
    } = body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // ----- 1. Persist to the user's content library ----------------------
    const savedContent = await Content.create({
      userId,
      isGuest: false,
      title: title.trim(),
      content: content.trim(),
      type: type || 'generated',
      tone: tone || 'professional',
      length: length || 'medium',
      language: language || 'English',
      seoKeywords: Array.isArray(seoKeywords) ? seoKeywords : [],
      plagiarismScore: body.plagiarismScore ?? null,
      isFavorite: false,
    });

    const contentId = String(savedContent._id);
    const publishedAt = new Date().toISOString();

    // ----- 2. Fire blog.published webhook --------------------------------
    // Build a blog-ready payload that the receiving site can use directly.
    await fireEvent('blog.published', userId, {
      contentId,
      title: title.trim(),
      content: content.trim(),
      type: type || 'generated',
      tone: tone || 'professional',
      length: length || 'medium',
      language: language || 'English',
      seoKeywords: Array.isArray(seoKeywords) ? seoKeywords : [],
      excerpt: typeof excerpt === 'string' ? excerpt.trim() : '',
      category: typeof category === 'string' ? category.trim() : '',
      tags: Array.isArray(tags) ? tags : [],
      author: typeof author === 'string' ? author.trim() : 'AI Content Writer',
      featuredImage: typeof featuredImage === 'string' ? featuredImage.trim() : '',
      featured: Boolean(featured),
      plagiarismScore: body.plagiarismScore ?? null,
      publishedAt,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          'Content saved and dispatched to all webhooks subscribed to blog.published. Check the Webhooks → Deliveries page for per-endpoint results.',
        content: savedContent,
        event: 'blog.published',
        publishedAt,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to publish to blog';
    console.error('[content/publish-blog] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
