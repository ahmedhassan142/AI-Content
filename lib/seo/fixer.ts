import * as cheerio from 'cheerio';
import type { SeoCheck } from './auditor';

// ============================================================
// Types
// ============================================================

export type FixStatus = 'fixed' | 'cannot_fix' | 'already_ok';

export interface CodeSnippet {
  label: string;
  language: string;
  code: string;
  location: string;
}

export interface SeoFix {
  checkId: string;
  checkName: string;
  status: FixStatus;
  fixDescription: string;
  codeSnippets: CodeSnippet[];
  instructions: string[];
}

export interface GeneratedFiles {
  robotsTxt?: string;
  sitemapXml?: string;
}

export interface SeoFixSummary {
  total: number;
  fixed: number;
  cannotFix: number;
  alreadyOk: number;
}

export interface FixResult {
  url: string;
  fixes: SeoFix[];
  generatedFiles: GeneratedFiles;
  summary: SeoFixSummary;
}

export interface FixerOptions {
  url: string;
  html?: string;
  checks: SeoCheck[];
}

// ============================================================
// Helpers
// ============================================================

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function siteNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return host;
  } catch {
    return 'Site';
  }
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + '…';
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function firstParagraph($: cheerio.CheerioAPI): string {
  let text = '';
  $('p').each((_, el) => {
    const t = $(el).text().trim();
    if (t.split(' ').length >= 8) {
      text = t;
      return false;
    }
    return true;
  });
  return text;
}

