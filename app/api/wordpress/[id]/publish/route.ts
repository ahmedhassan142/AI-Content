import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WordPressSite from '@/models/WordPressSite';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

function buildBasicAuthHeader(username: string, password: string): string {
  const raw = `${username}:${password}`;
  const encoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(raw).toString('base64')
      : btoa(raw);
  return `Basic ${encoded}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts a simple subset of Markdown to HTML suitable for WordPress.
 *
 * Supported:
 *   # H1, ## H2, ### H3
 *   **bold** -> <strong>
 *   *italic* -> <em>
 *   - item / * item  -> <ul><li>...</li></ul>
 *   1. item          -> <ol><li>...</li></ol>
 *   blank line       -> paragraph break
 */
function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];

  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  const inline = (text: string): string => {
    let out = escapeHtml(text);
    // Bold: **text**
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*  (after bold, so it won't match the same ** chars)
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Inline code: `text`
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Links: [text](url)
    out = out.replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_m, label: string, url: string) =>
        `<a href="${url}" rel="noopener">${label}</a>`
    );
    return out;
  };

  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join(' ').trim();
      if (text) {
        html.push(`<p>${inline(text)}</p>`);
      }
      paragraphBuffer = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      closeLists();
      flushParagraph();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      flushParagraph();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list item: - item or * item
    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${inline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list item: 1. item
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${inline(olMatch[1])}</li>`);
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      closeLists();
      flushParagraph();
      html.push(`<blockquote><p>${inline(quoteMatch[1])}</p></blockquote>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      closeLists();
      flushParagraph();
      html.push('<hr />');
      continue;
    }

    // Regular paragraph text
    if (inUl || inOl) closeLists();
    paragraphBuffer.push(line);
  }

  closeLists();
  flushParagraph();

  return html.join('\n');
}

/**
 * POST /api/wordpress/:id/publish
 * Publishes a post to WordPress using the REST API.
 * Body: { title, content, status?, excerpt? }
 *
 * If the WordPress site doesn't have a "Blog" page or posts page set up,
 * the post is still created as a post (WordPress shows posts on the posts page
 * or the homepage by default). The returned postUrl points to the individual post.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const site = await WordPressSite.findOne({
      _id: id,
      userId: decoded.userId,
    });

    if (!site) {
      return NextResponse.json({ error: 'WordPress site not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, status, excerpt } = body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const finalStatus: 'draft' | 'publish' =
      status === 'publish' || status === 'draft'
        ? status
        : site.defaultStatus || 'draft';

    const htmlContent = markdownToHtml(content);

    // --- Step 1: Try to find or create a "Blog" category ---
    let categoryId: number | undefined = site.defaultCategoryId || undefined;

    if (!categoryId) {
      try {
        // Check if a "Blog" or "Articles" category exists
        const catRes = await fetch(
          `${site.siteUrl}/wp-json/wp/v2/categories?search=blog`,
          {
            headers: {
              Authorization: buildBasicAuthHeader(site.wpUsername, site.wpApplicationPassword),
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(10000),
          }
        );

        if (catRes.ok) {
          const cats = await catRes.json();
          if (Array.isArray(cats) && cats.length > 0) {
            categoryId = cats[0].id;
          }
        }

        // If no category found, try to create one
        if (!categoryId) {
          const createCatRes = await fetch(
            `${site.siteUrl}/wp-json/wp/v2/categories`,
            {
              method: 'POST',
              headers: {
                Authorization: buildBasicAuthHeader(site.wpUsername, site.wpApplicationPassword),
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ name: 'Blog', slug: 'blog' }),
              signal: AbortSignal.timeout(10000),
            }
          );

          if (createCatRes.ok) {
            const newCat = await createCatRes.json();
            if (newCat && newCat.id) {
              categoryId = newCat.id;
              // Save it as default for future publishes
              site.defaultCategoryId = newCat.id;
            }
          }
        }
      } catch (catErr) {
        // Non-fatal — publish without category
        console.error('[wordpress] Category setup failed (non-fatal):', catErr);
      }
    }

    // --- Step 2: Create the post ---
    const endpoint = `${site.siteUrl}/wp-json/wp/v2/posts`;

    const postBody: Record<string, unknown> = {
      title: title.trim(),
      content: htmlContent,
      status: finalStatus,
    };

    if (typeof excerpt === 'string' && excerpt.trim()) {
      postBody.excerpt = excerpt.trim();
    }
    if (categoryId && typeof categoryId === 'number' && categoryId > 0) {
      postBody.categories = [categoryId];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: buildBasicAuthHeader(site.wpUsername, site.wpApplicationPassword),
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'AI-Content-Writer/1.0',
        },
        body: JSON.stringify(postBody),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as {
        id?: number;
        link?: string;
        message?: string;
      };

      if (!res.ok) {
        const msg = data?.message || `WordPress returned HTTP ${res.status}`;
        return NextResponse.json(
          { success: false, error: msg },
          { status: res.status }
        );
      }

      // --- Step 3: Verify the post was actually created ---
      if (!data.id) {
        return NextResponse.json(
          { success: false, error: 'WordPress did not return a post ID. The post may not have been created.' },
          { status: 500 }
        );
      }

      // Update lastPublishedAt timestamp
      site.lastPublishedAt = new Date();
      site.isConnected = true;
      await site.save().catch(() => {});

      // --- Step 4: Construct the post URL ---
      // WordPress returns the post link in data.link
      // If the site doesn't have a blog page, the link points to the post's permalink
      let postUrl = data.link || '';

      // If no link returned, construct one from the site URL + post ID
      if (!postUrl) {
        postUrl = `${site.siteUrl}/?p=${data.id}`;
      }

      return NextResponse.json({
        success: true,
        postId: data.id,
        postUrl: postUrl,
        message: `Post ${finalStatus === 'publish' ? 'published' : 'saved as draft'} successfully on WordPress.`,
        categoryId: categoryId || null,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to publish to WordPress';
    console.error('[wordpress] publish error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
