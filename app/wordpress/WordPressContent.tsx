'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Plus,
  Trash2,
  Send,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface WordPressSite {
  _id: string;
  userId: string;
  siteName: string;
  siteUrl: string;
  wpUsername: string;
  defaultStatus: 'draft' | 'publish';
  defaultCategoryId?: number | null;
  isConnected: boolean;
  lastPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PublishForm {
  title: string;
  content: string;
  status: 'draft' | 'publish';
}

export default function WordPressContent() {
  const router = useRouter();
  const { getAuthHeader, user, loading: authLoading } = useAuth();

  const [sites, setSites] = useState<WordPressSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishSite, setPublishSite] = useState<WordPressSite | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'draft' | 'publish'>('draft');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishContent, setPublishContent] = useState('');
  const [publishResult, setPublishResult] = useState<
    { success: boolean; message: string; postUrl?: string | null } | null
  >(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wordpress', { headers: { ...getAuthHeader() } });
      const data = await res.json();
      if (data.success) {
        setSites(data.sites || []);
      } else {
        setError(data.error || 'Failed to load WordPress sites');
      }
    } catch (err) {
      setError('Failed to load WordPress sites');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchSites();
    }
  }, [user, authLoading, router, fetchSites]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleTest = async (siteId: string) => {
    setTestingId(siteId);
    try {
      const res = await fetch(`/api/wordpress/${siteId}/test`, {
        method: 'POST',
        headers: { ...getAuthHeader() },
      });
      const data = await res.json();
      if (data.success) {
        setToast({
          type: 'success',
          message: `Connected as ${data.user?.name || data.user?.username || 'user'}`,
        });
        // Refresh sites so isConnected status is current.
        await fetchSites();
      } else {
        setToast({
          type: 'error',
          message: data.error || 'Connection failed',
        });
        await fetchSites();
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection test failed' });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (siteId: string) => {
    if (!confirm('Delete this WordPress site connection?')) return;
    setDeletingId(siteId);
    try {
      const res = await fetch(`/api/wordpress/${siteId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() },
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: 'success', message: 'Site deleted' });
        setSites((prev) => prev.filter((s) => s._id !== siteId));
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to delete site' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to delete site' });
    } finally {
      setDeletingId(null);
    }
  };

  const openPublishModal = (site: WordPressSite) => {
    setPublishSite(site);
    setPublishStatus(site.defaultStatus || 'draft');
    setPublishTitle('');
    setPublishContent('');
    setPublishResult(null);
  };

  const handlePublish = async () => {
    if (!publishSite) return;
    if (!publishTitle.trim() || !publishContent.trim()) {
      setPublishResult({ success: false, message: 'Title and content are required.' });
      return;
    }

    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch(`/api/wordpress/${publishSite._id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          title: publishTitle.trim(),
          content: publishContent,
          status: publishStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishResult({
          success: true,
          message: `Published as ${publishStatus}! Post ID: ${data.postId}`,
          postUrl: data.postUrl,
        });
        setToast({ type: 'success', message: 'Content published to WordPress' });
        await fetchSites();
      } else {
        setPublishResult({
          success: false,
          message: data.error || 'Failed to publish content',
        });
      }
    } catch (err) {
      setPublishResult({ success: false, message: 'Failed to publish content' });
    } finally {
      setPublishing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-purple-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Globe className="w-7 h-7 text-purple-600" />
              WordPress Sites
            </h1>
            <p className="text-gray-700 text-sm mt-1">
              Connect your WordPress websites and publish content directly.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Add WordPress Site
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mb-6 bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowInstructions((v) => !v)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-gray-900">
                How to get your WordPress Application Password
              </span>
            </div>
            {showInstructions ? (
              <ChevronDown className="w-5 h-5 text-gray-700" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-700" />
            )}
          </button>
          {showInstructions && (
            <div className="px-4 pb-4">
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-800">
                <li>Go to WordPress admin → <strong>Users → Profile</strong></li>
                <li>Scroll to <strong>Application Passwords</strong>, enter <code className="bg-gray-100 px-1 rounded text-gray-900">AI Content Writer</code></li>
                <li>Click <strong>Add New</strong> and copy the password shown</li>
              </ol>
            </div>
          )}
        </div>

        {/* Sites list */}
        {sites.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Globe className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-800 font-medium">No WordPress sites connected yet</p>
            <p className="text-gray-700 text-sm mt-1">
              Click <strong>Add WordPress Site</strong> to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sites.map((site) => (
              <motion.div
                key={site._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{site.siteName}</h3>
                    <a
                      href={site.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-purple-600 hover:underline truncate flex items-center gap-1"
                    >
                      {site.siteUrl}
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                    </a>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      site.isConnected
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {site.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-700">Default status</p>
                    <p className="font-medium text-gray-900 capitalize">{site.defaultStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-700">Username</p>
                    <p className="font-medium text-gray-900 truncate">{site.wpUsername}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-700">Last published</p>
                    <p className="font-medium text-gray-900 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-700" />
                      {site.lastPublishedAt
                        ? new Date(site.lastPublishedAt).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => handleTest(site._id)}
                    disabled={testingId === site._id}
                    className="px-3 py-2 bg-gray-100 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {testingId === site._id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Test
                  </button>
                  <button
                    onClick={() => openPublishModal(site)}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publish
                  </button>
                  <button
                    onClick={() => handleDelete(site._id)}
                    disabled={deletingId === site._id}
                    className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {deletingId === site._id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Add Site Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddSiteModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false);
              setToast({ type: 'success', message: 'WordPress site connected!' });
              fetchSites();
            }}
            onError={(msg) => setToast({ type: 'error', message: msg })}
            getAuthHeader={getAuthHeader}
          />
        )}
      </AnimatePresence>

      {/* Publish Modal */}
      <AnimatePresence>
        {publishSite && (
          <PublishModal
            site={publishSite}
            title={publishTitle}
            content={publishContent}
            status={publishStatus}
            publishing={publishing}
            result={publishResult}
            onTitleChange={setPublishTitle}
            onContentChange={setPublishContent}
            onStatusChange={setPublishStatus}
            onPublish={handlePublish}
            onClose={() => setPublishSite(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Add Site Modal -------------------------------------------------------

interface AddSiteModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
  getAuthHeader: () => Record<string, string>;
}

function AddSiteModal({ onClose, onSuccess, onError, getAuthHeader }: AddSiteModalProps) {
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [wpApplicationPassword, setWpApplicationPassword] = useState('');
  const [defaultStatus, setDefaultStatus] = useState<'draft' | 'publish'>('draft');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim() || !siteUrl.trim() || !wpUsername.trim() || !wpApplicationPassword.trim()) {
      onError('All fields are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          siteName: siteName.trim(),
          siteUrl: siteUrl.trim(),
          wpUsername: wpUsername.trim(),
          wpApplicationPassword: wpApplicationPassword.trim(),
          defaultStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        onError(data.error || 'Failed to add WordPress site');
      }
    } catch (err) {
      onError('Failed to add WordPress site');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-600" />
            Add WordPress Site
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-auto">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Site Name</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="My Blog"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder-gray-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">WordPress URL</label>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder-gray-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Username</label>
            <input
              type="text"
              value={wpUsername}
              onChange={(e) => setWpUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder-gray-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Application Password</label>
            <input
              type="password"
              value={wpApplicationPassword}
              onChange={(e) => setWpApplicationPassword(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder-gray-600 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Default Status</label>
            <select
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value as 'draft' | 'publish')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
            >
              <option value="draft">Draft</option>
              <option value="publish">Publish</option>
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            We&apos;ll test the connection by calling <code>/wp-json/wp/v2/users/me</code> with Basic Auth before saving.
          </div>
        </form>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Connect Site
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ----- Publish Modal --------------------------------------------------------

interface PublishModalProps {
  site: WordPressSite;
  title: string;
  content: string;
  status: 'draft' | 'publish';
  publishing: boolean;
  result: { success: boolean; message: string; postUrl?: string | null } | null;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onStatusChange: (v: 'draft' | 'publish') => void;
  onPublish: () => void;
  onClose: () => void;
}

function PublishModal({
  site,
  title,
  content,
  status,
  publishing,
  result,
  onTitleChange,
  onContentChange,
  onStatusChange,
  onPublish,
  onClose,
}: PublishModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              Publish to {site.siteName}
            </h3>
            <p className="text-xs text-gray-700 mt-0.5">{site.siteUrl}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-auto">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Post title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Content (Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="# Heading&#10;&#10;Write your content here..."
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder-gray-600 font-mono text-sm resize-y"
            />
            <p className="text-xs text-gray-700 mt-1">
              Markdown supported: # H1, ## H2, **bold**, *italic*, - lists, 1. numbered lists.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as 'draft' | 'publish')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
            >
              <option value="draft">Draft</option>
              <option value="publish">Publish</option>
            </select>
          </div>

          {result && (
            <div
              className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                result.success
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {result.success ? (
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{result.message}</p>
                {result.success && result.postUrl && (
                  <a
                    href={result.postUrl}
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
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-50 transition"
          >
            Close
          </button>
          <button
            onClick={onPublish}
            disabled={publishing}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Publish to WordPress
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
