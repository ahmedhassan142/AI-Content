'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Sparkles, FileText, PenTool, Save, Download,
  Search, ShieldCheck, SpellCheck, History, Star,
  Copy, Check, Loader2, Wand2, TrendingUp, AlertCircle,
  Shield, Bot, Repeat, Hash, Eye, XCircle, CheckCircle2, ArrowRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GuestStorage } from '@/lib/GuestStorage';

type Risk = 'safe' | 'low' | 'medium' | 'high';
interface SentenceAnalysis { text: string; risk: Risk; riskScore: number; reasons: string[]; }
interface ParagraphAnalysis {
  index: number; text: string; wordCount: number; risk: Risk;
  fixType: 'rewrite' | 'add_citation' | 'add_example' | 'remove' | 'keep';
  issues: string[]; sentences: SentenceAnalysis[]; suggestion: string;
}
interface ChecklistItem { id?: string; label: string; passed: boolean; detail?: string; description?: string; }
interface PlagiarismReport {
  originalityScore: number; plagiarismRisk: number; humanQualityScore: number;
  paragraphs: ParagraphAnalysis[];
  genericPhrasesFound: Array<{ phrase: string; count: number; suggestion: string }>;
  aiPhrasesFound: Array<{ phrase: string; count: number; suggestion: string }>;
  repeatedSentences: string[];
  keywordStuffing: Array<{ word: string; count: number; expectedMax: number }>;
  topKeywords: Array<{ word: string; count: number; frequency: number }>;
  originalityChecklist: ChecklistItem[]; humanQualityChecklist: ChecklistItem[]; seoChecklist: ChecklistItem[];
  stats: { wordCount: number; sentenceCount: number; paragraphCount: number; avgWordsPerSentence: number; uniqueWordRatio: number; longSentenceCount: number; };
}

const scoreColor = (score: number) => {
  if (score >= 85) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};
const scoreBar = (score: number) => {
  if (score >= 85) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};
const riskBadgeColor = (risk: Risk) => {
  switch (risk) {
    case 'safe': return 'bg-green-100 text-green-800';
    case 'low': return 'bg-yellow-100 text-yellow-800';
    case 'medium': return 'bg-orange-100 text-orange-800';
    case 'high': return 'bg-red-100 text-red-800';
  }
};

