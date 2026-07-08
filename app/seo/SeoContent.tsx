'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Zap,
  Globe,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Wrench,
  History,
  Trash2,
  Gauge,
  ListChecks,
  Code2,
  FileText,
  FileCode2,
  Sparkles,
  RefreshCw,
  ExternalLink,
  GitBranch,
  Brain,
  BarChart3,
  Link2,
  X,
  TrendingUp,
  Target,
  MapPin,
  ShoppingBag,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ============================================================
// Types
// ============================================================

type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

interface SeoCheck {
  checkId: string;
  name: string;
  status: CheckStatus;
  score: number;
  message: string;
  details?: Record<string, unknown>;
  recommendation?: string;
}

interface ActionPlanItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  checkId: string;
}

interface Audit {
  _id?: string;
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
  createdAt?: string;
}

interface CodeSnippet {
  label: string;
  language: string;
  code: string;
  location: string;
}

interface SeoFix {
  checkId: string;
  checkName: string;
  status: 'fixed' | 'cannot_fix' | 'already_ok';
  fixDescription: string;
  codeSnippets: CodeSnippet[];
  instructions: string[];
}

interface FixResult {
  url: string;
  fixes: SeoFix[];
  generatedFiles: { robotsTxt?: string; sitemapXml?: string };
  summary: { total: number; fixed: number; cannotFix: number; alreadyOk: number };
}

// ============================================================
// Constants
// ============================================================

const EXAMPLE_URLS = ['nextjs.org', 'vercel.com', 'stripe.com'];

const PROGRESS_MESSAGES = [
  'Fetching page HTML…',
  'Parsing the DOM with cheerio…',
  'Checking title & meta tags…',
  'Auditing headings & images…',
  'Verifying robots.txt and sitemap…',
  'Detecting broken links…',
  'Testing mobile-friendliness…',
  'Calling Google PageSpeed Insights…',
  'Scoring Open Graph & content quality…',
  'Building prioritized action plan…',
];

// ============================================================
// UI primitives
// ============================================================

function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case 'warn':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'fail':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'info':
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
}

