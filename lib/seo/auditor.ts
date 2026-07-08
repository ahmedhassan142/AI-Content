import * as cheerio from 'cheerio';

// ============================================================
// Types
// ============================================================

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface SeoCheck {
  checkId: string;
  name: string;
  status: CheckStatus;
  score: number;
  message: string;
  details?: Record<string, unknown>;
  recommendation?: string;
}

export interface ActionPlanItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  checkId: string;
}

export interface AuditResult {
  url: string;
  normalizedUrl: string;
  finalUrl?: string;
  httpStatus?: number;
  responseTimeMs?: number;
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  warnedChecks: number;
  failedChecks: number;
  checks: SeoCheck[];
  actionPlan: ActionPlanItem[];
  html?: string;
  error?: string;
}

export interface AuditOptions {
  url: string;
  fastMode?: boolean;
}

// ============================================================
// Constants
// ============================================================

const USER_AGENT =
  'Mozilla/5.0 (compatible; AIContentSeoBot/1.0; +https://ai-content.app/bot)';

const FETCH_TIMEOUT_MS = 15000;
const LINK_CHECK_TIMEOUT_MS = 8000;
const MAX_LINKS_TO_CHECK = 20;

const CHECK_WEIGHTS: Record<string, number> = {
  title: 0.12,
  meta_description: 0.1,
  headings: 0.08,
  url_structure: 0.08,
  image_alt: 0.06,
  robots_txt: 0.06,
  sitemap: 0.06,
  broken_links: 0.1,
  indexability: 0.1,
  page_speed: 0.1,
  mobile_friendly: 0.06,
  open_graph: 0.04,
  content_quality: 0.04,
};

// Sanity check: weights should sum to 1.0
// 0.12 + 0.10 + 0.08 + 0.08 + 0.06 + 0.06 + 0.06 + 0.10 + 0.10 + 0.10 + 0.06 + 0.04 + 0.04 = 1.00

// ============================================================
// URL Helpers
// ============================================================

export function normalizeUrl(input: string): string {
  let trimmed = (input || '').trim();
  if (!trimmed) return '';

  // Strip whitespace and accidental wrappers
  trimmed = trimmed.replace(/^["'`]+|["'`]+$/g, '');

  // Prepend https:// if no protocol is present
  if (!/^https?:\/\//i.test(trimmed)) {
    // If user typed something like "example.com/path"
    trimmed = `https://${trimmed}`;
  }

  try {
    const u = new URL(trimmed);
    // Force lowercase host
    u.hostname = u.hostname.toLowerCase();
    // Remove default ports
    if (
      (u.protocol === 'http:' && u.port === '80') ||
      (u.protocol === 'https:' && u.port === '443')
    ) {
      u.port = '';
    }
    // Remove fragment
    u.hash = '';
    // Remove trailing slash from root path
    if (u.pathname === '/') {
      u.pathname = '';
    }
    return u.toString();
  } catch {
    return trimmed;
  }
}

// ============================================================
// Fetch helper
// ============================================================

interface FetchPageResult {
  ok: boolean;
  status: number;
  statusText: string;
  finalUrl: string;
  html: string;
  headers: Record<string, string>;
  responseTimeMs: number;
  error?: string;
}

async function fetchPage(url: string): Promise<FetchPageResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    const responseTimeMs = Date.now() - start;
    const contentType = res.headers.get('content-type') || '';
    const finalUrl = res.url || url;

    let html = '';
    if (contentType.includes('text/html') || contentType.includes('xml')) {
      html = await res.text();
    } else {
      // Try anyway
      try {
        html = await res.text();
      } catch {
        html = '';
      }
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      finalUrl,
      html,
      headers,
      responseTimeMs,
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      statusText: 'Fetch failed',
      finalUrl: url,
      html: '',
      headers: {},
      responseTimeMs,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRaw(url: string, asText = true): Promise<{ ok: boolean; status: number; text: string; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = asText ? await res.text() : '';
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return { ok: res.ok, status: res.status, text, headers };
  } catch {
    return { ok: false, status: 0, text: '', headers: {} };
  } finally {
    clearTimeout(timer);
  }
}

async function headCheck(url: string): Promise<{ ok: boolean; status: number; method: 'HEAD' | 'GET' }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);

  // Try HEAD first
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (res.status !== 405 && res.status !== 403 && res.status !== 501) {
      return { ok: res.ok, status: res.status, method: 'HEAD' };
    }
  } catch {
    // fall through to GET
  } finally {
    clearTimeout(timer);
  }

  // Fallback to GET with a tiny range
  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), LINK_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Range: 'bytes=0-0',
      },
      redirect: 'follow',
      signal: controller2.signal,
    });
    return { ok: res.ok, status: res.status, method: 'GET' };
  } catch {
    return { ok: false, status: 0, method: 'GET' };
  } finally {
    clearTimeout(timer2);
  }
}