export default function DashboardContent() {
  const router = useRouter();
  const { user, guestSession, isGuest, getAuthHeader } = useAuth();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [language, setLanguage] = useState('English');
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [plagiarismScore, setPlagiarismScore] = useState<number | null>(null);
  const [grammarIssues, setGrammarIssues] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const [enhancing, setEnhancing] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [enhancedContent, setEnhancedContent] = useState('');
  const [enhancedScore, setEnhancedScore] = useState<number | null>(null);
  const [plagiarismReport, setPlagiarismReport] = useState<PlagiarismReport | null>(null);
  const [enhanceChanges, setEnhanceChanges] = useState<Array<{type: string; before: string; after: string; description?: string}>>([]);
  const [enhancedReport, setEnhancedReport] = useState<PlagiarismReport | null>(null);
  const [enhanceMode, setEnhanceMode] = useState<'plagiarism' | 'humanize'>('plagiarism');
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const editParam = params.get('edit');

    if (viewParam === 'content') {
      loadContentFromId();
    } else if (editParam === 'true') {
      loadEditContent();
    }
  }, []);

  const checkSession = async () => {
    setLoading(false);
  };

  const loadContentFromId = async () => {
    const contentId = sessionStorage.getItem('viewContentId');
    if (!contentId) return;

    try {
      const res = await fetch(`/api/content/${contentId}`, {
        headers: { ...getAuthHeader() },
      });
      const data = await res.json();

      if (data.success && data.content) {
        setContent(data.content.content);
        setTitle(data.content.title);
        setSeoKeywords(data.content.seoKeywords || []);
        setPlagiarismScore(data.content.plagiarismScore || null);
        setGrammarIssues(data.content.grammarIssues || []);
        setTone(data.content.tone || 'professional');
        setLength(data.content.length || 'medium');
        setLanguage(data.content.language || 'English');

        sessionStorage.removeItem('viewContentId');
      }
    } catch (error) {
      console.error('Failed to load content:', error);
    }
  };

  const loadEditContent = () => {
    const editContent = sessionStorage.getItem('editContent');
    if (editContent) {
      try {
        const content = JSON.parse(editContent);
        setContent(content.content);
        setTitle(content.title);
        setSeoKeywords(content.seoKeywords || []);
        setPlagiarismScore(content.plagiarismScore || null);
        setGrammarIssues(content.grammarIssues || []);
        setTone(content.tone || 'professional');
        setLength(content.length || 'medium');
        setLanguage(content.language || 'English');
        sessionStorage.removeItem('editContent');
      } catch (error) {
        console.error('Failed to load edit content:', error);
      }
    }
  };

  const generateContent = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setContent('');
    setGenError(null);
    setPlagiarismReport(null);
    setPlagiarismScore(null);
    setSeoKeywords([]);
    setGrammarIssues([]);

    try {
      const requestBody: any = { prompt, tone, length, language };

      if (isGuest && guestSession) {
        requestBody.isGuest = true;
        requestBody.guestSessionId = guestSession.id;
      }

      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.success) {
        setContent(data.content);
        setSeoKeywords(data.seoKeywords || []);
        setPlagiarismScore(data.plagiarismScore ?? null);
        setGrammarIssues(data.grammarIssues || []);
        setTitle(prompt.slice(0, 50));
        if (data.plagiarismReport) {
          setPlagiarismReport(data.plagiarismReport);
        }
      } else {
        console.error('Generation failed:', data.error);
        if (res.status === 401) {
          router.push('/login');
        } else if (res.status === 503) {
          setGenError('AI service (Groq) is temporarily unavailable. Please try again in a moment.');
        } else {
          setGenError(data.error || 'Failed to generate content.');
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);
      setGenError('Failed to generate content. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const saveContent = async () => {
    if (!content || !title) return;

    setSaving(true);

    if (isGuest) {
      try {
        GuestStorage.saveContent({
          title,
          content,
          type: 'generated',
          tone,
          length,
          language,
          seoKeywords,
          plagiarismScore: plagiarismScore || undefined,
          isFavorite: false,
        });
        alert('Content saved locally! Sign up to save permanently.');
        setSaving(false);
        return;
      } catch (error) {
        console.error('Save failed:', error);
        alert('Failed to save content');
        setSaving(false);
        return;
      }
    }

    try {
      const requestBody: any = {
        title,
        content,
        type: 'generated',
        tone,
        length,
        language,
        seoKeywords,
        plagiarismScore,
      };

      if (isGuest && guestSession) {
        requestBody.isGuest = true;
        requestBody.guestSessionId = guestSession.id;
      }

      const res = await fetch('/api/content/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        alert('Content saved successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save content');
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportContent = (format: string) => {
    if (format === 'txt') {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'content'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const enhanceContent = async () => {
    if (!content) return;

    setEnhancing(true);
    setEnhanceMode('plagiarism');
    setGenError(null);

    try {
      const requestBody: any = {
        content: content,
        title,
        keywords: seoKeywords,
        aspect: 'plagiarism',
        currentScore: plagiarismScore,
      };

      if (isGuest && guestSession) {
        requestBody.isGuest = true;
        requestBody.guestSessionId = guestSession.id;
      }

      const res = await fetch('/api/content/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.success) {
        setEnhancedContent(data.content);
        setEnhancedScore(data.newScore ?? null);
        setEnhanceChanges(data.changes || []);
        setEnhancedReport(data.newReport || data.plagiarismReport || null);
        setShowEnhanceModal(true);
      } else {
        alert('Failed to fix plagiarism' + (data.error ? `: ${data.error}` : ''));
      }
    } catch (error) {
      console.error('Enhance failed:', error);
      alert('Failed to fix plagiarism. Please try again.');
    } finally {
      setEnhancing(false);
    }
  };

  const humanizeContentFn = async () => {
    if (!content) return;

    setHumanizing(true);
    setEnhanceMode('humanize');
    setGenError(null);

    try {
      const requestBody: any = {
        content: content,
        title,
        keywords: seoKeywords,
      };

      if (isGuest && guestSession) {
        requestBody.isGuest = true;
        requestBody.guestSessionId = guestSession.id;
      }

      const res = await fetch('/api/content/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.success) {
        setEnhancedContent(data.content);
        setEnhancedScore(data.newScore ?? null);
        setEnhanceChanges(data.changes || []);
        setEnhancedReport(data.newReport || null);
        setShowEnhanceModal(true);
      } else {
        alert('Failed to humanize content' + (data.error ? `: ${data.error}` : ''));
      }
    } catch (error) {
      console.error('Humanize failed:', error);
      alert('Failed to humanize content. Please try again.');
    } finally {
      setHumanizing(false);
    }
  };

  const applyEnhancement = () => {
    setContent(enhancedContent);
    if (enhancedScore !== null) {
      setPlagiarismScore(enhancedScore);
    }
    if (enhancedReport) {
      setPlagiarismReport(enhancedReport);
    }
    setShowEnhanceModal(false);
    setEnhancedContent('');
    setEnhancedScore(null);
    setEnhanceChanges([]);
    setEnhancedReport(null);
    alert(enhanceMode === 'humanize' ? 'Content humanized successfully!' : 'Content fixed successfully!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const riskyParagraphs = plagiarismReport?.paragraphs?.filter(p => p.risk !== 'safe') || [];
  const originalScoreForModal = plagiarismReport
    ? (enhanceMode === 'humanize' ? plagiarismReport.humanQualityScore : plagiarismReport.originalityScore)
    : (plagiarismScore ?? 0);
  const newScoreForModal = enhancedReport
    ? (enhanceMode === 'humanize' ? enhancedReport.humanQualityScore : enhancedReport.originalityScore)
    : (enhancedScore ?? 0);

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Guest Banner */}
        {isGuest && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex justify-between items-center gap-4">
            <p className="text-yellow-800 text-sm font-medium">✨ Guest mode — unlimited generations. Sign up to save.</p>
            <Link
              href="/signup"
              className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm whitespace-nowrap"
            >
              Sign Up
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input Section */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-sm p-6 space-y-4"
            >
              <h2 className="font-semibold text-lg flex items-center gap-2 text-gray-800">
                <PenTool className="w-5 h-5 text-purple-600" />
                Content Settings
              </h2>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your content prompt or topic..."
                className="w-full h-32 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-gray-800 placeholder-gray-600"
              />

              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="friendly">Friendly</option>
                <option value="persuasive">Persuasive</option>
                <option value="humorous">Humorous</option>
              </select>

              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
              >
                <option value="short">Short (100-200 words)</option>
                <option value="medium">Medium (300-500 words)</option>
                <option value="long">Long (800-1200 words)</option>
              </select>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
              >
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
                <option>German</option>
                <option>Chinese</option>
                <option>Japanese</option>
              </select>

              <button
                onClick={generateContent}
                disabled={generating || !prompt}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2.5 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Content
                  </>
                )}
              </button>
            </motion.div>

            {seoKeywords.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm p-6"
              >
                <h3 className="font-semibold flex items-center gap-2 mb-3 text-gray-800">
                  <Search className="w-5 h-5 text-green-600" />
                  SEO Keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {seoKeywords.map((kw, i) => (
                    <span key={i} className="px-2.5 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                      {kw}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {plagiarismReport && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm p-6 space-y-4"
              >
                <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                  <Shield className="w-5 h-5 text-purple-600" />
                  Originality &amp; Human Quality
                </h3>

                {/* Score boxes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl text-center">
                    <p className="text-xs text-gray-700 font-medium mb-1">Originality</p>
                    <p className={`text-2xl font-bold ${scoreColor(plagiarismReport.originalityScore)}`}>
                      {plagiarismReport.originalityScore}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full ${scoreBar(plagiarismReport.originalityScore)}`}
                        style={{ width: `${plagiarismReport.originalityScore}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-700 mt-1.5">
                      Risk: {plagiarismReport.plagiarismRisk}% · <span className="font-medium capitalize">{plagiarismReport.plagiarismRisk >= 31 ? 'high' : plagiarismReport.plagiarismRisk >= 16 ? 'medium' : plagiarismReport.plagiarismRisk >= 6 ? 'low' : 'safe'}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl text-center">
                    <p className="text-xs text-gray-700 font-medium mb-1">Human Quality</p>
                    <p className={`text-2xl font-bold ${scoreColor(plagiarismReport.humanQualityScore)}`}>
                      {plagiarismReport.humanQualityScore}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full ${scoreBar(plagiarismReport.humanQualityScore)}`}
                        style={{ width: `${plagiarismReport.humanQualityScore}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-700 mt-1.5">
                      {plagiarismReport.stats.wordCount} words · {plagiarismReport.stats.sentenceCount} sentences
                    </p>
                  </div>
                </div>

                {/* Generic phrases */}
                {plagiarismReport.genericPhrasesFound?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-800 mb-1.5 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Generic Phrases ({plagiarismReport.genericPhrasesFound.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {plagiarismReport.genericPhrasesFound.map((p, i) => (
                        <span key={i} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-md text-xs">{p.phrase}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI-typical phrases */}
                {plagiarismReport.aiPhrasesFound?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-800 mb-1.5 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      AI-Typical Phrases ({plagiarismReport.aiPhrasesFound.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {plagiarismReport.aiPhrasesFound.map((p, i) => (
                        <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-xs">{p.phrase}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repeated sentences */}
                {plagiarismReport.repeatedSentences?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-800 mb-1.5 flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5" />
                      Repeated Sentences ({plagiarismReport.repeatedSentences.length})
                    </p>
                    <ul className="space-y-1">
                      {plagiarismReport.repeatedSentences.slice(0, 3).map((s, i) => (
                        <li key={i} className="text-xs text-orange-900 bg-orange-50 rounded-md px-2 py-1 truncate">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Top keywords */}
                {plagiarismReport.topKeywords?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      Top Keywords
                      {plagiarismReport.keywordStuffing?.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-semibold">Stuffing Detected</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {plagiarismReport.topKeywords.slice(0, 8).map((k, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-md text-xs">
                          {k.word} <span className="text-gray-600">×{k.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}



                {/* Action buttons */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <button
                    onClick={enhanceContent}
                    disabled={enhancing || humanizing}
                    className="w-full py-2.5 bg-yellow-500 text-white rounded-xl text-sm font-semibold hover:bg-yellow-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {enhancing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fixing Plagiarism...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Fix Plagiarism (3-Layer)
                      </>
                    )}
                  </button>
                  <button
                    onClick={humanizeContentFn}
                    disabled={enhancing || humanizing}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {humanizing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Humanizing...
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4" />
                        Humanize Content
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Panel - Output Section */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="border-b border-gray-200 p-4 flex justify-between items-center flex-wrap gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter title..."
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 placeholder-gray-600"
                />
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    disabled={!content}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                    title="Copy"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-700" />}
                  </button>
                  <button
                    onClick={() => exportContent('txt')}
                    disabled={!content}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                    title="Download TXT"
                  >
                    <Download className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={saveContent}
                    disabled={!content || saving}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                    title="Save"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin text-purple-600" /> : <Save className="w-5 h-5 text-gray-700" />}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {generating ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
                    <p className="text-gray-700">AI is writing your content...</p>
                  </div>
                ) : genError ? (
                  <div className="py-12 px-4">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800">Generation Failed</p>
                        <p className="text-sm text-red-700 mt-1">{genError}</p>
                      </div>
                    </div>
                  </div>
                ) : content ? (
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800">
                      {content}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-700">Your generated content will appear here</p>
                  </div>
                )}
              </div>
            </motion.div>

            {grammarIssues.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4"
              >
                <h3 className="font-semibold flex items-center gap-2 mb-2 text-yellow-800">
                  <SpellCheck className="w-5 h-5" />
                  Grammar Suggestions
                </h3>
                <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                  {grammarIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Paragraph Fixer */}
            {riskyParagraphs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm p-6"
              >
                <h3 className="font-semibold flex items-center gap-2 mb-3 text-gray-800">
                  <Eye className="w-5 h-5 text-orange-600" />
                  Paragraph Fixer
                </h3>
                <div className="space-y-3">
                  {riskyParagraphs.map((p, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${riskBadgeColor(p.risk)}`}>
                          {p.risk} risk
                        </span>
                        {p.fixType && p.fixType !== 'keep' && (
                          <span className="text-xs text-gray-700 font-medium capitalize">
                            Fix: {p.fixType.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-800 mb-2 line-clamp-3">{p.text}</p>
                      {p.issues?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {p.issues.map((issue, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded">{issue}</span>
                          ))}
                        </div>
                      )}
                      {p.suggestion && (
                        <div className="bg-white border border-yellow-200 rounded-lg p-2">
                          <p className="text-[11px] font-semibold text-yellow-800 mb-0.5">Suggestion:</p>
                          <p className="text-xs text-gray-800">{p.suggestion}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Checklists */}
            {plagiarismReport && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ChecklistCard
                  title="Originality"
                  icon={<Shield className="w-4 h-4 text-purple-600" />}
                  items={plagiarismReport.originalityChecklist}
                />
                <ChecklistCard
                  title="Human Quality"
                  icon={<Bot className="w-4 h-4 text-blue-600" />}
                  items={plagiarismReport.humanQualityChecklist}
                />
                <ChecklistCard
                  title="SEO"
                  icon={<Search className="w-4 h-4 text-green-600" />}
                  items={plagiarismReport.seoChecklist}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/history')}
                className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition text-left flex items-center gap-3 group"
              >
                <History className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="font-semibold text-gray-800 group-hover:text-purple-600 transition">View History</p>
                  <p className="text-xs text-gray-700">See all your saved content</p>
                </div>
              </button>
              <button
                onClick={() => router.push('/favorites')}
                className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition text-left flex items-center gap-3 group"
              >
                <Star className="w-6 h-6 text-yellow-600" />
                <div>
                  <p className="font-semibold text-gray-800 group-hover:text-yellow-600 transition">Favorites</p>
                  <p className="text-xs text-gray-700">Your favorite content</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Enhancement Modal */}
      <AnimatePresence>
        {showEnhanceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    {enhanceMode === 'humanize' ? (
                      <>
                        <Bot className="w-5 h-5 text-blue-600" />
                        Humanizer Result
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5 text-yellow-600" />
                        Plagiarism Fixer — 3-Layer Result
                      </>
                    )}
                  </h3>
                </div>
                <button
                  onClick={() => setShowEnhanceModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-700 font-medium">
                      {enhanceMode === 'humanize' ? 'Original Human Quality Score' : 'Original Originality Score'}
                    </p>
                    <p className={`text-2xl font-bold ${scoreColor(originalScoreForModal)}`}>
                      {originalScoreForModal}%
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-green-700 font-medium">
                      {enhanceMode === 'humanize' ? 'New Human Quality Score' : 'New Originality Score'}
                    </p>
                    <p className="text-2xl font-bold text-green-700">
                      {newScoreForModal !== 0 ? `${newScoreForModal}%` : 'Calculating...'}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    {enhanceMode === 'humanize' ? 'Humanized Content:' : 'Fixed Content:'}
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-72 overflow-auto">
                    <div className="whitespace-pre-wrap text-gray-800 text-sm">
                      {enhancedContent}
                    </div>
                  </div>
                </div>

                {enhanceChanges.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Changes Applied ({enhanceChanges.length}):</h4>
                    <ul className="space-y-1.5 max-h-40 overflow-auto">
                      {enhanceChanges.map((c, i) => (
                        <li key={i} className="text-xs text-gray-800 flex items-start gap-2 p-2 bg-purple-50 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{c.description || `${c.type}: "${c.before}" → "${c.after}"`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  <p className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Content rewritten. Apply to use the improved version.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowEnhanceModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={applyEnhancement}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition"
                >
                  Apply Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChecklistCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: ChecklistItem[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm p-4"
    >
      <h4 className="font-semibold text-sm flex items-center gap-2 mb-2 text-gray-800">
        {icon}
        {title}
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            {item.passed ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-medium text-gray-800">{item.label}</p>
              {item.description && <p className="text-[11px] text-gray-700">{item.description}</p>}
              {item.detail && <p className="text-[11px] text-gray-700">{item.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