function statusBadgeClasses(status: CheckStatus) {
  switch (status) {
    case 'pass':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'warn':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'fail':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'info':
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}

function priorityClasses(priority: ActionPlanItem['priority']) {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

// ============================================================
// Score gauge (circular SVG)
// ============================================================

function ScoreGauge({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, score || 0));
  const offset = circumference - (safeScore / 100) * circumference;

  let color = '#ef4444'; // red-500
  if (safeScore >= 80) color = '#16a34a'; // green-600
  else if (safeScore >= 50) color = '#f59e0b'; // amber-500

  const label =
    safeScore >= 80 ? 'Good' : safeScore >= 50 ? 'Needs work' : 'Poor';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-bold text-gray-900"
        >
          {Math.round(safeScore)}
        </motion.span>
        <span className="text-xs font-medium text-gray-500">/ 100</span>
        <span
          className="mt-1 text-xs font-semibold uppercase tracking-wide"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Check card (expandable)
// ============================================================

function CheckCard({ check }: { check: SeoCheck }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition"
      >
        <StatusIcon status={check.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{check.name}</span>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${statusBadgeClasses(
                check.status
              )}`}
            >
              {check.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 truncate">{check.message}</p>
        </div>
        <div className="text-sm font-semibold text-gray-700 hidden sm:block">
          {check.score}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100 bg-gray-50"
          >
            <div className="p-4 space-y-3 text-sm">
              {check.recommendation && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    Recommendation
                  </div>
                  <p className="text-gray-700">{check.recommendation}</p>
                </div>
              )}
              {check.details && Object.keys(check.details).length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    Details
                  </div>
                  <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-64 text-gray-800">
                    {JSON.stringify(check.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Code block with copy button
// ============================================================

function CodeBlock({
  code,
  language,
  label,
  location,
}: {
  code: string;
  language: string;
  label: string;
  location?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <Code2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-700 truncate">
            {label}
          </span>
          <span className="text-[10px] uppercase font-mono text-gray-400">
            {language}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      {location && (
        <div className="px-3 py-1.5 text-[11px] text-gray-500 bg-amber-50 border-b border-amber-100">
          <span className="font-semibold text-amber-700">Where:</span> {location}
        </div>
      )}
      <pre className="text-xs leading-relaxed p-3 overflow-auto max-h-80 bg-gray-900 text-gray-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ============================================================
// Fix card
// ============================================================

function FixCard({ fix }: { fix: SeoFix }) {
  const [open, setOpen] = useState(true);
  const statusInfo =
    fix.status === 'fixed'
      ? { icon: <Wrench className="w-4 h-4 text-green-600" />, label: 'Fix ready', tone: 'text-green-700 bg-green-50 border-green-200' }
      : fix.status === 'cannot_fix'
      ? { icon: <AlertTriangle className="w-4 h-4 text-amber-600" />, label: 'Manual action', tone: 'text-amber-700 bg-amber-50 border-amber-200' }
      : { icon: <CheckCircle2 className="w-4 h-4 text-blue-600" />, label: 'Already OK', tone: 'text-blue-700 bg-blue-50 border-blue-200' };

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition"
      >
        {statusInfo.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{fix.checkName}</span>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${statusInfo.tone}`}
            >
              {statusInfo.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 truncate">{fix.fixDescription}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100 bg-gray-50"
          >
            <div className="p-4 space-y-4">
              {fix.codeSnippets.length > 0 && (
                <div className="space-y-3">
                  {fix.codeSnippets.map((s, i) => (
                    <CodeBlock
                      key={i}
                      code={s.code}
                      language={s.language}
                      label={s.label}
                      location={s.location}
                    />
                  ))}
                </div>
              )}
              {fix.instructions.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Instructions
                  </div>
                  <ul className="space-y-1.5">
                    {fix.instructions.map((ins, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <ChevronRight className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Progress overlay
// ============================================================

function ProgressOverlay({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-16 space-y-4"
    >
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        <Gauge className="w-6 h-6 text-purple-600 absolute inset-0 m-auto" />
      </div>
      <motion.p
        key={message}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-medium text-gray-700"
      >
        {message}
      </motion.p>
    </motion.div>
  );
}

// ============================================================
// Main component
// ============================================================

export default function SeoContent() {
  // Tab state removed — all tools are now integrated into the audit view

  return (
    <div className="bg-gray-50 min-h-screen pt-4 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SEO Suite</h1>
            <p className="text-sm text-gray-600">
              Audit any URL, then get ready-to-paste fixes — plus 8 free SEO tools.
            </p>
          </div>
        </div>

        {/* Tab content — single unified view, no tabs */}
        <SeoAuditPanel />

      </div>
    </div>
  );
}

// ============================================================
// SEO Audit Panel (existing audit functionality)
// ============================================================

function SeoAuditPanel() {
  const { isGuest, guestSession, getAuthHeader } = useAuth();

  const [url, setUrl] = useState('');
  const [fastMode, setFastMode] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [autoToolResults, setAutoToolResults] = useState<Record<string, any>>({});

  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);

  // Apply-to-site state
  const [wpSites, setWpSites] = useState<Array<{ _id: string; siteName: string; siteUrl: string }>>([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyTarget, setApplyTarget] = useState<'wordpress' | 'webhook'>('wordpress');
  const [selectedWpSite, setSelectedWpSite] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string; postUrl?: string } | null>(null);

  const [history, setHistory] = useState<Audit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback(() => {
    setProgressIdx(0);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgressIdx((i) => (i + 1) % PROGRESS_MESSAGES.length);
    }, 2200);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopProgress();
  }, [stopProgress]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const headers: Record<string, string> = { ...getAuthHeader() };
      const params = new URLSearchParams();
      if (isGuest && guestSession) params.set('guestSessionId', guestSession.id);
      const res = await fetch(`/api/seo/history?${params.toString()}`, {
        headers,
      });
      const data = await res.json();
      if (data.success) setHistory(data.audits || []);
    } catch (err) {
      console.error('history load failed', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [getAuthHeader, isGuest, guestSession]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runAudit = async () => {
    if (!url.trim()) return;
    setAuditing(true);
    setAudit(null);
    setAuditError(null);
    setFixResult(null);
    startProgress();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      };
      const reqBody: Record<string, unknown> = { url, fastMode };
      if (isGuest && guestSession) {
        reqBody.isGuest = true;
        reqBody.guestSessionId = guestSession.id;
      }
      const res = await fetch('/api/seo/audit', {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (data.success && data.audit) {
        setAudit(data.audit);
        loadHistory();

        // Auto-run ALL URL-based tools in parallel right after audit
        const auditedUrl = data.audit.url;
        const toolHeaders = { 'Content-Type': 'application/json', ...getAuthHeader() };
        const runTool = async (endpoint: string, body: any) => {
          try {
            const r = await fetch(endpoint, { method: 'POST', headers: toolHeaders, body: JSON.stringify(body) });
            return await r.json();
          } catch { return null; }
        };

        // ALL 6 URL-based tools run simultaneously (core-web-vitals removed — too many 429 errors)
        const [schemaData, redirectData, linksData, canonicalData, thinData, orphanData] = await Promise.all([
          runTool('/api/seo/schema-check', { url: auditedUrl }),
          runTool('/api/seo/redirect-check', { url: auditedUrl }),
          runTool('/api/seo/internal-links', { url: auditedUrl }),
          runTool('/api/seo/canonical-check', { url: auditedUrl }),
          runTool('/api/seo/thin-content', { url: auditedUrl }),
          runTool('/api/seo/orphan-pages', { url: auditedUrl }),
        ]);

        // Store results directly in state — no window events needed
        const autoResults: Record<string, any> = {};
        if (schemaData?.success) autoResults['schema-check'] = schemaData;
        if (redirectData?.success) autoResults['redirect-check'] = redirectData;
        if (linksData?.success) autoResults['internal-links'] = linksData;
        if (canonicalData?.success) autoResults['canonical-check'] = canonicalData;
        if (thinData?.success) autoResults['thin-content'] = thinData;
        if (orphanData?.success) autoResults['orphan-pages'] = orphanData;
        setAutoToolResults(autoResults);
      } else {
        setAuditError(data.error || 'Audit failed.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error during audit.';
      setAuditError(message);
    } finally {
      stopProgress();
      setAuditing(false);
    }
  };

  const runFix = async () => {
    if (!audit) return;
    setFixing(true);
    setFixError(null);
    setFixResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      };
      const reqBody: Record<string, unknown> = {
        url: audit.normalizedUrl || audit.url,
      };
      if (audit._id) reqBody.auditId = audit._id;
      if (isGuest && guestSession) {
        reqBody.isGuest = true;
        reqBody.guestSessionId = guestSession.id;
      }
      const res = await fetch('/api/seo/fix', {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (data.success) {
        setFixResult({
          url: audit.normalizedUrl,
          fixes: data.fixes || [],
          generatedFiles: data.generatedFiles || {},
          summary: data.summary || { total: 0, fixed: 0, cannotFix: 0, alreadyOk: 0 },
        });
      } else {
        setFixError(data.error || 'Fix generation failed.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error during fix.';
      setFixError(message);
    } finally {
      setFixing(false);
    }
  };

  // ---- Apply fixes to connected site ----
  const openApplyModal = async () => {
    if (!fixResult) return;
    setShowApplyModal(true);
    setApplyResult(null);
    setSelectedWpSite('');
    setApplyTarget('wordpress');
    try {
      const res = await fetch('/api/wordpress', { headers: { ...getAuthHeader() } });
      const data = await res.json();
      if (data.success && data.sites?.length > 0) {
        setWpSites(data.sites);
        setSelectedWpSite(data.sites[0]._id);
      } else {
        setWpSites([]);
        setApplyTarget('webhook');
      }
    } catch {
      setWpSites([]);
      setApplyTarget('webhook');
    }
  };

  const handleApplyFix = async () => {
    if (!fixResult || !audit) return;
    setApplying(true);
    setApplyResult(null);

    try {
      if (applyTarget === 'wordpress') {
        if (!selectedWpSite) {
          setApplyResult({ success: false, message: 'Select a WordPress site first.' });
          setApplying(false);
          return;
        }

        // Find the fixed title and meta description from the fix results
        const titleFix = fixResult.fixes.find((f) => f.checkId === 'title');
        const metaFix = fixResult.fixes.find((f) => f.checkId === 'meta_description');

        // Extract the actual title text from the code snippet
        let fixedTitle = '';
        if (titleFix?.codeSnippets?.[0]?.code) {
          const match = titleFix.codeSnippets[0].code.match(/<title>(.*?)<\/title>/i);
          fixedTitle = match ? match[1] : '';
        }

        // Extract the meta description from the code snippet
        let fixedMeta = '';
        if (metaFix?.codeSnippets?.[0]?.code) {
          const match = metaFix.codeSnippets[0].code.match(/content="([^"]*)"/i);
          fixedMeta = match ? match[1] : '';
        }

        // Call the apply endpoint to actually update the WordPress page
        const res = await fetch('/api/seo/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({
            wpSiteId: selectedWpSite,
            auditedUrl: audit.url,
            fixedTitle,
            fixedMetaDescription: fixedMeta,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setApplyResult({
            success: true,
            message: `${data.message} Re-run the audit to see the improved score.`,
            postUrl: data.postUrl,
          });
        } else {
          setApplyResult({ success: false, message: data.error || 'Failed to apply fixes to WordPress.' });
        }
      } else {
        // Send via webhook — save content triggers content.saved webhook
        const fixSummary = fixResult.fixes
          .filter((f) => f.status === 'fixed')
          .map((f) => {
            const snippets = f.codeSnippets.map((s) => s.code).join('\n');
            return `## ${f.checkName}\n\n${f.fixDescription}\n\n\`\`\`\n${snippets}\n\`\`\``;
          })
          .join('\n\n');

        const title = `SEO Fixes for ${audit.url}`;
        const content = `# SEO Fix Report for ${audit.url}\n\n**Overall Score:** ${audit.overallScore}/100\n\n**Fixes:**\n\n${fixSummary}`;

        const res = await fetch('/api/content/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({
            title,
            content,
            type: 'generated',
            seoKeywords: [audit.url, 'SEO fixes'],
          }),
        });
        const data = await res.json();
        if (data.success) {
          setApplyResult({
            success: true,
            message: 'SEO fixes sent to all connected webhook sites. The receiver should apply the fixes to the website.',
          });
        } else {
          setApplyResult({ success: false, message: data.error || 'Failed to send via webhook.' });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error.';
      setApplyResult({ success: false, message });
    } finally {
      setApplying(false);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      const headers: Record<string, string> = { ...getAuthHeader() };
      await fetch(`/api/seo/history/${id}`, { method: 'DELETE', headers });
      setHistory((h) => h.filter((a) => a._id !== id));
    } catch (err) {
      console.error('delete failed', err);
    }
  };

  const loadAuditById = async (id: string) => {
    try {
      const headers: Record<string, string> = { ...getAuthHeader() };
      const res = await fetch(`/api/seo/history/${id}`, { headers });
      const data = await res.json();
      if (data.success && data.audit) {
        setAudit(data.audit);
        setFixResult(null);
        setUrl(data.audit.url);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('load audit failed', err);
    }
  };

  // Compute blended score (13 main + 6 advanced)
  const _advChecks = ['schema-check', 'redirect-check', 'internal-links', 'canonical-check', 'thin-content', 'orphan-pages'];
  let _advPassed = 0, _advWarned = 0, _advFailed = 0;
  const _advScores: number[] = [];
  _advChecks.forEach((id) => {
    const r = autoToolResults[id];
    if (r) {
      if (r.score !== undefined) { _advScores.push(r.score); if (r.score >= 80) _advPassed++; else if (r.score >= 50) _advWarned++; else _advFailed++; }
      else if (r.issues && r.issues.length > 0) { _advScores.push(50); _advWarned++; }
      else if (r.orphanCount !== undefined && r.orphanCount > 0) { _advScores.push(70); _advWarned++; }
      else if (r.level === 'critical') { _advScores.push(20); _advFailed++; }
      else if (r.level === 'thin') { _advScores.push(60); _advWarned++; }
      else { _advScores.push(100); _advPassed++; }
    }
  });
  const blendedScore = audit && _advScores.length > 0
    ? Math.round((audit.overallScore * 0.6) + (_advScores.reduce((a, b) => a + b, 0) / _advScores.length * 0.4))
    : audit?.overallScore || 0;
  const totalPassed = (audit?.passedChecks || 0) + _advPassed;
  const totalWarned = (audit?.warnedChecks || 0) + _advWarned;
  const totalFailed = (audit?.failedChecks || 0) + _advFailed;
  const totalChecksCount = (audit?.totalChecks || 0) + _advScores.length;

  return (
    <div className="space-y-6">
        {/* URL form */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !auditing) runAudit();
                }}
                placeholder="example.com or https://example.com/page"
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
              />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 select-none">
              <input
                type="checkbox"
                checked={fastMode}
                onChange={(e) => setFastMode(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Fast mode
              </span>
            </label>
            <button
              onClick={runAudit}
              disabled={auditing || !url.trim()}
              className="px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {auditing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Auditing…
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" /> Run SEO Audit
                </>
              )}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Try:</span>
            {EXAMPLE_URLS.map((ex) => (
              <button
                key={ex}
                onClick={() => setUrl(ex)}
                disabled={auditing}
                className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 font-medium transition disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>

          {fastMode && (
            <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Fast mode skips PageSpeed Insights, broken-link checks, and sitemap discovery.
            </p>
          )}
        </div>

        {/* Audit error */}
        {auditError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <div className="font-semibold mb-0.5">Audit failed</div>
              {auditError}
            </div>
          </div>
        )}

        {/* Progress overlay */}
        <AnimatePresence mode="wait">
          {auditing && (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm"
            >
              <ProgressOverlay message={PROGRESS_MESSAGES[progressIdx]} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audit results */}
        <AnimatePresence>
          {audit && !auditing && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Summary card — blended score includes advanced tools */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                    <ScoreGauge score={blendedScore} />
                  </div>
                  <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{totalPassed}</div>
                      <div className="text-xs text-green-700 font-medium">Passed</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-amber-700">{totalWarned}</div>
                      <div className="text-xs text-amber-700 font-medium">Warnings</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-red-700">{totalFailed}</div>
                      <div className="text-xs text-red-700 font-medium">Failed</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-gray-700">{totalChecksCount}</div>
                      <div className="text-xs text-gray-700 font-medium">Total checks</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                  {audit.finalUrl && (
                    <span className="flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <a
                        href={audit.finalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline truncate max-w-xs"
                      >
                        {audit.finalUrl}
                      </a>
                    </span>
                  )}
                  {typeof audit.httpStatus === 'number' && (
                    <span>HTTP {audit.httpStatus}</span>
                  )}
                  {typeof audit.responseTimeMs === 'number' && (
                    <span>{audit.responseTimeMs} ms</span>
                  )}
                  {audit.createdAt && (
                    <span>
                      {new Date(audit.createdAt as string).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Action plan + checks (2-column on large screens) */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Action plan */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <ListChecks className="w-5 h-5 text-purple-600" />
                    <h2 className="font-bold text-gray-900">Prioritized action plan</h2>
                  </div>
                  {audit.actionPlan.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No issues — this page is in great shape!
                    </p>
                  ) : (
                    <ol className="space-y-3">
                      {audit.actionPlan.map((item, i) => (
                        <li
                          key={`${item.checkId}-${i}`}
                          className="flex items-start gap-3"
                        >
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 text-sm">
                                {item.title}
                              </span>
                              <span
                                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${priorityClasses(
                                  item.priority
                                )}`}
                              >
                                {item.priority}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* Checks list */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h2 className="font-bold text-gray-900">All checks</h2>
                  </div>
                  <div className="space-y-2 max-h-[28rem] overflow-auto pr-1">
                    {audit.checks.map((c) => (
                      <CheckCard key={c.checkId} check={c} />
                    ))}
                  </div>
                </div>

                {/* Advanced checks — merged inline, results passed directly */}
                <SeoToolsResults url={audit.url} getAuthHeader={getAuthHeader} merged autoResults={autoToolResults} />
              </div>

              {/* Fix button */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Wrench className="w-6 h-6" />
                  <div>
                    <div className="font-bold">Get ready-to-paste fixes</div>
                    <div className="text-sm text-purple-100">
                      Generate code snippets for every failed check.
                    </div>
                  </div>
                </div>
                <button
                  onClick={runFix}
                  disabled={fixing}
                  className="px-5 py-3 bg-white text-purple-700 rounded-xl font-semibold hover:bg-purple-50 disabled:opacity-60 transition flex items-center gap-2"
                >
                  {fixing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Fix SEO Now
                    </>
                  )}
                </button>
              </div>

              {/* Fix error */}
              {fixError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">
                    <div className="font-semibold mb-0.5">Fix generation failed</div>
                    {fixError}
                  </div>
                </div>
              )}

              {/* Fix results */}
              <AnimatePresence>
                {fixResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Wrench className="w-5 h-5 text-purple-600" />
                        <h2 className="font-bold text-gray-900">SEO fixes</h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-green-700">
                            {fixResult.summary.fixed}
                          </div>
                          <div className="text-[10px] text-green-700 font-medium uppercase">
                            Fixed
                          </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-amber-700">
                            {fixResult.summary.cannotFix}
                          </div>
                          <div className="text-[10px] text-amber-700 font-medium uppercase">
                            Manual
                          </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-blue-700">
                            {fixResult.summary.alreadyOk}
                          </div>
                          <div className="text-[10px] text-blue-700 font-medium uppercase">
                            Already OK
                          </div>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                          <div className="text-xl font-bold text-gray-700">
                            {fixResult.summary.total}
                          </div>
                          <div className="text-[10px] text-gray-700 font-medium uppercase">
                            Total
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Generated files */}
                    {(fixResult.generatedFiles.robotsTxt ||
                      fixResult.generatedFiles.sitemapXml) && (
                      <div className="grid md:grid-cols-2 gap-4">
                        {fixResult.generatedFiles.robotsTxt && (
                          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <FileText className="w-4 h-4 text-purple-600" />
                              <h3 className="font-semibold text-gray-900 text-sm">
                                Generated robots.txt
                              </h3>
                            </div>
                            <CodeBlock
                              code={fixResult.generatedFiles.robotsTxt}
                              language="text"
                              label="robots.txt"
                              location="Save as /robots.txt"
                            />
                          </div>
                        )}
                        {fixResult.generatedFiles.sitemapXml && (
                          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <FileCode2 className="w-4 h-4 text-purple-600" />
                              <h3 className="font-semibold text-gray-900 text-sm">
                                Generated sitemap.xml
                              </h3>
                            </div>
                            <CodeBlock
                              code={fixResult.generatedFiles.sitemapXml}
                              language="xml"
                              label="sitemap.xml"
                              location="Save as /sitemap.xml"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fix list */}
                    <div className="space-y-2">
                      {fixResult.fixes.map((f, i) => (
                        <FixCard key={`${f.checkId}-${i}`} fix={f} />
                      ))}
                    </div>

                    {/* Apply to Connected Site button */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-purple-600" />
                            Apply Fixes to Your Website
                          </h3>
                          <p className="text-sm text-gray-700 mt-0.5">
                            Send these SEO fixes directly to your connected WordPress or custom website.
                          </p>
                        </div>
                        <button
                          onClick={openApplyModal}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center gap-2 whitespace-nowrap"
                        >
                          <Wrench className="w-4 h-4" />
                          Apply to Site
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Apply to Site Modal */}
        <AnimatePresence>
          {showApplyModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-purple-600" />
                    Apply SEO Fixes
                  </h3>
                  <button
                    onClick={() => setShowApplyModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <XCircle className="w-5 h-5 text-gray-700" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => { setApplyTarget('wordpress'); setApplyResult(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
                      applyTarget === 'wordpress'
                        ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    WordPress
                  </button>
                  <button
                    onClick={() => { setApplyTarget('webhook'); setApplyResult(null); }}
                    className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
                      applyTarget === 'webhook'
                        ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Webhook
                  </button>
                </div>

                <div className="p-6 space-y-4 overflow-auto flex-1">
                  {applyTarget === 'wordpress' ? (
                    wpSites.length === 0 ? (
                      <div className="text-center py-6">
                        <Globe className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-900 font-medium mb-1">No WordPress sites connected</p>
                        <p className="text-sm text-gray-700 mb-4">Connect a WordPress site to apply fixes directly.</p>
                        <a
                          href="/wordpress"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                        >
                          <Globe className="w-4 h-4" />
                          Go to WordPress Settings
                        </a>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Select WordPress Site</label>
                        <select
                          value={selectedWpSite}
                          onChange={(e) => setSelectedWpSite(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                        >
                          {wpSites.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.siteName} — {s.siteUrl}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-600 mt-2">
                          The SEO fix report will be published as a draft post on your WordPress site.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        The SEO fix report will be sent to all connected webhook sites.
                        The target website&apos;s webhook receiver will store it in their database.
                      </p>
                      <a href="/webhooks" className="inline-flex items-center gap-1 text-sm text-purple-600 hover:underline mt-2">
                        <Sparkles className="w-4 h-4" />
                        Manage webhook integrations →
                      </a>
                    </div>
                  )}

                  {applyResult && (
                    <div
                      className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                        applyResult.success
                          ? 'bg-green-50 border border-green-200 text-green-800'
                          : 'bg-red-50 border border-red-200 text-red-800'
                      }`}
                    >
                      {applyResult.success ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">{applyResult.message}</p>
                        {applyResult.success && applyResult.postUrl && (
                          <a
                            href={applyResult.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-purple-600 hover:underline mt-1 text-xs"
                          >
                            View post <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={() => setShowApplyModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                  {!(applyTarget === 'wordpress' && wpSites.length === 0) && (
                    <button
                      onClick={handleApplyFix}
                      disabled={applying || (applyTarget === 'wordpress' && !selectedWpSite)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {applying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Wrench className="w-4 h-4" />
                          {applyTarget === 'wordpress' ? 'Apply to WordPress' : 'Send to Webhooks'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* History */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" />
              <h2 className="font-bold text-gray-900">Audit history</h2>
            </div>
            <button
              onClick={loadHistory}
              disabled={loadingHistory}
              className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>

          {loadingHistory && history.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No audits yet. Run your first audit above.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((a) => (
                <div
                  key={a._id as string}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      a.overallScore >= 80
                        ? 'bg-green-100 text-green-700'
                        : a.overallScore >= 50
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {Math.round(a.overallScore)}
                  </div>
                  <button
                    onClick={() => a._id && loadAuditById(a._id as string)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-sm font-medium text-gray-900 truncate hover:text-purple-700">
                      {a.url}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-3">
                      <span>
                        {a.passedChecks} pass · {a.warnedChecks} warn · {a.failedChecks} fail
                      </span>
                      {a.createdAt && (
                        <span>{new Date(a.createdAt as string).toLocaleString()}</span>
                      )}
                    </div>
                  </button>
                  {a._id && !isGuest && (
                    <button
                      onClick={() => deleteHistoryItem(a._id as string)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isGuest && (
            <p className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Sign up to save your audits permanently and access them from any device.
            </p>
          )}
        </div>
    </div>
  );
}

// ============================================================
// SeoToolsResults — auto-runs all 8 tools after audit
// ============================================================

function SeoToolsResults({ url, getAuthHeader, merged, autoResults: initialResults }: { url: string; getAuthHeader: () => Record<string, string>; merged?: boolean; autoResults?: Record<string, any> }) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolResults, setToolResults] = useState<Record<string, any>>(initialResults || {});
  const [toolLoading, setToolLoading] = useState<string | null>(null);
  const [toolErrors, setToolErrors] = useState<Record<string, string>>({});

  // Update results when autoResults prop changes (from parent state)
  useEffect(() => {
    if (initialResults && Object.keys(initialResults).length > 0) {
      setToolResults(initialResults);
    }
  }, [initialResults]);

  const tools = [
    { id: 'schema-check', name: 'Schema Markup', icon: Code2, endpoint: '/api/seo/schema-check', inputField: 'url' },
    { id: 'redirect-check', name: 'Redirect Check', icon: GitBranch, endpoint: '/api/seo/redirect-check', inputField: 'url' },
    { id: 'internal-links', name: 'Internal Links', icon: Link2, endpoint: '/api/seo/internal-links', inputField: 'url' },
    { id: 'canonical-check', name: 'Canonical Tag', icon: ShieldCheck, endpoint: '/api/seo/canonical-check', inputField: 'url' },
    { id: 'thin-content', name: 'Thin Content', icon: FileText, endpoint: '/api/seo/thin-content', inputField: 'url' },
    { id: 'orphan-pages', name: 'Orphan Pages', icon: AlertTriangle, endpoint: '/api/seo/orphan-pages', inputField: 'url' },
  ];

  const runTool = async (toolId: string, endpoint: string) => {
    setToolLoading(toolId);
    setActiveTool(toolId);
    setToolErrors((prev) => ({ ...prev, [toolId]: '' }));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        setToolResults((prev) => ({ ...prev, [toolId]: data }));
      } else {
        setToolErrors((prev) => ({ ...prev, [toolId]: data.error || 'Failed' }));
      }
    } catch (err: any) {
      setToolErrors((prev) => ({ ...prev, [toolId]: err.message || 'Network error' }));
    } finally {
      setToolLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2"
    >
      <div className={merged ? "" : "bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"}>
        {/* Header — only show when NOT merged */}
        {!merged && (
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-purple-600" />
          <h2 className="font-bold text-gray-900">Advanced SEO Analysis</h2>
          <span className="text-xs text-gray-600 ml-1">for {url}</span>
        </div>
        )}

        {/* When merged, show a small divider label */}
        {merged && (
          <div className="flex items-center gap-2 mb-3 mt-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Advanced Checks</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        )}

        {/* All advanced tool results shown inline — no clicks needed */}
        <div className="space-y-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const result = toolResults[tool.id];
            const isLoading = toolLoading === tool.id;
            const error = toolErrors[tool.id];
            return (
              <div key={tool.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-gray-900">{tool.name}</span>
                  {isLoading && <Loader2 className="w-3 h-3 animate-spin text-purple-600 ml-auto" />}
                  {result?.success && !isLoading && <Check className="w-3 h-3 text-green-600 ml-auto" />}
                  {error && !isLoading && <XCircle className="w-3 h-3 text-red-500 ml-auto" />}
                  {!result && !isLoading && !error && (
                    <button
                      onClick={() => runTool(tool.id, tool.endpoint)}
                      className="ml-auto text-xs text-purple-600 hover:underline"
                    >
                      Run
                    </button>
                  )}
                </div>
                {result?.success && <ToolResultDisplay toolId={tool.id} data={result} />}
                {error && <p className="text-xs text-red-600">{error}</p>}
                {!result && !isLoading && !error && <p className="text-[11px] text-gray-500">Not yet run.</p>}
              </div>
            );
          })}
        </div>

        {/* Schema Generator + Search Intent + Keyword Difficulty (standalone tools) */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-3">Standalone Tools</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StandaloneTool
              title="Schema Generator"
              icon={Code2}
              placeholder="Type: Organization, Article, Product, LocalBusiness"
              buttonText="Generate"
              onSubmit={async (input) => {
                const res = await fetch('/api/seo/schema-generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                  body: JSON.stringify({ type: input, data: { name: url, url } }),
                });
                return res.json();
              }}
              renderResult={(data) => (
                <div>
                  <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-auto max-h-60">{data.schema}</pre>
                  <CopyButton text={data.html || data.schema || ''} label="Copy HTML" />
                </div>
              )}
            />
            <StandaloneTool
              title="Search Intent"
              icon={Brain}
              placeholder="Enter a keyword..."
              buttonText="Analyze"
              onSubmit={async (input) => {
                const res = await fetch('/api/seo/search-intent', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                  body: JSON.stringify({ keyword: input }),
                });
                return res.json();
              }}
              renderResult={(data) => (
                <div className="space-y-1">
                  <p className="text-sm"><span className="font-semibold text-gray-900">Intent:</span> <span className="capitalize text-purple-600">{data.intent}</span></p>
                  <p className="text-sm"><span className="font-semibold text-gray-900">Confidence:</span> {data.confidence}%</p>
                  {data.signals && <p className="text-xs text-gray-700">Signals: {data.signals.join(', ')}</p>}
                </div>
              )}
            />
            <StandaloneTool
              title="Keyword Difficulty"
              icon={BarChart3}
              placeholder="Enter a keyword..."
              buttonText="Estimate"
              onSubmit={async (input) => {
                const res = await fetch('/api/seo/keyword-difficulty', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                  body: JSON.stringify({ keyword: input }),
                });
                return res.json();
              }}
              renderResult={(data) => (
                <div className="space-y-1">
                  <p className="text-sm"><span className="font-semibold text-gray-900">Difficulty:</span> <span className={data.difficulty > 60 ? 'text-red-600' : data.difficulty > 30 ? 'text-yellow-600' : 'text-green-600'}>{data.difficulty}/100 ({data.level})</span></p>
                  {data.factors && <p className="text-xs text-gray-700">{data.factors.map((f: any) => f.label).join(', ')}</p>}
                </div>
              )}
            />
          </div>
        </div>

        {/* Duplicate Content Checker */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <DuplicateContentChecker getAuthHeader={getAuthHeader} url1={url} />
        </div>
      </div>
    </motion.div>
  );
}

function ToolResultDisplay({ toolId, data }: { toolId: string; data: any }) {
  if (toolId === 'schema-check') {
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm">Schema Markup Results</h3>
        {!data.hasSchema ? (
          <p className="text-sm text-red-600">No structured data (JSON-LD) found on this page. Add schema markup to improve search visibility.</p>
        ) : (
          <>
            <p className="text-sm text-green-700">{data.count} schema(s) found.</p>
            {data.schemas?.map((s: any, i: number) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-900">{s.type || 'Unknown'}</span>
                  {s.valid ? <Check className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-500" />}
                </div>
                {s.errors?.length > 0 && <p className="text-xs text-red-600">{s.errors.join(', ')}</p>}
                {s.warnings?.length > 0 && <p className="text-xs text-yellow-600">{s.warnings.join(', ')}</p>}
              </div>
            ))}
          </>
        )}
      </div>
    );
  }
  if (toolId === 'redirect-check') {
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm">Redirect Chain</h3>
        <p className="text-sm text-gray-700">Total redirects: {data.totalRedirects} | Final URL: {data.finalUrl}</p>
        {data.hasLoop && <p className="text-sm text-red-600">⚠ Redirect loop detected!</p>}
        {data.isChain && <p className="text-sm text-yellow-600">⚠ Redirect chain found — consider redirecting directly to the final URL.</p>}
        {data.chain?.map((hop: any, i: number) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-2 text-xs">
            <span className="font-mono text-gray-700">{hop.status}</span> → {hop.url}
            {hop.type && <span className="ml-2 text-purple-600">{hop.type}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (toolId === 'internal-links') {
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm">Internal Links ({data.totalLinks || 0} found)</h3>
        <p className="text-sm text-gray-700">External links: {data.externalLinksCount || 0}</p>
        {data.internalLinks?.slice(0, 10).map((link: any, i: number) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-2 text-xs">
            <span className="font-mono text-gray-700 truncate block">{link.url}</span>
            <span className="text-gray-600">Anchor: "{link.anchorText}" {link.nofollow && ' (nofollow)'}</span>
          </div>
        ))}
        {data.suggestions?.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-700">Suggestions:</p>
            {data.suggestions.map((s: string, i: number) => <p key={i} className="text-xs text-gray-600">• {s}</p>)}
          </div>
        )}
      </div>
    );
  }
  if (toolId === 'core-web-vitals') {
    const m = data.metrics || {};
    const scoreColor = (val: string, target: string) => val === 'Good' ? 'text-green-600' : val === 'Poor' ? 'text-red-600' : 'text-yellow-600';
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm">Core Web Vitals</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {m.lcp && <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-xs text-gray-600">LCP</p><p className={`text-sm font-bold ${scoreColor(m.lcp.rating, '2.5s')}`}>{m.lcp.value}</p></div>}
          {m.cls && <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-xs text-gray-600">CLS</p><p className={`text-sm font-bold ${scoreColor(m.cls.rating, '0.1')}`}>{m.cls.value}</p></div>}
          {m.fcp && <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-xs text-gray-600">FCP</p><p className={`text-sm font-bold ${scoreColor(m.fcp.rating, '1.8s')}`}>{m.fcp.value}</p></div>}
          {m.tbt && <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-xs text-gray-600">TBT</p><p className={`text-sm font-bold ${scoreColor(m.tbt.rating, '200ms')}`}>{m.tbt.value}</p></div>}
        </div>
        <div className="flex gap-3 mt-2">
          {data.scores && <>
            <span className="text-xs text-gray-700">Performance: <span className="font-bold text-purple-600">{data.scores.performance}</span></span>
            <span className="text-xs text-gray-700">SEO: <span className="font-bold text-purple-600">{data.scores.seo}</span></span>
          </>}
        </div>
      </div>
    );
  }
  if (toolId === 'canonical-check') {
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm">Canonical Tag Check</h3>
        <p className="text-sm text-gray-700">Canonical: <span className="font-mono text-xs">{data.canonical || 'None found'}</span></p>
        <p className="text-sm text-gray-700">og:url: <span className="font-mono text-xs">{data.ogUrl || 'None found'}</span></p>
        <p className="text-sm text-gray-700">Has hreflang: {data.hasHreflang ? '✅ Yes' : '❌ No'}</p>
        {data.issues?.length > 0 ? (
          <div className="space-y-1">{data.issues.map((issue: string, i: number) => <p key={i} className="text-xs text-red-600">⚠ {issue}</p>)}</div>
        ) : <p className="text-xs text-green-600">✅ Canonical tag is properly configured.</p>}
      </div>
    );
  }
  if (toolId === 'thin-content') {
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm">Content Quality Check</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-xs text-gray-600">Words</p><p className={`text-sm font-bold ${data.wordCount < 300 ? 'text-red-600' : data.wordCount < 600 ? 'text-yellow-600' : 'text-green-600'}`}>{data.wordCount}</p></div>
          <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-xs text-gray-600">Sentences</p><p className="text-sm font-bold text-gray-900">{data.sentenceCount}</p></div>
          <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-xs text-gray-600">Paragraphs</p><p className="text-sm font-bold text-gray-900">{data.paragraphCount}</p></div>
          <div className="bg-white border border-gray-200 rounded-lg p-2"><p className="text-xs text-gray-600">Avg w/s</p><p className="text-sm font-bold text-gray-900">{data.avgWordsPerSentence}</p></div>
        </div>
        <p className="text-sm"><span className="font-semibold text-gray-900">Level:</span> <span className={data.level === 'critical' ? 'text-red-600' : data.level === 'thin' ? 'text-yellow-600' : 'text-green-600'}>{data.level}</span></p>
        {data.issues?.length > 0 && <div className="space-y-1">{data.issues.map((issue: string, i: number) => <p key={i} className="text-xs text-red-600">⚠ {issue}</p>)}</div>}
      </div>
    );
  }
  if (toolId === 'orphan-pages') {
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm">Orphan Page Detection</h3>
        <p className="text-sm text-gray-700">Total internal pages found: {data.totalInternalPages}</p>
        <p className="text-sm"><span className="font-semibold text-gray-900">Orphan candidates:</span> <span className={data.orphanCount > 0 ? 'text-yellow-600' : 'text-green-600'}>{data.orphanCount}</span></p>
        {data.orphanCandidates?.length > 0 ? (
          <div className="space-y-1 max-h-40 overflow-auto">
            {data.orphanCandidates.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-2 text-xs">
                <span className="font-mono text-gray-700">{p.path}</span>
                <span className="text-gray-500 ml-2">({p.linkCount} link{p.linkCount === 1 ? '' : 's'})</span>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-green-600">✅ No orphan pages detected — all pages are well-linked.</p>}
      </div>
    );
  }
  return null;
}

function StandaloneTool({ title, icon: Icon, placeholder, buttonText, onSubmit, renderResult }: {
  title: string;
  icon: any;
  placeholder: string;
  buttonText: string;
  onSubmit: (input: string) => Promise<any>;
  renderResult: (data: any) => React.ReactNode;
}) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRun = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await onSubmit(input.trim());
      if (data.success) setResult(data);
      else setError(data.error || 'Failed');
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-purple-600" />
        <span className="text-xs font-semibold text-gray-900">{title}</span>
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 mb-2"
        disabled={loading}
      />
      <button
        onClick={handleRun}
        disabled={loading || !input.trim()}
        className="w-full py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50"
      >
        {loading ? 'Running...' : buttonText}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {result && <div className="mt-2">{renderResult(result)}</div>}
    </div>
  );
}

function DuplicateContentChecker({ getAuthHeader, url1 }: { getAuthHeader: () => Record<string, string>; url1: string }) {
  const [url2, setUrl2] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    if (!url2.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/seo/duplicate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ url1, url2: url2.trim() }),
      });
      const data = await res.json();
      if (data.success) setResult(data);
      else setError(data.error || 'Failed');
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-2">Duplicate Content Checker</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={url2}
          onChange={(e) => setUrl2(e.target.value)}
          placeholder="Compare with another URL..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900"
          disabled={loading}
        />
        <button
          onClick={handleCheck}
          disabled={loading || !url2.trim()}
          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Compare'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {result && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm"><span className="font-semibold text-gray-900">Similarity:</span> <span className={result.similarity > 70 ? 'text-red-600' : result.similarity > 40 ? 'text-yellow-600' : 'text-green-600'}>{result.similarity}%</span> ({result.level})</p>
          {result.recommendation && <p className="text-xs text-gray-700 mt-1">{result.recommendation}</p>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SEO Tools Panel (8 free tools) — kept for reference
// ============================================================

type ToolId =
  | 'schema-check'
  | 'schema-generate'
  | 'redirect-check'
  | 'search-intent'
  | 'keyword-difficulty'
  | 'internal-links'
  | 'duplicate-content'
  | 'core-web-vitals';

interface ToolMeta {
  id: ToolId;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
}

// ---- Tool result types (mirror API responses) ----
interface SchemaCheckItem {
  type: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  raw: unknown;
}
interface SchemaCheckResultData {
  hasSchema: boolean;
  count: number;
  schemas: SchemaCheckItem[];
  url?: string;
}

interface SchemaGenerateResultData {
  type: string;
  schema: string;
  html: string;
}

interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
  type: string;
}
interface RedirectCheckResultData {
  chain: RedirectHop[];
  finalUrl: string;
  totalRedirects: number;
  hasLoop: boolean;
  isChain: boolean;
  warnings: string[];
}

interface SearchIntentResultData {
  keyword: string;
  intent: string;
  confidence: number;
  signals: string[];
  suggestions: string[];
}

interface DifficultyFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
  delta: number;
}
interface KeywordDifficultyResultData {
  keyword: string;
  difficulty: number;
  level: string;
  factors: DifficultyFactor[];
}

interface InternalLinkItem {
  url: string;
  anchorText: string;
  nofollow: boolean;
  status: number | 'skipped' | 'error';
  isBroken: boolean;
}
interface InternalLinksResultData {
  totalLinks: number;
  internalLinksCount: number;
  externalLinksCount: number;
  internalLinks: InternalLinkItem[];
  externalLinks: string[];
  targetKeywords: string[];
  suggestions: string[];
}

interface DuplicateContentResultData {
  url1: string;
  url2: string;
  similarity: number;
  level: string;
  metrics: { jaccard: number; cosine: number; sentenceOverlap: number };
  commonSentences: string[];
  recommendation: string;
}

interface CwvMetric {
  id: string;
  title: string;
  value: number;
  unit: string;
  score: number | null;
  displayValue: string;
  target: string;
  status: 'good' | 'needs-improvement' | 'poor' | 'unknown';
}
interface CoreWebVitalsResultData {
  metrics: Record<string, CwvMetric | undefined>;
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

const TOOLS: ToolMeta[] = [
  {
    id: 'schema-check',
    name: 'Schema Markup Checker',
    description: 'Validate JSON-LD structured data on any page.',
    icon: Code2,
    gradient: 'from-purple-500 to-indigo-500',
    iconBg: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'schema-generate',
    name: 'Schema Generator',
    description: 'Generate valid JSON-LD for Organization, Article, Product, LocalBusiness.',
    icon: Wrench,
    gradient: 'from-blue-500 to-cyan-500',
    iconBg: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'redirect-check',
    name: 'Redirect Checker',
    description: 'Trace 301/302/307/308 redirect chains and loops.',
    icon: GitBranch,
    gradient: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'search-intent',
    name: 'Search Intent Detector',
    description: 'Classify any keyword by intent (transactional, informational, etc.).',
    icon: Brain,
    gradient: 'from-pink-500 to-rose-500',
    iconBg: 'bg-pink-100 text-pink-700',
  },
  {
    id: 'keyword-difficulty',
    name: 'Keyword Difficulty Estimator',
    description: 'Estimate keyword difficulty (0-100) with heuristics.',
    icon: BarChart3,
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'internal-links',
    name: 'Internal Link Analyzer',
    description: 'Audit internal links, anchor text, nofollow and broken links.',
    icon: Link2,
    gradient: 'from-indigo-500 to-violet-500',
    iconBg: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'duplicate-content',
    name: 'Duplicate Content Checker',
    description: 'Compare two URLs and detect duplicate content.',
    icon: Copy,
    gradient: 'from-fuchsia-500 to-pink-500',
    iconBg: 'bg-fuchsia-100 text-fuchsia-700',
  },
  {
    id: 'core-web-vitals',
    name: 'Core Web Vitals Report',
    description: 'Get LCP, CLS, FCP, TBT and PageSpeed scores via Google PSI.',
    icon: Gauge,
    gradient: 'from-cyan-500 to-blue-500',
    iconBg: 'bg-cyan-100 text-cyan-700',
  },
];

// Small reusable UI helpers
function ToolCard({ tool, onClick }: { tool: ToolMeta; onClick: () => void }) {
  const Icon = tool.icon;
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
    >
      <div className={`w-10 h-10 rounded-xl ${tool.iconBg} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-gray-900 text-sm mb-1">{tool.name}</h3>
      <p className="text-xs text-gray-600 leading-relaxed">{tool.description}</p>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-purple-600">
        Open tool <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </motion.button>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* noop */
        }
      }}
      className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" /> Copied
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" /> {label}
        </>
      )}
    </button>
  );
}

function CodeResultBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <Code2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-700 truncate">{label}</span>
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="text-xs leading-relaxed p-3 overflow-auto max-h-80 bg-gray-900 text-gray-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-red-700">
        <div className="font-semibold mb-0.5">Tool failed</div>
        {message}
      </div>
    </div>
  );
}

// ---- Schema Generator field configs ----
interface SchemaField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  textarea?: boolean;
}

const SCHEMA_FIELDS: Record<string, SchemaField[]> = {
  Organization: [
    { key: 'name', label: 'Organization Name', placeholder: 'Acme Inc.', required: true },
    { key: 'url', label: 'Website URL', placeholder: 'https://acme.com', required: true },
    { key: 'logo', label: 'Logo URL', placeholder: 'https://acme.com/logo.png' },
    { key: 'description', label: 'Description', placeholder: 'Short description...', textarea: true },
    { key: 'email', label: 'Email', placeholder: 'info@acme.com' },
    { key: 'phone', label: 'Phone', placeholder: '+1-555-0100' },
    { key: 'sameAs', label: 'Social Profiles (comma-separated)', placeholder: 'https://twitter.com/acme, https://github.com/acme' },
  ],
  Article: [
    { key: 'headline', label: 'Headline', placeholder: 'My Article Title', required: true },
    { key: 'author', label: 'Author', placeholder: 'Jane Doe', required: true },
    { key: 'datePublished', label: 'Date Published (YYYY-MM-DD)', placeholder: '2024-01-15', required: true },
    { key: 'image', label: 'Image URL', placeholder: 'https://...' },
    { key: 'publisher', label: 'Publisher Name', placeholder: 'Acme Blog' },
    { key: 'publisherLogo', label: 'Publisher Logo URL', placeholder: 'https://...' },
    { key: 'url', label: 'Article URL', placeholder: 'https://acme.com/article' },
  ],
  Product: [
    { key: 'name', label: 'Product Name', placeholder: 'Widget X', required: true },
    { key: 'description', label: 'Description', placeholder: 'Short description...', textarea: true },
    { key: 'brand', label: 'Brand', placeholder: 'Acme' },
    { key: 'image', label: 'Image URL', placeholder: 'https://...' },
    { key: 'sku', label: 'SKU', placeholder: 'WIDG-001' },
    { key: 'price', label: 'Price', placeholder: '29.99', required: true },
    { key: 'currency', label: 'Currency', placeholder: 'USD' },
    { key: 'availability', label: 'Availability', placeholder: 'https://schema.org/InStock' },
    { key: 'ratingValue', label: 'Rating Value', placeholder: '4.5' },
    { key: 'reviewCount', label: 'Review Count', placeholder: '128' },
  ],
  LocalBusiness: [
    { key: 'name', label: 'Business Name', placeholder: 'Acme Coffee', required: true },
    { key: 'url', label: 'Website URL', placeholder: 'https://acme.coffee', required: true },
    { key: 'telephone', label: 'Telephone', placeholder: '+1-555-0100' },
    { key: 'streetAddress', label: 'Street Address', placeholder: '123 Main St' },
    { key: 'addressLocality', label: 'City', placeholder: 'Springfield' },
    { key: 'addressRegion', label: 'State/Region', placeholder: 'IL' },
    { key: 'postalCode', label: 'Postal Code', placeholder: '62701' },
    { key: 'addressCountry', label: 'Country', placeholder: 'US' },
    { key: 'latitude', label: 'Latitude', placeholder: '39.78' },
    { key: 'longitude', label: 'Longitude', placeholder: '-89.64' },
    { key: 'openingHours', label: 'Opening Hours', placeholder: 'Mo-Fr 09:00-17:00' },
    { key: 'priceRange', label: 'Price Range', placeholder: '$$' },
  ],
};

function SeoToolsPanel() {
  const [openTool, setOpenTool] = useState<ToolId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  // Per-tool input state
  const [urlInput, setUrlInput] = useState('');
  const [url1Input, setUrl1Input] = useState('');
  const [url2Input, setUrl2Input] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [schemaType, setSchemaType] = useState<'Organization' | 'Article' | 'Product' | 'LocalBusiness'>('Organization');
  const [schemaData, setSchemaData] = useState<Record<string, string>>({});
  const [psiStrategy, setPsiStrategy] = useState<'mobile' | 'desktop'>('mobile');

  const resetState = () => {
    setError(null);
    setResult(null);
  };

  const closeTool = () => {
    setOpenTool(null);
    resetState();
  };

  const runTool = async (tool: ToolId) => {
    setLoading(true);
    resetState();
    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      switch (tool) {
        case 'schema-check':
          endpoint = '/api/seo/schema-check';
          body = { url: urlInput };
          break;
        case 'schema-generate':
          endpoint = '/api/seo/schema-generate';
          body = { type: schemaType, data: schemaData };
          break;
        case 'redirect-check':
          endpoint = '/api/seo/redirect-check';
          body = { url: urlInput };
          break;
        case 'search-intent':
          endpoint = '/api/seo/search-intent';
          body = { keyword: keywordInput };
          break;
        case 'keyword-difficulty':
          endpoint = '/api/seo/keyword-difficulty';
          body = { keyword: keywordInput };
          break;
        case 'internal-links':
          endpoint = '/api/seo/internal-links';
          body = { url: urlInput, keywords: keywordsInput };
          break;
        case 'duplicate-content':
          endpoint = '/api/seo/duplicate-content';
          body = { url1: url1Input, url2: url2Input };
          break;
        case 'core-web-vitals':
          endpoint = '/api/seo/core-web-vitals';
          body = { url: urlInput, strategy: psiStrategy };
          break;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success: boolean; error?: string; [key: string]: unknown };
      if (!data.success) {
        setError(data.error || 'Request failed.');
      } else {
        setResult(data as Record<string, unknown>);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const openMeta = TOOLS.find((t) => t.id === openTool) || null;

  return (
    <div className="space-y-6">
      {/* Intro card */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3">
          <Wrench className="w-6 h-6 flex-shrink-0" />
          <div>
            <h2 className="font-bold">8 Free SEO Tools</h2>
            <p className="text-sm text-purple-100">
              No paid APIs required. Pick a tool to get started.
            </p>
          </div>
        </div>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TOOLS.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onClick={() => {
              setOpenTool(tool.id);
              resetState();
            }}
          />
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {openMeta && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeTool}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal header */}
              <div className="p-5 border-b border-gray-200 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${openMeta.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <openMeta.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{openMeta.name}</h3>
                  <p className="text-xs text-gray-600 truncate">{openMeta.description}</p>
                </div>
                <button
                  onClick={closeTool}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-5 overflow-auto flex-1 space-y-4">
                {/* Inputs */}
                <ToolInputs
                  tool={openMeta.id}
                  urlInput={urlInput}
                  setUrlInput={setUrlInput}
                  url1Input={url1Input}
                  setUrl1Input={setUrl1Input}
                  url2Input={url2Input}
                  setUrl2Input={setUrl2Input}
                  keywordsInput={keywordsInput}
                  setKeywordsInput={setKeywordsInput}
                  keywordInput={keywordInput}
                  setKeywordInput={setKeywordInput}
                  schemaType={schemaType}
                  setSchemaType={setSchemaType}
                  schemaData={schemaData}
                  setSchemaData={setSchemaData}
                  psiStrategy={psiStrategy}
                  setPsiStrategy={setPsiStrategy}
                />

                {/* Run button */}
                <button
                  onClick={() => runTool(openMeta.id)}
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Running…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Run {openMeta.name}
                    </>
                  )}
                </button>

                {/* Error */}
                {error && <ErrorBanner message={error} />}

                {/* Result */}
                {result && !error && (
                  <ToolResult tool={openMeta.id} result={result as unknown} />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Inputs component ----
interface ToolInputsProps {
  tool: ToolId;
  urlInput: string;
  setUrlInput: (v: string) => void;
  url1Input: string;
  setUrl1Input: (v: string) => void;
  url2Input: string;
  setUrl2Input: (v: string) => void;
  keywordsInput: string;
  setKeywordsInput: (v: string) => void;
  keywordInput: string;
  setKeywordInput: (v: string) => void;
  schemaType: 'Organization' | 'Article' | 'Product' | 'LocalBusiness';
  setSchemaType: (v: 'Organization' | 'Article' | 'Product' | 'LocalBusiness') => void;
  schemaData: Record<string, string>;
  setSchemaData: (v: Record<string, string>) => void;
  psiStrategy: 'mobile' | 'desktop';
  setPsiStrategy: (v: 'mobile' | 'desktop') => void;
}

function InputLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-700 mb-1">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm text-gray-900';

function ToolInputs(props: ToolInputsProps) {
  switch (props.tool) {
    case 'schema-check':
    case 'redirect-check':
    case 'core-web-vitals':
      return (
        <div className="space-y-3">
          <div>
            <InputLabel required>URL</InputLabel>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={props.urlInput}
                onChange={(e) => props.setUrlInput(e.target.value)}
                placeholder="example.com or https://example.com/page"
                className={inputClass + ' pl-9'}
              />
            </div>
          </div>
          {props.tool === 'core-web-vitals' && (
            <div className="flex gap-2">
              {(['mobile', 'desktop'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => props.setPsiStrategy(s)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    props.psiStrategy === s
                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s === 'mobile' ? 'Mobile' : 'Desktop'}
                </button>
              ))}
            </div>
          )}
        </div>
      );

    case 'schema-generate':
      return (
        <div className="space-y-3">
          <div>
            <InputLabel required>Schema Type</InputLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Organization', 'Article', 'Product', 'LocalBusiness'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    props.setSchemaType(t);
                    props.setSchemaData({});
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition ${
                    props.schemaType === t
                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SCHEMA_FIELDS[props.schemaType].map((f) => (
              <div key={f.key} className={f.textarea ? 'sm:col-span-2' : ''}>
                <InputLabel required={f.required}>{f.label}</InputLabel>
                {f.textarea ? (
                  <textarea
                    value={props.schemaData[f.key] || ''}
                    onChange={(e) =>
                      props.setSchemaData({ ...props.schemaData, [f.key]: e.target.value })
                    }
                    placeholder={f.placeholder}
                    rows={2}
                    className={inputClass}
                  />
                ) : (
                  <input
                    type="text"
                    value={props.schemaData[f.key] || ''}
                    onChange={(e) =>
                      props.setSchemaData({ ...props.schemaData, [f.key]: e.target.value })
                    }
                    placeholder={f.placeholder}
                    className={inputClass}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case 'search-intent':
    case 'keyword-difficulty':
      return (
        <div className="space-y-3">
          <div>
            <InputLabel required>Keyword</InputLabel>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={props.keywordInput}
                onChange={(e) => props.setKeywordInput(e.target.value)}
                placeholder="e.g. best running shoes for beginners"
                className={inputClass + ' pl-9'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
              />
            </div>
          </div>
        </div>
      );

    case 'internal-links':
      return (
        <div className="space-y-3">
          <div>
            <InputLabel required>URL</InputLabel>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={props.urlInput}
                onChange={(e) => props.setUrlInput(e.target.value)}
                placeholder="example.com/page"
                className={inputClass + ' pl-9'}
              />
            </div>
          </div>
          <div>
            <InputLabel>Target keywords (comma-separated, optional)</InputLabel>
            <input
              type="text"
              value={props.keywordsInput}
              onChange={(e) => props.setKeywordsInput(e.target.value)}
              placeholder="running shoes, marathon, beginners"
              className={inputClass}
            />
          </div>
        </div>
      );

    case 'duplicate-content':
      return (
        <div className="space-y-3">
          <div>
            <InputLabel required>URL 1</InputLabel>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={props.url1Input}
                onChange={(e) => props.setUrl1Input(e.target.value)}
                placeholder="example.com/page-a"
                className={inputClass + ' pl-9'}
              />
            </div>
          </div>
          <div>
            <InputLabel required>URL 2</InputLabel>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={props.url2Input}
                onChange={(e) => props.setUrl2Input(e.target.value)}
                placeholder="example.com/page-b"
                className={inputClass + ' pl-9'}
              />
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ---- Result renderer ----
function ToolResult({ tool, result }: { tool: ToolId; result: unknown }) {
  switch (tool) {
    case 'schema-check':
      return <SchemaCheckResult result={result as SchemaCheckResultData} />;
    case 'schema-generate':
      return <SchemaGenerateResult result={result as SchemaGenerateResultData} />;
    case 'redirect-check':
      return <RedirectCheckResult result={result as RedirectCheckResultData} />;
    case 'search-intent':
      return <SearchIntentResult result={result as SearchIntentResultData} />;
    case 'keyword-difficulty':
      return <KeywordDifficultyResult result={result as KeywordDifficultyResultData} />;
    case 'internal-links':
      return <InternalLinksResult result={result as InternalLinksResultData} />;
    case 'duplicate-content':
      return <DuplicateContentResult result={result as DuplicateContentResultData} />;
    case 'core-web-vitals':
      return <CoreWebVitalsResult result={result as CoreWebVitalsResultData} />;
    default:
      return null;
  }
}

// ---- Result components ----

function ResultSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-xl bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-purple-600" />
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function SchemaCheckResult({ result }: { result: SchemaCheckResultData }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full border ${result.hasSchema ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {result.hasSchema ? `${result.count} schema block(s) found` : 'No schema found'}
        </span>
      </div>

      {!result.hasSchema && (
        <p className="text-sm text-gray-700">
          No JSON-LD structured data was found on this page. Use the Schema Generator to create markup.
        </p>
      )}

      {result.schemas?.map((s, i) => (
        <div key={i} className="border border-gray-200 rounded-xl bg-white p-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-mono text-sm font-semibold text-gray-900">{s.type || 'Unknown'}</span>
            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${s.valid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {s.valid ? 'valid' : 'invalid'}
            </span>
          </div>
          {s.errors?.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-red-700 mb-1">Errors</div>
              <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                {s.errors.map((e: string, j: number) => <li key={j}>{e}</li>)}
              </ul>
            </div>
          )}
          {s.warnings?.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-amber-700 mb-1">Warnings</div>
              <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5">
                {s.warnings.map((w: string, j: number) => <li key={j}>{w}</li>)}
              </ul>
            </div>
          )}
          {s.raw !== null && s.raw !== undefined && (
            <details className="mt-2">
              <summary className="text-xs text-purple-600 cursor-pointer font-medium">View raw JSON</summary>
              <pre className="text-[11px] bg-gray-900 text-gray-100 p-2 rounded mt-1 overflow-auto max-h-48">
                {JSON.stringify(s.raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function SchemaGenerateResult({ result }: { result: SchemaGenerateResultData }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm font-semibold text-gray-900">Generated {result.type} schema</span>
      </div>
      <CodeResultBlock code={result.schema} label="JSON-LD Schema" />
      <CodeResultBlock code={result.html} label="HTML Script Tag (paste into <head>)" />
    </div>
  );
}

function RedirectCheckResult({ result }: { result: RedirectCheckResultData }) {
  const statusColor = (type: string) => {
    if (type === '301' || type === '308') return 'bg-green-50 text-green-700 border-green-200';
    if (type === '302' || type === '307') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (type === 'loop') return 'bg-red-50 text-red-700 border-red-200';
    if (type === 'error') return 'bg-red-50 text-red-700 border-red-200';
    if (type === 'max_reached') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-gray-900">{result.totalRedirects}</div>
          <div className="text-[10px] text-gray-600 uppercase font-medium">Redirects</div>
        </div>
        <div className={`border rounded-lg p-2 text-center ${result.hasLoop ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className={`text-lg font-bold ${result.hasLoop ? 'text-red-700' : 'text-green-700'}`}>{result.hasLoop ? 'Yes' : 'No'}</div>
          <div className="text-[10px] text-gray-600 uppercase font-medium">Loop</div>
        </div>
        <div className={`border rounded-lg p-2 text-center ${result.isChain ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className={`text-lg font-bold ${result.isChain ? 'text-amber-700' : 'text-green-700'}`}>{result.isChain ? 'Yes' : 'No'}</div>
          <div className="text-[10px] text-gray-600 uppercase font-medium">Chain</div>
        </div>
      </div>

      <ResultSection title="Redirect chain" icon={GitBranch}>
        <div className="space-y-2">
          {result.chain?.map((hop, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${statusColor(hop.type)}`}>
                    {hop.status || hop.type}
                  </span>
                  <a
                    href={hop.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-600 hover:underline truncate"
                  >
                    {hop.url || '(empty)'}
                  </a>
                </div>
                {hop.location && (
                  <div className="text-[11px] text-gray-500 mt-0.5">→ {hop.location}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ResultSection>

      {result.finalUrl && (
        <div className="text-xs text-gray-700">
          <span className="font-semibold">Final URL:</span>{' '}
          <a href={result.finalUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline break-all">
            {result.finalUrl}
          </a>
        </div>
      )}

      {result.warnings?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-amber-700 mb-1">Warnings</div>
          <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
            {result.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function SearchIntentResult({ result }: { result: SearchIntentResultData }) {
  const intentMeta: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
    transactional: { color: 'bg-green-100 text-green-700 border-green-200', icon: ShoppingBag, label: 'Transactional' },
    commercial: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: BarChart3, label: 'Commercial' },
    informational: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Info, label: 'Informational' },
    navigational: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Compass, label: 'Navigational' },
    local: { color: 'bg-pink-100 text-pink-700 border-pink-200', icon: MapPin, label: 'Local' },
  };
  const meta = intentMeta[result.intent] || intentMeta.informational;
  const Icon = meta.icon;
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${meta.color}`}>
        <Icon className="w-6 h-6 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase opacity-80">Detected Intent</div>
          <div className="text-lg font-bold">{meta.label}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{result.confidence}%</div>
          <div className="text-[10px] uppercase opacity-80">confidence</div>
        </div>
      </div>

      {result.signals?.length > 0 && (
        <ResultSection title="Signals" icon={Brain}>
          <ul className="text-xs text-gray-700 space-y-1">
            {result.signals.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </ResultSection>
      )}

      {result.suggestions?.length > 0 && (
        <ResultSection title="Suggestions" icon={TrendingUp}>
          <ul className="text-xs text-gray-700 space-y-1.5">
            {result.suggestions.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5">
                <Target className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </ResultSection>
      )}
    </div>
  );
}

function KeywordDifficultyResult({ result }: { result: KeywordDifficultyResultData }) {
  const levelColor: Record<string, string> = {
    easy: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    hard: 'bg-orange-100 text-orange-700 border-orange-200',
    'very hard': 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 p-4 rounded-xl border bg-white border-gray-200">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg width="80" height="80" className="-rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={result.difficulty < 30 ? '#16a34a' : result.difficulty < 55 ? '#f59e0b' : result.difficulty < 80 ? '#f97316' : '#ef4444'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 34}
              strokeDashoffset={2 * Math.PI * 34 - (result.difficulty / 100) * 2 * Math.PI * 34}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-900">
            {result.difficulty}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase font-semibold">Difficulty Score</div>
          <span className={`inline-block mt-1 text-xs font-semibold uppercase px-2.5 py-1 rounded-full border ${levelColor[result.level] || ''}`}>
            {result.level}
          </span>
        </div>
      </div>

      <ResultSection title="Factors" icon={BarChart3}>
        <div className="space-y-2">
          {result.factors?.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0 ${
                f.impact === 'positive' ? 'bg-green-50 text-green-700' :
                f.impact === 'negative' ? 'bg-red-50 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {f.delta > 0 ? '+' : ''}{f.delta}
              </span>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{f.name}</div>
                <div className="text-gray-600">{f.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </ResultSection>
    </div>
  );
}

function InternalLinksResult({ result }: { result: InternalLinksResultData }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-gray-900">{result.internalLinksCount ?? 0}</div>
          <div className="text-[10px] text-gray-600 uppercase font-medium">Internal</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-gray-900">{result.externalLinksCount ?? 0}</div>
          <div className="text-[10px] text-gray-600 uppercase font-medium">External</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-gray-900">{result.totalLinks ?? 0}</div>
          <div className="text-[10px] text-gray-600 uppercase font-medium">Total</div>
        </div>
      </div>

      {result.suggestions?.length > 0 && (
        <ResultSection title="Suggestions" icon={Info}>
          <ul className="text-xs text-gray-700 space-y-1">
            {result.suggestions.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </ResultSection>
      )}

      <ResultSection title="Internal links" icon={Link2}>
        <div className="space-y-1.5 max-h-72 overflow-auto">
          {result.internalLinks?.length === 0 && (
            <p className="text-xs text-gray-500">No internal links found.</p>
          )}
          {result.internalLinks?.map((l, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
              <div className="flex-1 min-w-0">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline break-all block">
                  {l.url}
                </a>
                <div className="text-xs text-gray-700 mt-0.5 truncate">&ldquo;{l.anchorText}&rdquo;</div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {l.nofollow && (
                  <span className="text-[10px] font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">nofollow</span>
                )}
                {l.isBroken ? (
                  <span className="text-[10px] font-semibold uppercase bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                    broken ({String(l.status)})
                  </span>
                ) : l.status === 'skipped' ? (
                  <span className="text-[10px] font-semibold uppercase bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded">skipped</span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">{String(l.status)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ResultSection>
    </div>
  );
}

function DuplicateContentResult({ result }: { result: DuplicateContentResultData }) {
  const levelColor: Record<string, string> = {
    unique: 'bg-green-100 text-green-700 border-green-200',
    low: 'bg-green-100 text-green-700 border-green-200',
    moderate: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    duplicate: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 p-4 rounded-xl border bg-white border-gray-200">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg width="80" height="80" className="-rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={result.similarity < 30 ? '#16a34a' : result.similarity < 60 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 34}
              strokeDashoffset={2 * Math.PI * 34 - (result.similarity / 100) * 2 * Math.PI * 34}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-900">
            {result.similarity}%
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase font-semibold">Similarity</div>
          <span className={`inline-block mt-1 text-xs font-semibold uppercase px-2.5 py-1 rounded-full border ${levelColor[result.level] || ''}`}>
            {result.level}
          </span>
        </div>
      </div>

      {result.metrics && (
        <ResultSection title="Metrics breakdown" icon={BarChart3}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
              <div className="text-sm font-bold text-gray-900">{result.metrics.jaccard}%</div>
              <div className="text-[10px] text-gray-600 uppercase">Jaccard</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
              <div className="text-sm font-bold text-gray-900">{result.metrics.cosine}%</div>
              <div className="text-[10px] text-gray-600 uppercase">Cosine</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
              <div className="text-sm font-bold text-gray-900">{result.metrics.sentenceOverlap}%</div>
              <div className="text-[10px] text-gray-600 uppercase">Sentence</div>
            </div>
          </div>
        </ResultSection>
      )}

      {result.recommendation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <span className="font-semibold">Recommendation:</span> {result.recommendation}
        </div>
      )}

      {result.commonSentences?.length > 0 && (
        <ResultSection title={`Common sentences (${result.commonSentences.length})`} icon={Copy}>
          <ul className="text-xs text-gray-700 space-y-1.5 max-h-48 overflow-auto">
            {result.commonSentences.map((s: string, i: number) => (
              <li key={i} className="p-2 bg-gray-50 rounded">{s}</li>
            ))}
          </ul>
        </ResultSection>
      )}
    </div>
  );
}

function CoreWebVitalsResult({ result }: { result: CoreWebVitalsResultData }) {
  const scoreColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-600 border-gray-200';
    if (score >= 90) return 'bg-green-50 text-green-700 border-green-200';
    if (score >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };
  const metricColor = (status: string) => {
    if (status === 'good') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'needs-improvement') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'poor') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const metrics = result.metrics || {};
  const metricList = [
    { key: 'lcp', label: 'LCP', target: '< 2.5s' },
    { key: 'inp', label: 'INP', target: '< 200ms' },
    { key: 'cls', label: 'CLS', target: '< 0.1' },
    { key: 'fcp', label: 'FCP', target: '< 1.8s' },
    { key: 'tbt', label: 'TBT', target: '< 200ms' },
    { key: 'speedIndex', label: 'Speed Index', target: '< 3.4s' },
  ].filter((m) => metrics[m.key]);

  const scoreList: Array<{ key: keyof CoreWebVitalsResultData['scores']; label: string }> = [
    { key: 'performance', label: 'Performance' },
    { key: 'seo', label: 'SEO' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'bestPractices', label: 'Best Practices' },
  ];

  return (
    <div className="space-y-3">
      <ResultSection title="Scores" icon={Gauge}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {scoreList.map((s) => {
            const v = result.scores?.[s.key];
            return (
              <div key={s.key} className={`border rounded-lg p-2 text-center ${scoreColor(v)}`}>
                <div className="text-xl font-bold">{v === null ? '—' : v}</div>
                <div className="text-[10px] uppercase font-medium">{s.label}</div>
              </div>
            );
          })}
        </div>
      </ResultSection>

      {metricList.length > 0 && (
        <ResultSection title="Core Web Vitals" icon={Gauge}>
          <div className="space-y-1.5">
            {metricList.map((m) => {
              const metric = metrics[m.key];
              if (!metric) return null;
              return (
                <div key={m.key} className={`flex items-center justify-between p-2 rounded-lg border ${metricColor(metric.status)}`}>
                  <div>
                    <div className="text-xs font-semibold uppercase">{m.label}</div>
                    <div className="text-[10px] opacity-75">Target: {m.target}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{metric.displayValue}</div>
                    <div className="text-[10px] uppercase">{metric.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ResultSection>
      )}

      {result.recommendations?.length > 0 && (
        <ResultSection title="Recommendations" icon={TrendingUp}>
          <ul className="text-xs text-gray-700 space-y-1.5">
            {result.recommendations.map((r: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 text-purple-500 mt-0.5 flex-shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </ResultSection>
      )}

      <div className="text-[11px] text-gray-500">
        Measured on {result.fetchTime ? new Date(result.fetchTime).toLocaleString() : 'N/A'} · URL: {result.finalUrl}
      </div>
    </div>
  );
}
