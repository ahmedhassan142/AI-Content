import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

interface Metric {
  id: string;
  title: string;
  value: number;
  unit: string;
  score: number | null; // 0-1 or null if not available
  displayValue: string;
  target: string;
  status: 'good' | 'needs-improvement' | 'poor' | 'unknown';
}

interface CoreWebVitalsResult {
  metrics: {
    lcp?: Metric;
    cls?: Metric;
    fcp?: Metric;
    tbt?: Metric;
    speedIndex?: Metric;
    inp?: Metric;
  };
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  recommendations: string[];
  finalUrl: string;
  fetchTime: string;
}

// Shape of a Lighthouse audit entry (only fields we read)
interface LighthouseAudit {
  title?: string;
  numericValue?: number;
  numericUnit?: string;
  score?: number | null;
  displayValue?: string;
  details?: {
    type?: string;
    overallSavingsMs?: number;
  };
}

interface LighthouseCategory {
  score?: number | null;
}

interface LighthouseResult {
  finalUrl?: string;
  finalDisplayedUrl?: string;
  fetchTime?: string;
  categories?: Record<string, LighthouseCategory>;
  audits?: Record<string, LighthouseAudit>;
}

interface PsiResponse {
  lighthouseResult?: LighthouseResult;
  error?: { message?: string };
}

function normalizeUrl(input: string): string {
  let trimmed = (input || '').trim();
  if (!trimmed) return '';
  trimmed = trimmed.replace(/^["'`]+|["'`]+$/g, '');
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
  try {
    const u = new URL(trimmed);
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname === '/') u.pathname = '';
    return u.toString();
  } catch {
    return trimmed;
  }
}

function metricStatus(
  score: number | null
): Metric['status'] {
  if (score === null) return 'unknown';
  if (score >= 0.9) return 'good';
  if (score >= 0.5) return 'needs-improvement';
  return 'poor';
}

function buildMetric(
  audits: Record<string, LighthouseAudit>,
  id: string,
  title: string,
  target: string,
  unit: string
): Metric | undefined {
  const a = audits[id];
  if (!a) return undefined;
  const numericValue =
    typeof a.numericValue === 'number' ? a.numericValue : 0;
  const score = typeof a.score === 'number' ? a.score : null;
  return {
    id,
    title: a.title || title,
    value: numericValue,
    unit: a.numericUnit || unit,
    score,
    displayValue: a.displayValue || String(numericValue),
    target,
    status: metricStatus(score),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { url, strategy } = (await request.json()) as {
      url?: string;
      strategy?: 'mobile' | 'desktop';
    };

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      );
    }

    const useStrategy = strategy === 'desktop' ? 'desktop' : 'mobile';

    const psiUrl = `${PSI_ENDPOINT}?url=${encodeURIComponent(
      normalizedUrl
    )}&strategy=${useStrategy}&category=performance&category=seo&category=accessibility&category=best-practices`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);

    let res: Response;
    try {
      res = await fetch(psiUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to reach Google PageSpeed Insights: ${message}`,
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let errBody: PsiResponse | null = null;
      try {
        errBody = (await res.json()) as PsiResponse;
      } catch {
        /* ignore */
      }
      const message =
        errBody?.error?.message ||
        `PageSpeed Insights returned HTTP ${res.status}`;
      // 429 / quota errors → 429 to client
      const status = res.status === 429 ? 429 : 502;
      return NextResponse.json(
        { success: false, error: message },
        { status }
      );
    }

    const data = (await res.json()) as PsiResponse;
    const lighthouseResult = data?.lighthouseResult;
    if (!lighthouseResult) {
      return NextResponse.json(
        {
          success: false,
          error: 'PageSpeed Insights returned no lighthouse result.',
        },
        { status: 502 }
      );
    }

    const categories = lighthouseResult.categories || {};
    const audits = lighthouseResult.audits || {};

    const getScore = (key: string): number | null => {
      const c = categories[key];
      if (!c) return null;
      if (typeof c.score === 'number') return Math.round(c.score * 100);
      return null;
    };

    const metrics: CoreWebVitalsResult['metrics'] = {};
    metrics.lcp = buildMetric(
      audits,
      'largest-contentful-paint',
      'Largest Contentful Paint',
      '< 2.5s',
      'millisecond'
    );
    metrics.cls = buildMetric(
      audits,
      'cumulative-layout-shift',
      'Cumulative Layout Shift',
      '< 0.1',
      'unitless'
    );
    metrics.fcp = buildMetric(
      audits,
      'first-contentful-paint',
      'First Contentful Paint',
      '< 1.8s',
      'millisecond'
    );
    metrics.tbt = buildMetric(
      audits,
      'total-blocking-time',
      'Total Blocking Time',
      '< 200ms',
      'millisecond'
    );
    metrics.speedIndex = buildMetric(
      audits,
      'speed-index',
      'Speed Index',
      '< 3.4s',
      'millisecond'
    );
    metrics.inp = buildMetric(
      audits,
      'interaction-to-next-paint',
      'Interaction to Next Paint',
      '< 200ms',
      'millisecond'
    );

    const scores: CoreWebVitalsResult['scores'] = {
      performance: getScore('performance'),
      seo: getScore('seo'),
      accessibility: getScore('accessibility'),
      bestPractices: getScore('best-practices'),
    };

    // Build recommendations from low-scoring audits
    const recommendations: string[] = [];
    const allAudits = Object.values(audits);
    const opportunityAudits = allAudits
      .filter(
        (a) =>
          a &&
          a.details &&
          (a.details.type === 'opportunity' ||
            a.details.type === 'diagnostic') &&
          typeof a.score === 'number' &&
          a.score < 0.9
      )
      .sort((a, b) => {
        const wa = a.details?.overallSavingsMs || 0;
        const wb = b.details?.overallSavingsMs || 0;
        return wb - wa;
      })
      .slice(0, 8);

    for (const a of opportunityAudits) {
      const savings = a.details?.overallSavingsMs
        ? ` (saves ~${Math.round(a.details.overallSavingsMs)}ms)`
        : '';
      recommendations.push(`${a.title}${savings}`);
    }

    // CWV-specific recommendations
    if (metrics.lcp && metrics.lcp.status !== 'good') {
      recommendations.push(
        'Improve LCP: preload hero image, reduce server response time (TTFB), remove render-blocking resources.'
      );
    }
    if (metrics.cls && metrics.cls.status !== 'good') {
      recommendations.push(
        'Improve CLS: set width/height on images & ads, avoid inserting content above existing content.'
      );
    }
    if (metrics.tbt && metrics.tbt.status !== 'good') {
      recommendations.push(
        'Improve TBT: break up long JavaScript tasks, defer non-critical JS, use code-splitting.'
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('Core Web Vitals look healthy. Keep it up!');
    }

    const result: CoreWebVitalsResult = {
      metrics,
      scores,
      recommendations: Array.from(new Set(recommendations)).slice(0, 10),
      finalUrl:
        lighthouseResult.finalUrl ||
        lighthouseResult.finalDisplayedUrl ||
        normalizedUrl,
      fetchTime: lighthouseResult.fetchTime || new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error('[seo/core-web-vitals] error:', error);
    const message =
      error instanceof Error ? error.message : 'Core Web Vitals check failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