function titleCase(s: string): string {
  return s
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

function altFromFilename(src: string): string {
  try {
    const u = new URL(src);
    const last = u.pathname.split('/').pop() || '';
    const base = last.replace(/\.[a-zA-Z0-9]+$/, '');
    if (!base) return '';
    return titleCase(base);
  } catch {
    const last = src.split('/').pop() || src;
    const base = last.replace(/\.[a-zA-Z0-9]+$/, '').split('?')[0];
    return titleCase(base);
  }
}

// ============================================================
// Individual fixers
// ============================================================

function fixTitle($: cheerio.CheerioAPI, url: string): SeoFix {
  const siteName = siteNameFromUrl(url);
  const existing = ($('title').first().text() || '').trim();
  const h1 = ($('h1').first().text() || '').trim();
  const ogTitle = ($('meta[property="og:title"]').attr('content') || '').trim();

  let candidate = h1 || ogTitle || existing;
  if (!candidate) {
    try {
      const u = new URL(url);
      candidate = titleCase(u.pathname.split('/').filter(Boolean).pop() || siteName);
    } catch {
      candidate = siteName;
    }
  }

  // Format: "Page Name — SiteName" within 60 chars
  const withSite = candidate.includes(siteName)
    ? candidate
    : `${candidate} — ${siteName}`;
  const finalTitle = truncate(withSite, 60);

  const code = `<title>${htmlEscape(finalTitle)}</title>`;

  return {
    checkId: 'title',
    checkName: 'Title Tag',
    status: 'fixed',
    fixDescription: `Generated a 50–60 char title using the page H1 and site name.`,
    codeSnippets: [
      {
        label: 'Title tag',
        language: 'html',
        code,
        location: 'Inside the <head>…</head> section, replace any existing <title> tag.',
      },
    ],
    instructions: [
      'Place the <title> tag inside <head>.',
      'Each page should have a unique title.',
      'Keep between 50–60 characters to avoid truncation in SERPs.',
    ],
  };
}

function fixMetaDescription($: cheerio.CheerioAPI): SeoFix {
  const para = firstParagraph($);
  let desc = para;
  if (!desc) {
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    desc = bodyText.slice(0, 160);
  }
  const finalDesc = truncate(desc, 160);
  const code = `<meta name="description" content="${htmlEscape(finalDesc)}">`;

  return {
    checkId: 'meta_description',
    checkName: 'Meta Description',
    status: 'fixed',
    fixDescription: `Generated a meta description from the page's first paragraph.`,
    codeSnippets: [
      {
        label: 'Meta description tag',
        language: 'html',
        code,
        location: 'Inside the <head>…</head> section.',
      },
    ],
    instructions: [
      'Place the <meta name="description"> tag inside <head>.',
      'Keep between 120–160 characters.',
      'Write a unique, compelling summary that includes target keywords.',
    ],
  };
}

function fixHeadings($: cheerio.CheerioAPI): SeoFix {
  const h1Elements = $('h1').toArray();
  const h1Count = h1Elements.length;
  const h2Count = $('h2').length;
  const snippets: CodeSnippet[] = [];
  const instructions: string[] = [];
  let description = '';

  if (h1Count === 0) {
    description = 'Suggested an <h1> derived from the <title>.';
    const title = ($('title').first().text() || '').trim() || 'Main Page Topic';
    snippets.push({
      label: 'Add an <h1>',
      language: 'html',
      code: `<h1>${htmlEscape(title)}</h1>`,
      location: 'Place near the top of the <body>, as the first heading.',
    });
    instructions.push('Use exactly one <h1> per page.');
    instructions.push('The <h1> should summarise the page topic and ideally contain the primary keyword.');
  } else if (h1Count > 1) {
    description = `Convert ${h1Count - 1} extra <h1> tags to <h2>.`;
    snippets.push({
      label: 'Example: convert extra H1 → H2',
      language: 'html',
      code: `<!-- Before -->\n<h1>Second heading</h1>\n\n<!-- After -->\n<h2>Second heading</h2>`,
      location: 'Inside <body>, for every <h1> after the first one.',
    });
    instructions.push('Keep only the first <h1>; change the rest to <h2>.');
  } else if (h2Count === 0) {
    description = 'Suggested <h2> subheadings to structure content.';
    snippets.push({
      label: 'Suggested H2 subheadings',
      language: 'html',
      code: `<h2>Overview</h2>\n<h2>Key Points</h2>\n<h2>How It Works</h2>\n<h2>Frequently Asked Questions</h2>`,
      location: 'Inside <body>, breaking up paragraphs into logical sections.',
    });
    instructions.push('Add <h2> subheadings every 200–300 words to improve readability.');
    instructions.push('Use keywords naturally inside subheadings where relevant.');
  } else {
    description = 'Heading structure already looks good.';
    return {
      checkId: 'headings',
      checkName: 'Heading Structure',
      status: 'already_ok',
      fixDescription: description,
      codeSnippets: [],
      instructions: [],
    };
  }

  instructions.push('Maintain a logical heading hierarchy: <h1> → <h2> → <h3>. Never skip levels.');

  return {
    checkId: 'headings',
    checkName: 'Heading Structure',
    status: 'fixed',
    fixDescription: description,
    codeSnippets: snippets,
    instructions,
  };
}

function fixViewport($: cheerio.CheerioAPI): SeoFix {
  const existing = ($('meta[name="viewport"]').attr('content') || '').trim();
  const code = `<meta name="viewport" content="width=device-width, initial-scale=1">`;

  if (existing === 'width=device-width, initial-scale=1') {
    return {
      checkId: 'mobile_friendly',
      checkName: 'Mobile Friendly',
      status: 'already_ok',
      fixDescription: 'Viewport meta tag is already correct.',
      codeSnippets: [],
      instructions: [],
    };
  }

  return {
    checkId: 'mobile_friendly',
    checkName: 'Mobile Friendly',
    status: 'fixed',
    fixDescription: 'Generated a correct viewport meta tag for responsive layout.',
    codeSnippets: [
      {
        label: 'Viewport meta tag',
        language: 'html',
        code,
        location: 'Inside <head>. Replace any existing viewport tag.',
      },
    ],
    instructions: [
      'Never disable user scaling (avoid user-scalable=no).',
      'Test on a real mobile device or with Chrome DevTools device emulation.',
    ],
  };
}

function fixCanonical(url: string, $: cheerio.CheerioAPI): SeoFix {
  const existing = ($('link[rel="canonical"]').attr('href') || '').trim();
  const canonicalUrl = url.split('#')[0];
  const code = `<link rel="canonical" href="${htmlEscape(canonicalUrl)}">`;

  if (existing === canonicalUrl) {
    return {
      checkId: 'indexability',
      checkName: 'Canonical Tag',
      status: 'already_ok',
      fixDescription: 'Canonical tag already points to the correct URL.',
      codeSnippets: [],
      instructions: [],
    };
  }

  return {
    checkId: 'indexability',
    checkName: 'Canonical Tag',
    status: 'fixed',
    fixDescription: 'Generated a canonical tag pointing to the current URL.',
    codeSnippets: [
      {
        label: 'Canonical link tag',
        language: 'html',
        code,
        location: 'Inside <head>. Replace any existing canonical tag.',
      },
    ],
    instructions: [
      'Use one canonical tag per page.',
      'Point to the absolute, preferred URL (HTTPS, lowercase, no query string if possible).',
      'Self-canonical is fine on canonical pages.',
    ],
  };
}

function fixOpenGraph(url: string, $: cheerio.CheerioAPI): SeoFix {
  const title = ($('title').first().text() || $('h1').first().text() || siteNameFromUrl(url)).trim();
  const description =
    ($('meta[name="description"]').attr('content') || firstParagraph($)).trim();
  const siteName = siteNameFromUrl(url);
  const canonical = url.split('#')[0];
  // Try to find a likely OG image
  let image = ($('meta[property="og:image"]').attr('content') || '').trim();
  if (!image) {
    image = ($('meta[name="twitter:image"]').attr('content') || '').trim();
  }
  if (!image) {
    const firstImg = $('img').first().attr('src') || '';
    if (firstImg) {
      try {
        image = new URL(firstImg, canonical).toString();
      } catch {
        image = firstImg;
      }
    }
  }
  if (!image) {
    image = `${safeOrigin(url)}/og-image.png`;
  }

  const ogTitle = truncate(title, 60);
  const ogDesc = truncate(description, 160);

  const code = `<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="${htmlEscape(siteName)}">
<meta property="og:title" content="${htmlEscape(ogTitle)}">
<meta property="og:description" content="${htmlEscape(ogDesc)}">
<meta property="og:url" content="${htmlEscape(canonical)}">
<meta property="og:image" content="${htmlEscape(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${htmlEscape(ogTitle)}">
<meta name="twitter:description" content="${htmlEscape(ogDesc)}">
<meta name="twitter:image" content="${htmlEscape(image)}">`;

  return {
    checkId: 'open_graph',
    checkName: 'Open Graph & Social',
    status: 'fixed',
    fixDescription: 'Generated complete Open Graph and Twitter Card tags.',
    codeSnippets: [
      {
        label: 'OG + Twitter Card tags',
        language: 'html',
        code,
        location: 'Inside <head>. Replace any existing OG / Twitter tags.',
      },
    ],
    instructions: [
      'Use an OG image of 1200×630 px, under 1 MB.',
      'Keep og:title under 60 and og:description under 160 characters.',
      'Test with https://developers.facebook.com/tools/debug/ and https://cards-dev.twitter.com/validator.',
    ],
  };
}

function fixImageAlt($: cheerio.CheerioAPI): SeoFix {
  const imgs = $('img').toArray();
  const missing: { src: string; suggestedAlt: string }[] = [];
  const empty: { src: string; suggestedAlt: string }[] = [];

  for (const el of imgs) {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt');
    const suggested = altFromFilename(src);
    if (alt === undefined) {
      missing.push({ src, suggestedAlt: suggested || 'Descriptive alt text' });
    } else if (alt.trim() === '' && !$(el).attr('role')) {
      // Empty alt is acceptable for decorative images; flag only if not marked decorative
      empty.push({ src, suggestedAlt: suggested || 'Descriptive alt text' });
    }
  }

  if (missing.length === 0 && empty.length === 0) {
    return {
      checkId: 'image_alt',
      checkName: 'Image Alt Text',
      status: 'already_ok',
      fixDescription: 'All images have alt text.',
      codeSnippets: [],
      instructions: [],
    };
  }

  const sample = [...missing, ...empty].slice(0, 5);
  const code = sample
    .map(
      (s) =>
        `<!-- Before -->\n<img src="${htmlEscape(s.src)}">\n<!-- After -->\n<img src="${htmlEscape(
          s.src
        )}" alt="${htmlEscape(s.suggestedAlt)}">`
    )
    .join('\n\n');

  return {
    checkId: 'image_alt',
    checkName: 'Image Alt Text',
    status: 'fixed',
    fixDescription: `Generated alt text suggestions for ${missing.length + empty.length} images from filenames.`,
    codeSnippets: [
      {
        label: 'Image alt text examples',
        language: 'html',
        code,
        location: 'On each <img> element in the page.',
      },
    ],
    instructions: [
      'Review the suggested alt text and rewrite to be descriptive where needed.',
      'Use empty alt="" only for purely decorative images.',
      'Avoid keyword stuffing — describe the image naturally.',
    ],
  };
}

function fixRobotsTxt(url: string): SeoFix {
  const origin = safeOrigin(url);
  const sitemapUrl = origin ? `${origin}/sitemap.xml` : 'https://example.com/sitemap.xml';
  const code = `User-agent: *
Allow: /

# Block crawling of internal search and admin if applicable
# Disallow: /admin/
# Disallow: /search?

Sitemap: ${sitemapUrl}`;

  return {
    checkId: 'robots_txt',
    checkName: 'Robots.txt',
    status: 'fixed',
    fixDescription: 'Generated a clean robots.txt that allows all crawlers and references the sitemap.',
    codeSnippets: [
      {
        label: 'robots.txt',
        language: 'text',
        code,
        location: 'Save as /robots.txt at the root of your site.',
      },
    ],
    instructions: [
      'Upload robots.txt to the site root (https://example.com/robots.txt).',
      'Only block paths that should not be indexed (admin, internal search, etc.).',
      'Always reference your sitemap URL with a "Sitemap:" line.',
    ],
  };
}

function fixSitemap(url: string, $: cheerio.CheerioAPI): SeoFix {
  const origin = safeOrigin(url);
  const canonical = url.split('#')[0];

  // Discover internal links to include
  const internalLinks = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const u = new URL(href, canonical);
      if (!origin || u.origin === origin) {
        internalLinks.add(u.toString().split('#')[0]);
      }
    } catch {
      /* ignore */
    }
  });

  const urls = Array.from(internalLinks).slice(0, 50);
  const today = new Date().toISOString().slice(0, 10);

  const urlEntries = urls
    .map(
      (u) => `  <url>
    <loc>${htmlEscape(u)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('\n');

  const code = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${
  urlEntries ||
  `  <url>
    <loc>${htmlEscape(canonical)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`
}
</urlset>`;

  return {
    checkId: 'sitemap',
    checkName: 'Sitemap',
    status: 'fixed',
    fixDescription: `Generated a sitemap.xml with ${urls.length || 1} URL${
      urls.length === 1 ? '' : 's'
    } discovered from this page.`,
    codeSnippets: [
      {
        label: 'sitemap.xml',
        language: 'xml',
        code,
        location: 'Save as /sitemap.xml at the root of your site.',
      },
    ],
    instructions: [
      'Upload sitemap.xml to the site root.',
      'Reference it from robots.txt with "Sitemap: ' + (origin || 'https://example.com') + '/sitemap.xml".',
      'Submit it in Google Search Console and Bing Webmaster Tools.',
      'Regenerate the sitemap whenever you publish or remove content.',
    ],
  };
}

function fixUrlStructure(url: string): SeoFix {
  let u: URL | null = null;
  try {
    u = new URL(url);
  } catch {
    u = null;
  }

  if (!u) {
    return {
      checkId: 'url_structure',
      checkName: 'URL Structure',
      status: 'cannot_fix',
      fixDescription: 'URL could not be parsed.',
      codeSnippets: [],
      instructions: ['Provide a valid absolute URL.'],
    };
  }

  const cleanPath = u.pathname
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-\/\.]/g, '')
    .replace(/-+/g, '-')
    .replace(/\/+/g, '/');
  const cleanUrl = `${u.protocol}//${u.hostname}${cleanPath}`;

  const httpsRedirect = `# Force HTTPS + www→non-www (Apache / .htaccess)
RewriteEngine On
RewriteCond %{HTTPS} off [OR]
RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]
RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]

# Redirect old URL to clean URL (example)
RewriteRule ^old-page$ ${cleanPath || '/'} [R=301,L]`;

  const nginxConf = `# Nginx: force HTTPS and clean URLs
server {
  listen 80;
  server_name ${u.hostname};
  return 301 https://$host$request_uri;
}`;

  return {
    checkId: 'url_structure',
    checkName: 'URL Structure',
    status: 'fixed',
    fixDescription: `Recommended a clean URL: ${cleanUrl}`,
    codeSnippets: [
      {
        label: 'Recommended clean URL',
        language: 'text',
        code: cleanUrl,
        location: 'Use this URL pattern for new pages.',
      },
      {
        label: 'Apache .htaccess — HTTPS + clean redirects',
        language: 'apache',
        code: httpsRedirect,
        location: 'Save as .htaccess in the site root (Apache only).',
      },
      {
        label: 'Nginx — HTTPS redirect',
        language: 'nginx',
        code: nginxConf,
        location: 'Add to your Nginx server block configuration.',
      },
    ],
    instructions: [
      'Use lowercase, hyphen-separated slugs only.',
      'Avoid query parameters for indexable pages — use clean paths instead.',
      'Keep URL paths shallow (≤ 3–4 segments).',
      'Set up 301 redirects from any old URLs to the new clean URL.',
    ],
  };
}

