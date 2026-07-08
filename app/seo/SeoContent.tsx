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
  const { isGuest, guestSession, getAuthHeader } = useAuth();

  const [url, setUrl] = useState('');
  const [fastMode, setFastMode] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

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
      // Build a summary of all fixes as content
      const fixSummary = fixResult.fixes
        .filter((f) => f.status === 'fixed')
        .map((f) => {
          const snippets = f.codeSnippets.map((s) => s.code).join('\n');
          return `## ${f.checkName}\n\n${f.fixDescription}\n\n\`\`\`\n${snippets}\n\`\`\``;
        })
        .join('\n\n');

      const title = `SEO Fixes for ${audit.url}`;
      const content = `# SEO Fix Report for ${audit.url}\n\n**Overall Score:** ${audit.overallScore}/100\n\n**Fixes Applied:**\n\n${fixSummary}`;

      if (applyTarget === 'wordpress') {
        if (!selectedWpSite) {
          setApplyResult({ success: false, message: 'Select a WordPress site first.' });
          setApplying(false);
          return;
        }
        const res = await fetch(`/api/wordpress/${selectedWpSite}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({
            title,
            content,
            status: 'draft',
            excerpt: `SEO fixes for ${audit.url} — Score: ${audit.overallScore}/100`,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setApplyResult({
            success: true,
            message: `SEO fixes published to WordPress as draft. Post ID: ${data.postId}`,
            postUrl: data.postUrl,
          });
        } else {
          setApplyResult({ success: false, message: data.error || 'Failed to publish to WordPress.' });
        }
      } else {
        // Send via webhook — save content triggers content.saved webhook
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
            message: 'SEO fixes sent to all connected webhook sites.',
          });
        } else {
          setApplyResult({ success: false, message: data.error || 'Failed to send via webhook.' });
        }
      }
    } catch (err: any) {
      setApplyResult({ success: false, message: err.message || 'Network error.' });
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

  return (
    <div className="bg-gray-50 min-h-screen pt-4 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SEO Audit &amp; Fixer</h1>
            <p className="text-sm text-gray-600">
              Audit any URL, then get ready-to-paste fixes.
            </p>
          </div>
        </div>

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
              {/* Summary card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                    <ScoreGauge score={audit.overallScore} />
                  </div>
                  <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {audit.passedChecks}
                      </div>
                      <div className="text-xs text-green-700 font-medium">Passed</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-amber-700">
                        {audit.warnedChecks}
                      </div>
                      <div className="text-xs text-amber-700 font-medium">Warnings</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-red-700">
                        {audit.failedChecks}
                      </div>
                      <div className="text-xs text-red-700 font-medium">Failed</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-gray-700">
                        {audit.totalChecks}
                      </div>
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
                        The target website's webhook receiver will store it in their database.
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
    </div>
  );
}
