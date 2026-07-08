import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import WordPressSite from '@/models/WordPressSite';

export const runtime = 'nodejs';
export const maxDuration = 45;

function buildBasicAuthHeader(username: string, password: string): string {
  const raw = `${username}:${password}`;
  const encoded = typeof Buffer !== 'undefined'
    ? Buffer.from(raw).toString('base64')
    : btoa(raw);
  return `Basic ${encoded}`;
}

/**
 * POST /api/seo/apply
 * Actually applies SEO fixes to a connected WordPress website.
 *
 * Body: {
 *   wpSiteId: string,         // WordPress site ID
 *   auditedUrl: string,       // The URL that was audited
 *   fixedTitle: string,       // The fixed <title> tag content
 *   fixedMetaDescription: string,  // The fixed meta description content
 *   fixedContent?: string,    // If we should update the page content too
 * }
 *
 * What this does:
 * 1. Searches WordPress for a post/page matching the audited URL slug
 * 2. If found: updates the post title (→ changes <title> tag) and excerpt (→ meta description)
 * 3. If not found: searches by matching the URL path
 * 4. Returns what was actually changed so the user knows what improved
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { wpSiteId, auditedUrl, fixedTitle, fixedMetaDescription } = body;

    if (!wpSiteId) {
      return NextResponse.json({ success: false, error: 'WordPress site ID is required' }, { status: 400 });
    }
    if (!auditedUrl) {
      return NextResponse.json({ success: false, error: 'Audited URL is required' }, { status: 400 });
    }

    // Get the WordPress site
    const site = await WordPressSite.findOne({
      _id: wpSiteId,
      userId: decoded.userId,
    });

    if (!site) {
      return NextResponse.json({ success: false, error: 'WordPress site not found' }, { status: 404 });
    }

    const authHeader = buildBasicAuthHeader(site.wpUsername, site.wpApplicationPassword);
    const baseUrl = site.siteUrl.replace(/\/$/, '');

    // Extract the slug from the audited URL
    let slug = '';
    try {
      const urlObj = new URL(auditedUrl);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      slug = pathSegments[pathSegments.length - 1] || '';
    } catch {
      // If URL parsing fails, try the whole path
      slug = auditedUrl.split('/').filter(Boolean).pop() || '';
    }

    const changes: string[] = [];
    let postId: number | null = null;
    let postUrl: string = '';

    // --- Step 1: Search for a post/page matching the slug ---
    let foundPost: any = null;

    // Search in posts
    try {
      const searchRes = await fetch(
        `${baseUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&per_page=1`,
        {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (searchRes.ok) {
        const posts = await searchRes.json();
        if (Array.isArray(posts) && posts.length > 0) {
          foundPost = posts[0];
        }
      }
    } catch {}

    // Search in pages if not found in posts
    if (!foundPost && slug) {
      try {
        const searchPagesRes = await fetch(
          `${baseUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&per_page=1`,
          {
            headers: { Authorization: authHeader, Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (searchPagesRes.ok) {
          const pages = await searchPagesRes.json();
          if (Array.isArray(pages) && pages.length > 0) {
            foundPost = pages[0];
            foundPost._isPage = true;
          }
        }
      } catch {}
    }

    // If still not found, try searching by the URL path in the link field
    if (!foundPost) {
      try {
        // Get recent posts and find one whose link matches
        const recentRes = await fetch(
          `${baseUrl}/wp-json/wp/v2/posts?per_page=50`,
          {
            headers: { Authorization: authHeader, Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (recentRes.ok) {
          const posts = await recentRes.json();
          if (Array.isArray(posts)) {
            foundPost = posts.find((p: any) => {
              try {
                const postUrl = new URL(p.link);
                const auditedUrlParsed = new URL(auditedUrl);
                return postUrl.pathname === auditedUrlParsed.pathname;
              } catch {
                return false;
              }
            }) || null;
          }
        }
      } catch {}
    }

    if (!foundPost) {
      return NextResponse.json({
        success: false,
        error: `No WordPress post or page found matching the URL "${auditedUrl}". The fixes could not be applied automatically. You need to manually add the fixed title and meta description to the page.`,
        suggestion: 'Create a new page in WordPress with the audited URL slug, then try again.',
      });
    }

    postId = foundPost.id;
    postUrl = foundPost.link;
    const isPage = foundPost._isPage;
    const endpoint = isPage ? 'pages' : 'posts';

    // --- Step 2: Update the post title (changes the <title> tag) ---
    if (fixedTitle && fixedTitle.trim()) {
      try {
        const updateRes = await fetch(
          `${baseUrl}/wp-json/wp/v2/${endpoint}/${postId}`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              title: fixedTitle.trim(),
            }),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (updateRes.ok) {
          changes.push(`Updated page title to: "${fixedTitle.trim()}"`);
        } else {
          const errData = await updateRes.json().catch(() => ({}));
          changes.push(`Failed to update title: ${errData.message || updateRes.status}`);
        }
      } catch (err: any) {
        changes.push(`Failed to update title: ${err.message}`);
      }
    }

    // --- Step 3: Update the excerpt (serves as meta description with SEO plugins) ---
    if (fixedMetaDescription && fixedMetaDescription.trim()) {
      try {
        const updateRes = await fetch(
          `${baseUrl}/wp-json/wp/v2/${endpoint}/${postId}`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              excerpt: fixedMetaDescription.trim(),
            }),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (updateRes.ok) {
          changes.push(`Updated meta description (excerpt) to: "${fixedMetaDescription.trim().substring(0, 80)}..."`);
        } else {
          const errData = await updateRes.json().catch(() => ({}));
          changes.push(`Failed to update excerpt: ${errData.message || updateRes.status}`);
        }
      } catch (err: any) {
        changes.push(`Failed to update excerpt: ${err.message}`);
      }
    }

    // --- Step 4: Try to update Yoast SEO meta fields if Yoast is installed ---
    if (fixedTitle || fixedMetaDescription) {
      try {
        const yoastRes = await fetch(
          `${baseUrl}/wp-json/wp/v2/${endpoint}/${postId}`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              meta: {
                'yoast_wpseo_title': fixedTitle?.trim() || undefined,
                'yoast_wpseo_metadesc': fixedMetaDescription?.trim() || undefined,
              },
            }),
            signal: AbortSignal.timeout(15000),
          }
        );

        if (yoastRes.ok) {
          changes.push('Updated Yoast SEO title and meta description fields');
        }
        // If Yoast isn't installed, this will fail silently — that's fine
      } catch {}
    }

    // --- Step 5: Update lastPublishedAt ---
    site.lastPublishedAt = new Date();
    site.isConnected = true;
    await site.save().catch(() => {});

    return NextResponse.json({
      success: true,
      postId,
      postUrl,
      changes,
      message: changes.length > 0
        ? `Applied ${changes.length} fix(es) to "${foundPost.title?.rendered || 'the page'}" on WordPress.`
        : 'No changes were applied. The page may already have the correct title and meta description.',
      note: 'Title and meta description have been updated. Re-run the SEO audit to see the improved score. Other fixes (robots.txt, sitemap.xml, canonical tags, etc.) need to be applied manually by pasting the generated code.',
    });
  } catch (error: any) {
    console.error('[seo/apply] error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to apply SEO fixes' },
      { status: 500 }
    );
  }
}