// ============================================================
// Scoring helpers
// ============================================================

function statusFromScore(score: number): CheckStatus {
  if (score >= 80) return 'pass';
  if (score >= 50) return 'warn';
  return 'fail';
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

// ============================================================
// Check functions
// ============================================================

function checkTitle($: cheerio.CheerioAPI): SeoCheck {
  const title = ($('title').first().text() || '').trim();
  const ogTitle = ($('meta[property="og:title"]').attr('content') || '').trim();
  const len = title.length;

  let status: CheckStatus;
  let score: number;
  let message: string;
  let recommendation: string;

  if (!title) {
    status = 'fail';
    score = 0;
    message = 'No <title> tag found.';
    recommendation = 'Add a descriptive <title> tag in the <head>. Ideal length is 50–60 characters.';
  } else if (len < 30) {
    status = 'warn';
    score = 55;
    message = `Title is too short (${len} chars).`;
    recommendation = 'Aim for 50–60 characters to fully use SERP real estate without truncation.';
  } else if (len > 60) {
    status = 'warn';
    score = 60;
    message = `Title is too long (${len} chars) — likely truncated in search results.`;
    recommendation = 'Shorten the title to 50–60 characters. Move branding to the end if needed.';
  } else {
    status = 'pass';
    score = 100;
    message = `Title length is optimal (${len} chars).`;
    recommendation = '';
  }

  return {
    checkId: 'title',
    name: 'Title Tag',
    status,
    score: clampScore(score),
    message,
    details: { title, length: len, ogTitle: ogTitle || undefined },
    recommendation: recommendation || undefined,
  };
}

function checkMetaDescription($: cheerio.CheerioAPI): SeoCheck {
  const desc = ($('meta[name="description"]').attr('content') || '').trim();
  const len = desc.length;

  let status: CheckStatus;
  let score: number;
  let message: string;
  let recommendation: string;

  if (!desc) {
    status = 'fail';
    score = 0;
    message = 'No meta description found.';
    recommendation = 'Add a <meta name="description"> tag of 120–160 characters that summarises the page.';
  } else if (len < 70) {
    status = 'warn';
    score = 55;
    message = `Meta description is too short (${len} chars).`;
    recommendation = 'Expand to 120–160 characters to improve click-through rate.';
  } else if (len > 160) {
    status = 'warn';
    score = 65;
    message = `Meta description is too long (${len} chars) — will be truncated.`;
    recommendation = 'Trim to 120–160 characters.';
  } else {
    status = 'pass';
    score = 100;
    message = `Meta description length is optimal (${len} chars).`;
    recommendation = '';
  }

  return {
    checkId: 'meta_description',
    name: 'Meta Description',
    status,
    score: clampScore(score),
    message,
    details: { description: desc, length: len },
    recommendation: recommendation || undefined,
  };
}

function checkHeadings($: cheerio.CheerioAPI): SeoCheck {
  const h1s = $('h1').toArray().map((el) => $(el).text().trim());
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  let status: CheckStatus;
  let score: number;
  let message: string;
  let recommendation: string;

  if (h1s.length === 0) {
    status = 'fail';
    score = 20;
    message = 'No <h1> tag found.';
    recommendation = 'Add exactly one <h1> that describes the page topic.';
  } else if (h1s.length > 1) {
    status = 'warn';
    score = 60;
    message = `Multiple <h1> tags found (${h1s.length}).`;
    recommendation = 'Keep only one <h1> per page; demote the rest to <h2>.';
  } else if (h2Count === 0) {
    status = 'warn';
    score = 70;
    message = 'Single <h1> present, but no <h2> subheadings.';
    recommendation = 'Add <h2> subheadings to structure content for users and crawlers.';
  } else {
    status = 'pass';
    score = 100;
    message = `Exactly one <h1>, with ${h2Count} <h2> and ${h3Count} <h3> subheadings.`;
    recommendation = '';
  }

  return {
    checkId: 'headings',
    name: 'Heading Structure',
    status,
    score: clampScore(score),
    message,
    details: { h1Count: h1s.length, h1s, h2Count, h3Count },
    recommendation: recommendation || undefined,
  };
}

function checkUrlStructure(url: string): SeoCheck {
  let u: URL | null = null;
  try {
    u = new URL(url);
  } catch {
    /* ignore */
  }

  if (!u) {
    return {
      checkId: 'url_structure',
      name: 'URL Structure',
      status: 'fail',
      score: 0,
      message: 'URL could not be parsed.',
      recommendation: 'Provide a valid, absolute URL.',
    };
  }

  const issues: string[] = [];
  const isHttps = u.protocol === 'https:';
  if (!isHttps) issues.push('Not using HTTPS');

  const hasUppercase = /[A-Z]/.test(u.pathname);
  if (hasUppercase) issues.push('Contains uppercase letters in path');

  const usesUnderscores = /_/.test(u.pathname);
  if (usesUnderscores) issues.push('Uses underscores instead of hyphens');

  const hasQuery = u.search.length > 0;
  if (hasQuery) issues.push('Contains query parameters (consider clean URLs)');

  const tooLong = u.pathname.length > 75;
  if (tooLong) issues.push('URL path is very long (>75 chars)');

  const deepNesting = (u.pathname.match(/\//g) || []).length > 5;
  if (deepNesting) issues.push('Deep nesting (>5 path segments)');

  if (issues.length === 0) {
    return {
      checkId: 'url_structure',
      name: 'URL Structure',
      status: 'pass',
      score: 100,
      message: 'URL is clean, HTTPS, lowercase, and uses hyphens.',
      details: { protocol: u.protocol, pathname: u.pathname },
    };
  }

  const score = Math.max(20, 100 - issues.length * 18);
  return {
    checkId: 'url_structure',
    name: 'URL Structure',
    status: issues.length >= 3 ? 'fail' : 'warn',
    score: clampScore(score),
    message: `URL issues: ${issues.join('; ')}.`,
    details: { protocol: u.protocol, pathname: u.pathname, issues },
    recommendation:
      'Use HTTPS, lowercase, hyphen-separated slugs, avoid query strings for crawlable content, and keep paths shallow.',
  };
}

function checkImageAlt($: cheerio.CheerioAPI): SeoCheck {
  const imgs = $('img').toArray();
  const total = imgs.length;
  if (total === 0) {
    return {
      checkId: 'image_alt',
      name: 'Image Alt Text',
      status: 'pass',
      score: 100,
      message: 'No images on this page.',
      details: { totalImages: 0, missingAlt: 0 },
    };
  }

  const missing: { src: string }[] = [];
  let emptyAlt = 0;
  for (const el of imgs) {
    const alt = $(el).attr('alt');
    const src = $(el).attr('src') || '';
    if (alt === undefined) {
      missing.push({ src });
    } else if (alt.trim() === '') {
      emptyAlt++;
    }
  }

  const missingCount = missing.length;
  const pctOk = ((total - missingCount - emptyAlt) / total) * 100;

  let status: CheckStatus;
  let score: number;
  let message: string;
  let recommendation: string;

  if (missingCount === 0 && emptyAlt === 0) {
    status = 'pass';
    score = 100;
    message = `All ${total} images have descriptive alt text.`;
    recommendation = '';
  } else if (pctOk >= 80) {
    status = 'warn';
    score = Math.round(pctOk);
    message = `${missingCount + emptyAlt} of ${total} images have missing or empty alt text.`;
    recommendation = 'Add descriptive alt text to remaining images. Use empty alt="" only for purely decorative images.';
  } else {
    status = 'fail';
    score = Math.round(pctOk);
    message = `${missingCount + emptyAlt} of ${total} images have missing or empty alt text.`;
    recommendation = 'Add meaningful alt attributes to all content images for accessibility and SEO.';
  }

  return {
    checkId: 'image_alt',
    name: 'Image Alt Text',
    status,
    score: clampScore(score),
    message,
    details: { totalImages: total, missingAlt: missingCount, emptyAlt, missingSample: missing.slice(0, 10) },
    recommendation: recommendation || undefined,
  };
}

async function checkRobotsTxt(origin: string): Promise<SeoCheck> {
  const url = `${origin}/robots.txt`;
  const { ok, status, text } = await fetchRaw(url);

  if (!ok && status === 404) {
    return {
      checkId: 'robots_txt',
      name: 'Robots.txt',
      status: 'warn',
      score: 40,
      message: 'robots.txt is missing (404).',
      details: { url, status },
      recommendation: 'Add a /robots.txt file that references your sitemap and sets sensible crawl rules.',
    };
  }

  if (!ok) {
    return {
      checkId: 'robots_txt',
      name: 'Robots.txt',
      status: 'fail',
      score: 0,
      message: `Failed to fetch robots.txt (HTTP ${status}).`,
      details: { url, status },
      recommendation: 'Make sure /robots.txt is publicly accessible.',
    };
  }

  const blocksAll = /disallow:\s*\/\s*$/im.test(text) && !/allow:\s*\//im.test(text);
  const hasSitemapRef = /sitemap:\s*https?:\/\//i.test(text);
  const hasUserAgent = /user-agent:/i.test(text);

  const issues: string[] = [];
  if (blocksAll) issues.push('Blocks all crawlers (Disallow: /)');
  if (!hasUserAgent) issues.push('No User-agent directive');
  if (!hasSitemapRef) issues.push('No Sitemap reference');

  if (issues.length === 0) {
    return {
      checkId: 'robots_txt',
      name: 'Robots.txt',
      status: 'pass',
      score: 100,
      message: 'robots.txt present, references a sitemap, and does not block all crawlers.',
      details: { url, hasSitemapRef, blocksAll },
    };
  }

  const score = Math.max(30, 100 - issues.length * 25);
  return {
    checkId: 'robots_txt',
    name: 'Robots.txt',
    status: blocksAll ? 'fail' : 'warn',
    score: clampScore(score),
    message: `robots.txt issues: ${issues.join('; ')}.`,
    details: { url, hasSitemapRef, blocksAll, issues },
    recommendation:
      'Include "User-agent: *", avoid blocking important paths, and add a "Sitemap:" line pointing to your sitemap.',
  };
}

async function checkSitemap(origin: string): Promise<SeoCheck> {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/sitemap.txt`,
  ];

  for (const url of candidates) {
    const { ok, status, text } = await fetchRaw(url);
    if (ok && text) {
      const urlCount = (text.match(/<url>/gi) || []).length;
      const looksXml = text.includes('<') && (text.includes('urlset') || text.includes('sitemapindex'));
      const looksTxt = text.split('\n').some((l) => l.trim().startsWith('http'));
      if (looksXml || looksTxt) {
        return {
          checkId: 'sitemap',
          name: 'Sitemap',
          status: 'pass',
          score: 100,
          message: `Sitemap found at ${url.replace(origin, '')}.`,
          details: { url, status, urlCount, format: looksXml ? 'xml' : 'txt' },
        };
      }
    } else if (status > 0 && status !== 404) {
      // Some other error — keep trying
    }
  }

  return {
    checkId: 'sitemap',
    name: 'Sitemap',
    status: 'warn',
    score: 30,
    message: 'No sitemap found at common locations.',
    details: { checked: candidates },
    recommendation: 'Generate a sitemap.xml, place it at the site root, and reference it in robots.txt and Google Search Console.',
  };
}

async function checkBrokenLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Promise<SeoCheck> {
  let base: URL | null = null;
  try {
    base = new URL(baseUrl);
  } catch {
    base = null;
  }

  const rawLinks = $('a[href]')
    .toArray()
    .map((el) => $(el).attr('href') || '')
    .filter(Boolean);

  const absoluteLinks = new Set<string>();
  for (const href of rawLinks) {
    try {
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
        continue;
      }
      let abs: string;
      if (base) {
        abs = new URL(href, base).toString();
      } else {
        if (!/^https?:\/\//i.test(href)) continue;
        abs = href;
      }
      absoluteLinks.add(abs.split('#')[0]);
    } catch {
      /* ignore malformed */
    }
  }

  const all = Array.from(absoluteLinks);
  if (all.length === 0) {
    return {
      checkId: 'broken_links',
      name: 'Broken Links',
      status: 'pass',
      score: 100,
      message: 'No anchor links found on this page.',
      details: { totalLinks: 0 },
    };
  }

  // Sample evenly across internal + external
  const internal = all.filter((l) => {
    try {
      return new URL(l).hostname === base?.hostname;
    } catch {
      return false;
    }
  });
  const external = all.filter((l) => !internal.includes(l));

  const sample: string[] = [];
  const take = (arr: string[], n: number) => {
    const step = Math.max(1, Math.floor(arr.length / n));
    for (let i = 0; i < arr.length && sample.length < MAX_LINKS_TO_CHECK; i += step) {
      sample.push(arr[i]);
    }
  };
  take(internal, Math.ceil(MAX_LINKS_TO_CHECK / 2));
  take(external, Math.ceil(MAX_LINKS_TO_CHECK / 2));

  const results = await Promise.all(sample.map(async (link) => {
    const r = await headCheck(link);
    return { link, ...r };
  }));

  const broken = results.filter(
    (r) => !r.ok && (r.status === 0 || r.status >= 400 || r.status === 404)
  );

  const checkedCount = results.length;
  const brokenPct = checkedCount ? (broken.length / checkedCount) * 100 : 0;

  let status: CheckStatus;
  let score: number;
  if (broken.length === 0) {
    status = 'pass';
    score = 100;
  } else if (brokenPct <= 10) {
    status = 'warn';
    score = Math.round(100 - brokenPct * 3);
  } else {
    status = 'fail';
    score = Math.max(10, Math.round(100 - brokenPct * 3));
  }

  return {
    checkId: 'broken_links',
    name: 'Broken Links',
    status,
    score: clampScore(score),
    message:
      broken.length === 0
        ? `Checked ${checkedCount} of ${all.length} links — all reachable.`
        : `${broken.length} of ${checkedCount} sampled links are broken (HTTP 4xx/5xx or unreachable).`,
    details: {
      totalLinks: all.length,
      internalLinks: internal.length,
      externalLinks: external.length,
      checkedCount,
      brokenSample: broken.slice(0, 10).map((b) => ({ url: b.link, status: b.status })),
    },
    recommendation:
      broken.length > 0
        ? 'Fix or remove broken links. Use 301 redirects for moved content and remove links to deleted pages.'
        : undefined,
  };
}

function checkIndexability(
  $: cheerio.CheerioAPI,
  headers: Record<string, string>,
  finalUrl: string
): SeoCheck {
  const metaRobots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  const xRobotsTag = (headers['x-robots-tag'] || '').toLowerCase();
  const canonical = ($('link[rel="canonical"]').attr('href') || '').trim();
  const noindexMeta = metaRobots.includes('noindex');
  const nofollowMeta = metaRobots.includes('nofollow');
  const noindexHeader = xRobotsTag.includes('noindex');

  let canonicalOk = true;
  let canonicalNote = '';
  if (canonical) {
    try {
      const cu = new URL(canonical, finalUrl);
      const fu = new URL(finalUrl);
      if (cu.toString() !== fu.toString()) {
        canonicalOk = false;
        canonicalNote = `Canonical points to ${cu.toString()} (differs from current URL).`;
      }
    } catch {
      canonicalOk = false;
      canonicalNote = 'Canonical URL is malformed.';
    }
  }

  if (noindexMeta || noindexHeader) {
    return {
      checkId: 'indexability',
      name: 'Indexability',
      status: 'fail',
      score: 0,
      message: noindexMeta
        ? 'Page is blocked from indexing via <meta name="robots" content="noindex">.'
        : 'Page is blocked from indexing via X-Robots-Tag header.',
      details: { metaRobots, xRobotsTag, canonical, canonicalOk },
      recommendation: 'Remove the noindex directive if you want this page to appear in search results.',
    };
  }

  if (!canonical) {
    return {
      checkId: 'indexability',
      name: 'Indexability',
      status: 'warn',
      score: 60,
      message: 'Page is indexable but has no canonical tag.',
      details: { metaRobots, xRobotsTag, canonical: null, nofollow: nofollowMeta },
      recommendation: 'Add <link rel="canonical" href="..."> to prevent duplicate-content issues.',
    };
  }

  if (!canonicalOk) {
    return {
      checkId: 'indexability',
      name: 'Indexability',
      status: 'warn',
      score: 70,
      message: canonicalNote,
      details: { metaRobots, xRobotsTag, canonical, canonicalOk },
      recommendation: 'Ensure the canonical URL matches the page URL, or update the canonical intentionally.',
    };
  }

  return {
    checkId: 'indexability',
    name: 'Indexability',
    status: 'pass',
    score: 100,
    message: 'Page is indexable and has a valid canonical tag.',
    details: { metaRobots: metaRobots || null, xRobotsTag: xRobotsTag || null, canonical, nofollow: nofollowMeta },
  };
}

async function checkPageSpeed(url: string): Promise<SeoCheck> {
  const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url
  )}&strategy=mobile&category=performance&category=seo`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(psiUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      let note = `PageSpeed Insights API returned HTTP ${res.status}`;
      if (res.status === 429) note += ' (rate limit).';
      return {
        checkId: 'page_speed',
        name: 'Page Speed',
        status: 'warn',
        score: 50,
        message: note,
        details: { psiUrl, status: res.status },
        recommendation: 'Try again later or run a manual test at https://pagespeed.web.dev/.',
      };
    }

    const data = await res.json();
    const perfScore = data?.lighthouseResult?.categories?.performance?.score;
    const seoScore = data?.categories?.seo?.score;
    const audits = data?.lighthouseResult?.audits || {};
    const fcp = audits['first-contentful-paint']?.displayValue;
    const lcp = audits['largest-contentful-paint']?.displayValue;
    const cls = audits['cumulative-layout-shift']?.displayValue;
    const tbt = audits['total-blocking-time']?.displayValue;

    if (typeof perfScore !== 'number') {
      return {
        checkId: 'page_speed',
        name: 'Page Speed',
        status: 'warn',
        score: 50,
        message: 'PageSpeed Insights did not return a performance score.',
        details: { psiUrl },
        recommendation: 'Run a manual test at https://pagespeed.web.dev/.',
      };
    }

    const score0to100 = Math.round(perfScore * 100);
    const status = statusFromScore(score0to100);

    return {
      checkId: 'page_speed',
      name: 'Page Speed',
      status,
      score: clampScore(score0to100),
      message: `Performance score: ${score0to100}/100 (mobile). LCP ${lcp || 'n/a'}, FCP ${fcp || 'n/a'}, CLS ${cls || 'n/a'}, TBT ${tbt || 'n/a'}.`,
      details: {
        performanceScore: score0to100,
        seoScore: typeof seoScore === 'number' ? Math.round(seoScore * 100) : null,
        metrics: { fcp, lcp, cls, tbt },
      },
      recommendation:
        score0to100 < 80
          ? 'Optimise images, defer non-critical JS, and reduce server response time. Target a performance score of 90+.'
          : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      checkId: 'page_speed',
      name: 'Page Speed',
      status: 'warn',
      score: 50,
      message: `PageSpeed Insights request failed: ${message}`,
      details: { psiUrl },
      recommendation: 'Retry later. You can also test manually at https://pagespeed.web.dev/.',
    };
  }
}

function checkMobileFriendly($: cheerio.CheerioAPI): SeoCheck {
  const viewport = ($('meta[name="viewport"]').attr('content') || '').trim();

  if (!viewport) {
    return {
      checkId: 'mobile_friendly',
      name: 'Mobile Friendly',
      status: 'fail',
      score: 0,
      message: 'No viewport meta tag found.',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> in the <head>.',
    };
  }

  const hasWidth = /width\s*=\s*device-width/i.test(viewport);
  const hasInitialScale = /initial-scale\s*=\s*1/i.test(viewport);
  const userScalableNo = /user-scalable\s*=\s*no/i.test(viewport);
  const maximumScale1 = /maximum-scale\s*=\s*1(\.0)?/i.test(viewport);

  if (!hasWidth) {
    return {
      checkId: 'mobile_friendly',
      name: 'Mobile Friendly',
      status: 'fail',
      score: 30,
      message: 'Viewport meta tag does not use width=device-width.',
      details: { viewport },
      recommendation: 'Use <meta name="viewport" content="width=device-width, initial-scale=1">.',
    };
  }

  if (userScalableNo || maximumScale1) {
    return {
      checkId: 'mobile_friendly',
      name: 'Mobile Friendly',
      status: 'warn',
      score: 70,
      message: 'Viewport tag disables user scaling — hurts accessibility.',
      details: { viewport },
      recommendation: 'Remove user-scalable=no and maximum-scale=1 to allow pinch-to-zoom.',
    };
  }

  if (!hasInitialScale) {
    return {
      checkId: 'mobile_friendly',
      name: 'Mobile Friendly',
      status: 'warn',
      score: 80,
      message: 'Viewport tag is missing initial-scale=1.',
      details: { viewport },
      recommendation: 'Add initial-scale=1 to the viewport meta tag.',
    };
  }

  return {
    checkId: 'mobile_friendly',
    name: 'Mobile Friendly',
    status: 'pass',
    score: 100,
    message: 'Viewport meta tag is correctly configured for mobile.',
    details: { viewport },
  };
}

function checkOpenGraph($: cheerio.CheerioAPI, finalUrl: string): SeoCheck {
  const ogTitle = ($('meta[property="og:title"]').attr('content') || '').trim();
  const ogDesc = ($('meta[property="og:description"]').attr('content') || '').trim();
  const ogImage = ($('meta[property="og:image"]').attr('content') || '').trim();
  const ogUrl = ($('meta[property="og:url"]').attr('content') || '').trim();
  const ogType = ($('meta[property="og:type"]').attr('content') || '').trim();
  const twitterCard = ($('meta[name="twitter:card"]').attr('content') || '').trim();
  const twitterTitle = ($('meta[name="twitter:title"]').attr('content') || '').trim();
  const twitterDesc = ($('meta[name="twitter:description"]').attr('content') || '').trim();
  const twitterImage = ($('meta[name="twitter:image"]').attr('content') || '').trim();

  const required = ['og:title', 'og:description', 'og:image', 'og:url'];
  const present = {
    'og:title': !!ogTitle,
    'og:description': !!ogDesc,
    'og:image': !!ogImage,
    'og:url': !!ogUrl,
  };
  const missing = required.filter((k) => !present[k as keyof typeof present]);

  let status: CheckStatus;
  let score: number;
  let message: string;
  let recommendation: string;

  if (missing.length === 0 && twitterCard) {
    status = 'pass';
    score = 100;
    message = 'All Open Graph and Twitter Card tags are present.';
    recommendation = '';
  } else if (missing.length === 0) {
    status = 'warn';
    score = 80;
    message = 'Open Graph tags present but missing Twitter Card.';
    recommendation = 'Add <meta name="twitter:card" content="summary_large_image"> and related Twitter tags.';
  } else if (missing.length <= 2) {
    status = 'warn';
    score = 55;
    message = `Missing OG tags: ${missing.join(', ')}.`;
    recommendation = 'Add the missing Open Graph tags so links render rich previews on social media.';
  } else {
    status = 'fail';
    score = 20;
    message = `Missing OG tags: ${missing.join(', ')}.`;
    recommendation = 'Add complete Open Graph (og:title, og:description, og:image, og:url) and Twitter Card tags.';
  }

  return {
    checkId: 'open_graph',
    name: 'Open Graph & Social',
    status,
    score: clampScore(score),
    message,
    details: {
      ogTitle,
      ogDescription: ogDesc,
      ogImage,
      ogUrl: ogUrl || finalUrl,
      ogType: ogType || undefined,
      twitterCard: twitterCard || undefined,
      twitterTitle: twitterTitle || undefined,
      twitterDesc: twitterDesc || undefined,
      twitterImage: twitterImage || undefined,
      missing,
    },
    recommendation: recommendation || undefined,
  };
}

function checkContentQuality($: cheerio.CheerioAPI): SeoCheck {
  // Remove scripts and styles from text
  $('script, style, noscript').remove();
  const text = $('body').text() || $('html').text() || '';
  const normalised = text.replace(/\s+/g, ' ').trim();
  const words = normalised ? normalised.split(' ').filter(Boolean) : [];
  const wordCount = words.length;
  const sentences = normalised.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const sentenceCount = sentences.length;
  const avgSentenceLen = sentenceCount ? Math.round(wordCount / sentenceCount) : 0;

  let status: CheckStatus;
  let score: number;
  let message: string;
  let recommendation: string;

  if (wordCount < 300) {
    status = 'fail';
    score = 30;
    message = `Content is very thin (${wordCount} words).`;
    recommendation = 'Aim for at least 300–600 words of helpful, original content for most pages.';
  } else if (wordCount < 600) {
    status = 'warn';
    score = 70;
    message = `Content is on the shorter side (${wordCount} words).`;
    recommendation = 'Consider expanding with more detail, examples, or FAQ sections.';
  } else if (avgSentenceLen > 25) {
    status = 'warn';
    score = 75;
    message = `Content length is OK (${wordCount} words) but average sentence is long (${avgSentenceLen} words).`;
    recommendation = 'Break up long sentences for readability.';
  } else {
    status = 'pass';
    score = 100;
    message = `Content quality is good (${wordCount} words, ~${avgSentenceLen} words/sentence).`;
    recommendation = '';
  }

  return {
    checkId: 'content_quality',
    name: 'Content Quality',
    status,
    score: clampScore(score),
    message,
    details: { wordCount, sentenceCount, avgSentenceLength: avgSentenceLen },
    recommendation: recommendation || undefined,
  };
}

// ============================================================
// Action plan builder
// ============================================================

function buildActionPlan(checks: SeoCheck[]): ActionPlanItem[] {
  const priorityByCheck: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    title: 'critical',
    meta_description: 'high',
    headings: 'medium',
    url_structure: 'high',
    image_alt: 'medium',
    robots_txt: 'high',
    sitemap: 'high',
    broken_links: 'high',
    indexability: 'critical',
    page_speed: 'high',
    mobile_friendly: 'high',
    open_graph: 'low',
    content_quality: 'medium',
  };

  const order: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const items: ActionPlanItem[] = [];
  for (const c of checks) {
    if (c.status !== 'fail' && c.status !== 'warn') continue;
    const priority = priorityByCheck[c.checkId] || 'medium';
    items.push({
      priority,
      title: c.name,
      description: c.recommendation || c.message,
      checkId: c.checkId,
    });
  }

  items.sort((a, b) => order[a.priority] - order[b.priority]);
  return items;
}

// ============================================================
// Main audit runner
// ============================================================

export async function runSeoAudit(opts: AuditOptions): Promise<AuditResult> {
  const { fastMode = false } = opts;
  const normalizedUrl = normalizeUrl(opts.url);

  if (!normalizedUrl) {
    return {
      url: opts.url,
      normalizedUrl: '',
      overallScore: 0,
      totalChecks: 0,
      passedChecks: 0,
      warnedChecks: 0,
      failedChecks: 0,
      checks: [],
      actionPlan: [],
      error: 'Invalid URL provided.',
    };
  }

  const page = await fetchPage(normalizedUrl);

  if (!page.html && !page.ok) {
    const failedCheck: SeoCheck = {
      checkId: 'fetch',
      name: 'Page Fetch',
      status: 'fail',
      score: 0,
      message: page.error
        ? `Failed to fetch page: ${page.error}`
        : `Failed to fetch page (HTTP ${page.status || 'unknown'}).`,
      recommendation: 'Check the URL, ensure the site is publicly reachable, and try again.',
    };
    return {
      url: opts.url,
      normalizedUrl,
      finalUrl: page.finalUrl,
      httpStatus: page.status || undefined,
      responseTimeMs: page.responseTimeMs,
      overallScore: 0,
      totalChecks: 1,
      passedChecks: 0,
      warnedChecks: 0,
      failedChecks: 1,
      checks: [failedCheck],
      actionPlan: buildActionPlan([failedCheck]),
      error: failedCheck.message,
    };
  }

  const $ = cheerio.load(page.html);
  const finalUrl = page.finalUrl || normalizedUrl;
  let origin = '';
  try {
    origin = new URL(finalUrl).origin;
  } catch {
    origin = '';
  }

  // Run synchronous checks first
  const checks: SeoCheck[] = [
    checkTitle($),
    checkMetaDescription($),
    checkHeadings($),
    checkUrlStructure(finalUrl),
    checkImageAlt($),
  ];

  // Async checks — skip slow ones in fast mode
  if (origin) {
    checks.push(await checkRobotsTxt(origin));

    if (!fastMode) {
      checks.push(await checkSitemap(origin));
      checks.push(await checkBrokenLinks($, finalUrl));
    } else {
      // In fast mode, mark these as skipped (info) without performing the checks
      checks.push({
        checkId: 'sitemap',
        name: 'Sitemap',
        status: 'info',
        score: 100,
        message: 'Skipped in fast mode.',
        recommendation: 'Run a full audit to verify sitemap availability.',
      });
      checks.push({
        checkId: 'broken_links',
        name: 'Broken Links',
        status: 'info',
        score: 100,
        message: 'Skipped in fast mode.',
        recommendation: 'Run a full audit to detect broken links.',
      });
    }
  } else {
    checks.push({
      checkId: 'robots_txt',
      name: 'Robots.txt',
      status: 'fail',
      score: 0,
      message: 'Could not determine site origin from URL.',
    });
    checks.push({
      checkId: 'sitemap',
      name: 'Sitemap',
      status: 'fail',
      score: 0,
      message: 'Could not determine site origin from URL.',
    });
    checks.push({
      checkId: 'broken_links',
      name: 'Broken Links',
      status: 'info',
      score: 100,
      message: 'Skipped — no origin to resolve relative links.',
    });
  }

  checks.push(checkIndexability($, page.headers, finalUrl));

  if (fastMode) {
    checks.push({
      checkId: 'page_speed',
      name: 'Page Speed',
      status: 'info',
      score: 100,
      message: 'Skipped in fast mode.',
      recommendation: 'Run a full audit to invoke Google PageSpeed Insights.',
    });
  } else {
    checks.push(await checkPageSpeed(finalUrl));
  }

  checks.push(checkMobileFriendly($));
  checks.push(checkOpenGraph($, finalUrl));
  checks.push(checkContentQuality($));

  // Tally
  const passedChecks = checks.filter((c) => c.status === 'pass').length;
  const warnedChecks = checks.filter((c) => c.status === 'warn').length;
  const failedChecks = checks.filter((c) => c.status === 'fail').length;

  // Weighted overall score — only count checks that are not 'info'
  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of checks) {
    if (c.status === 'info') continue;
    const w = CHECK_WEIGHTS[c.checkId] ?? 0;
    weightedSum += c.score * w;
    weightTotal += w;
  }
  const overallScore = weightTotal > 0 ? clampScore(weightedSum / weightTotal) : 0;

  const actionPlan = buildActionPlan(checks);

  return {
    url: opts.url,
    normalizedUrl,
    finalUrl,
    httpStatus: page.status || undefined,
    responseTimeMs: page.responseTimeMs,
    overallScore,
    totalChecks: checks.length,
    passedChecks,
    warnedChecks,
    failedChecks,
    checks,
    actionPlan,
    html: page.html,
  };
}
