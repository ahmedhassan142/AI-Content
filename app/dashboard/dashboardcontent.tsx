'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Sparkles, FileText, PenTool, Save, Download,
  Search, ShieldCheck, SpellCheck, History, Star,
  Copy, Check, Loader2, Wand2, TrendingUp, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GuestStorage } from '@/lib/GuestStorage';

export default function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, guestSession, isGuest, remainingGenerations, trackGeneration } = useAuth();
  
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
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [enhancedContent, setEnhancedContent] = useState('');
  const [enhancedScore, setEnhancedScore] = useState<number | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    const viewParam = searchParams.get('view');
    const editParam = searchParams.get('edit');
    
    if (viewParam === 'content') {
      loadContentFromId();
    } else if (editParam === 'true') {
      loadEditContent();
    }
  }, [searchParams]);

  const checkSession = async () => {
    setLoading(false);
  };

  const loadContentFromId = async () => {
    const contentId = sessionStorage.getItem('viewContentId');
    if (!contentId) return;
    
    try {
      const res = await fetch(`/api/content/${contentId}`);
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
    
    if (isGuest && remainingGenerations <= 0) {
      alert('You have reached your free limit. Please sign up to continue generating content!');
      router.push('/signup');
      return;
    }
    
    setGenerating(true);
    setContent('');
    
    try {
      if (isGuest) {
        const canGenerate = await trackGeneration();
        if (!canGenerate) {
          alert('You have reached your free limit. Please sign up to continue!');
          router.push('/signup');
          setGenerating(false);
          return;
        }
      }
      
      const requestBody: any = { prompt, tone, length, language };
      
      if (isGuest && guestSession) {
        requestBody.isGuest = true;
        requestBody.guestSessionId = guestSession.id;
      }
      
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setContent(data.content);
        setSeoKeywords(data.seoKeywords);
        setPlagiarismScore(data.plagiarismScore);
        setGrammarIssues(data.grammarIssues);
        setTitle(prompt.slice(0, 50));
      } else {
        console.error('Generation failed:', data.error);
        if (data.error === 'Unauthorized - No token provided') {
          router.push('/login');
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);
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
        headers: { 'Content-Type': 'application/json' },
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
    
    try {
      const requestBody: any = { 
        content: content,
        aspect: 'plagiarism',
        currentScore: plagiarismScore 
      };
      
      if (isGuest && guestSession) {
        requestBody.isGuest = true;
        requestBody.guestSessionId = guestSession.id;
      }
      
      const res = await fetch('/api/content/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setEnhancedContent(data.content);
        setEnhancedScore(data.newScore);
        setShowEnhanceModal(true);
      } else {
        alert('Failed to enhance content: ' + data.error);
      }
    } catch (error) {
      console.error('Enhance failed:', error);
      alert('Failed to enhance content. Please try again.');
    } finally {
      setEnhancing(false);
    }
  };

  const applyEnhancement = () => {
    setContent(enhancedContent);
    if (enhancedScore !== null) {
      setPlagiarismScore(enhancedScore);
    }
    setShowEnhanceModal(false);
    setEnhancedContent('');
    setEnhancedScore(null);
    alert('Content enhanced successfully! The content is now more unique.');
  };

  const getPlagiarismColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 30) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPlagiarismMessage = (score: number) => {
    if (score >= 85) return 'Excellent! Very unique content';
    if (score >= 70) return 'Good! Content is mostly original';
    if (score >= 50) return 'Fair - Consider enhancing for better uniqueness';
    if (score >= 30) return 'Poor - Enhancement recommended';
    return 'Very Poor - Enhancement strongly recommended';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Guest Banner */}
        {isGuest && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <p className="text-yellow-800 font-medium">
                  🎉 You have {remainingGenerations} free {remainingGenerations === 1 ? 'generation' : 'generations'} remaining!
                </p>
                <p className="text-yellow-600 text-sm">
                  Sign up to unlock unlimited generations and save your content permanently.
                </p>
              </div>
              <Link
                href="/signup"
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm"
              >
                Sign Up Now
              </Link>
            </div>
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
                className="w-full h-32 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-gray-800 placeholder-gray-400"
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

            {plagiarismScore !== null && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm p-6"
              >
                <h3 className="font-semibold flex items-center gap-2 mb-3 text-gray-800">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  Plagiarism Check
                </h3>
                <div className={`text-2xl font-bold ${getPlagiarismColor(plagiarismScore)}`}>
                  {plagiarismScore}% <span className="text-sm font-normal text-gray-600">unique</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      plagiarismScore >= 70 ? 'bg-green-500' : 
                      plagiarismScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${plagiarismScore}%` }} 
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {getPlagiarismMessage(plagiarismScore)}
                </p>
                
                {plagiarismScore < 70 && (
                  <button
                    onClick={enhanceContent}
                    disabled={enhancing}
                    className="mt-3 w-full py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-100 transition flex items-center justify-center gap-2"
                  >
                    {enhancing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    Reduce Plagiarism
                  </button>
                )}
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
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 placeholder-gray-400"
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
                  <button
                    onClick={enhanceContent}
                    disabled={!content || enhancing}
                    className="p-2 hover:bg-purple-50 rounded-lg transition relative group"
                    title="Reduce Plagiarism"
                  >
                    {enhancing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    ) : (
                      <Wand2 className="w-5 h-5 text-purple-600" />
                    )}
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {generating ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
                    <p className="text-gray-700">AI is writing your content...</p>
                  </div>
                ) : content ? (
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800">
                      {content}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600">Your generated content will appear here</p>
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

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/history')}
                className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition text-left flex items-center gap-3 group"
              >
                <History className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="font-semibold text-gray-800 group-hover:text-purple-600 transition">View History</p>
                  <p className="text-xs text-gray-600">See all your saved content</p>
                </div>
              </button>
              <button
                onClick={() => router.push('/favorites')}
                className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition text-left flex items-center gap-3 group"
              >
                <Star className="w-6 h-6 text-yellow-600" />
                <div>
                  <p className="font-semibold text-gray-800 group-hover:text-yellow-600 transition">Favorites</p>
                  <p className="text-xs text-gray-600">Your favorite content</p>
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
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Enhanced Content
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    More unique and original version with reduced plagiarism
                  </p>
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
                  <div className={`p-3 rounded-lg ${plagiarismScore && plagiarismScore < 70 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <p className="text-sm text-gray-600 font-medium">Original Score</p>
                    <p className={`text-2xl font-bold ${plagiarismScore && getPlagiarismColor(plagiarismScore)}`}>
                      {plagiarismScore}%
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Enhanced Score</p>
                    <p className="text-2xl font-bold text-green-700">
                      {enhancedScore !== null ? `${enhancedScore}%` : 'Calculating...'}
                    </p>
                    {enhancedScore !== null && plagiarismScore && (
                      <p className="text-xs text-green-600 mt-1">
                        {enhancedScore > plagiarismScore ? `+${enhancedScore - plagiarismScore}% improvement` : 'Similar score'}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Enhanced Content:</h4>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
                    <div className="whitespace-pre-wrap text-gray-800 text-sm">
                      {enhancedContent}
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  <p className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    The enhanced content has been rewritten to be more unique and original. Apply it to see the improved plagiarism score.
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
                  Apply Enhanced Content
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}