function fixRobotsMeta($: cheerio.CheerioAPI): SeoFix {
  const existing = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  if (existing.includes('noindex')) {
    const code = `<!-- Allow indexing -->
<meta name="robots" content="index, follow">`;
    return {
      checkId: 'indexability',
      checkName: 'Robots Meta',
      status: 'fixed',
      fixDescription: 'Removed the noindex directive and generated an index, follow tag.',
      codeSnippets: [
        {
          label: 'Robots meta tag (indexable)',
          language: 'html',
          code,
          location: 'Inside <head>. Replace the existing meta robots tag.',
        },
      ],
      instructions: [
        'Use "index, follow" for pages you want crawled and indexed.',
        'Reserve "noindex, follow" for thank-you pages, internal search results, etc.',
        'Check X-Robots-Tag headers in your server config as well.',
      ],
    };
  }

  // Default — provide a healthy robots meta for any page
  const code = `<meta name="robots" content="index, follow">`;
  return {
    checkId: 'indexability',
    checkName: 'Robots Meta',
    status: 'fixed',
    fixDescription: 'Generated a default indexable robots meta tag.',
    codeSnippets: [
      {
        label: 'Robots meta tag',
        language: 'html',
        code,
        location: 'Inside <head>.',
      },
    ],
    instructions: [
      'Add this tag if no robots meta is present.',
      'Use "noindex, follow" for pages that should not be indexed but should still be crawled.',
    ],
  };
}

function cannotFixInstructions(
  checkId: string,
  checkName: string,
  description: string,
  instructions: string[]
): SeoFix {
  return {
    checkId,
    checkName,
    status: 'cannot_fix',
    fixDescription: description,
    codeSnippets: [],
    instructions,
  };
}

// ============================================================
// Main fixer
// ============================================================

export function generateSeoFixes(opts: FixerOptions): FixResult {
  const { url, html, checks } = opts;

  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html || '');
  } catch {
    $ = cheerio.load('');
  }

  const fixes: SeoFix[] = [];
  const generatedFiles: GeneratedFiles = {};
  const seen = new Set<string>();

  // Order matters: we want robots.txt and sitemap to be generated and stored
  const orderedIds = [
    'title',
    'meta_description',
    'headings',
    'mobile_friendly',
    'indexability',
    'open_graph',
    'image_alt',
    'robots_txt',
    'sitemap',
    'url_structure',
    'broken_links',
    'page_speed',
    'content_quality',
  ];

  // Build a quick lookup of check statuses
  const statusById = new Map<string, SeoCheck>();
  for (const c of checks) statusById.set(c.checkId, c);

  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const check = statusById.get(id);

    // If the check passed and is not in our cannot_fix list, mark already_ok
    if (check && check.status === 'pass') {
      // For some checks we still want to offer a snippet (e.g. canonical)
      // but if the check passed we mark already_ok
      fixes.push({
        checkId: id,
        checkName: check.name,
        status: 'already_ok',
        fixDescription: `${check.name} is already in good shape.`,
        codeSnippets: [],
        instructions: [],
      });
      continue;
    }

    switch (id) {
      case 'title':
        fixes.push(fixTitle($, url));
        break;
      case 'meta_description':
        fixes.push(fixMetaDescription($));
        break;
      case 'headings':
        fixes.push(fixHeadings($));
        break;
      case 'mobile_friendly':
        fixes.push(fixViewport($));
        break;
      case 'indexability': {
        // Provide both canonical and robots meta fixes
        const canonicalFix = fixCanonical(url, $);
        const robotsMetaFix = fixRobotsMeta($);
        // If canonical was already_ok but robots meta needs a fix, push robots meta
        if (canonicalFix.status !== 'already_ok') {
          fixes.push(canonicalFix);
        } else if (check && check.status !== 'pass') {
          fixes.push(robotsMetaFix);
        } else {
          fixes.push(canonicalFix);
        }
        // Only push the robots meta fix if the canonical one was already_ok
        if (canonicalFix.status === 'already_ok' && (!check || check.status !== 'pass')) {
          // robots meta already pushed above
        }
        break;
      }
      case 'open_graph':
        fixes.push(fixOpenGraph(url, $));
        break;
      case 'image_alt':
        fixes.push(fixImageAlt($));
        break;
      case 'robots_txt': {
        const f = fixRobotsTxt(url);
        generatedFiles.robotsTxt = f.codeSnippets[0]?.code;
        fixes.push(f);
        break;
      }
      case 'sitemap': {
        const f = fixSitemap(url, $);
        generatedFiles.sitemapXml = f.codeSnippets[0]?.code;
        fixes.push(f);
        break;
      }
      case 'url_structure':
        fixes.push(fixUrlStructure(url));
        break;
      case 'broken_links':
        fixes.push(
          cannotFixInstructions(
            'broken_links',
            'Broken Links',
            'Broken links cannot be auto-fixed — you need to update or remove each link manually.',
            [
              'For each broken link, either: fix the URL, replace it with a working one, or remove the link.',
              'If a page moved, add a 301 redirect from the old URL to the new one.',
              'Re-run the audit after fixing to confirm.',
            ]
          )
        );
        break;
      case 'page_speed':
        fixes.push(
          cannotFixInstructions(
            'page_speed',
            'Page Speed',
            'Page speed requires runtime/build optimisations that cannot be patched in static HTML.',
            [
              'Compress and convert images to WebP/AVIF.',
              'Defer or async non-critical JavaScript.',
              'Enable HTTP/2, Brotli/Gzip compression, and browser caching on the server.',
              'Reduce third-party scripts and use a CDN.',
              'Target LCP < 2.5s, CLS < 0.1, INP < 200ms.',
            ]
          )
        );
        break;
      case 'content_quality':
        fixes.push(
          cannotFixInstructions(
            'content_quality',
            'Content Quality',
            'Content quality needs human editing — auto-generation would hurt your brand.',
            [
              'Expand thin pages to 600+ words with original research, examples, and FAQs.',
              'Break long sentences into shorter ones (target ≤ 20 words/sentence).',
              'Use the AI Content Writer to draft longer, well-structured content.',
              'Ensure content directly answers the user intent behind the target query.',
            ]
          )
        );
        break;
      default:
        break;
    }
  }

  // Deduplicate indexability fixes that might have been pushed twice
  const deduped: SeoFix[] = [];
  const seenFix = new Set<string>();
  for (const f of fixes) {
    const key = `${f.checkId}|${f.status}`;
    if (seenFix.has(key)) continue;
    seenFix.add(key);
    deduped.push(f);
  }

  const summary: SeoFixSummary = {
    total: deduped.length,
    fixed: deduped.filter((f) => f.status === 'fixed').length,
    cannotFix: deduped.filter((f) => f.status === 'cannot_fix').length,
    alreadyOk: deduped.filter((f) => f.status === 'already_ok').length,
  };

  return {
    url,
    fixes: deduped,
    generatedFiles,
    summary,
  };
}
