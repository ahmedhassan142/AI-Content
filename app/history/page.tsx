'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Star, FileText, Calendar, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { GuestStorage } from '@/lib/GuestStorage';

interface Content {
  _id: string;
  title: string;
  content: string;
  type: string;
  isFavorite: boolean;
  createdAt: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, guestSession, isGuest } = useAuth();
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingFavorite, setUpdatingFavorite] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    // Guest user - load from localStorage
    if (isGuest) {
      try {
        const guestContents = GuestStorage.getAllContent();
        setContents(guestContents as any);
        setTotalPages(1);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load guest content:', error);
        setError('Failed to load your content');
        setLoading(false);
      }
      return;
    }
    
    // Registered user - load from API
    try {
      const res = await fetch(`/api/content/history?page=${page}&limit=10`);
      const data = await res.json();
      
      console.log('History API response:', data);
      
      if (data.success) {
        setContents(data.contents || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        setError(data.error || 'Failed to fetch history');
        if (data.error === 'Unauthorized' || res.status === 401) {
          router.push('/login');
        }
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (id: string, currentStatus: boolean) => {
    setUpdatingFavorite(id);
    
    // Guest user - handle in localStorage
    if (isGuest) {
      try {
        const newStatus = GuestStorage.toggleFavorite(id);
        // Refresh the list
        const updatedContents = GuestStorage.getAllContent();
        setContents(updatedContents as any);
        console.log(`Favorite updated: ${newStatus}`);
      } catch (error) {
        console.error('Failed to update favorite:', error);
        alert('Failed to update favorite. Please try again.');
      } finally {
        setUpdatingFavorite(null);
      }
      return;
    }
    
    // Registered user - API call
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !currentStatus }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setContents(contents.map(content => 
          content._id === id ? { ...content, isFavorite: !currentStatus } : content
        ));
        console.log(`Favorite updated: ${!currentStatus}`);
      } else {
        console.error('Failed to update favorite:', data.error);
        alert('Failed to update favorite. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update favorite:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setUpdatingFavorite(null);
    }
  };

  const deleteContent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    
    // Guest user - handle in localStorage
    if (isGuest) {
      try {
        GuestStorage.deleteContent(id);
        setContents(contents.filter(c => (c as any).id !== id));
        alert('Content deleted successfully!');
      } catch (error) {
        console.error('Failed to delete:', error);
        alert('Failed to delete content. Please try again.');
      }
      return;
    }
    
    // Registered user - API call
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setContents(contents.filter(c => c._id !== id));
        alert('Content deleted successfully!');
      } else {
        alert('Failed to delete content. Please try again.');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('An error occurred. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 transition mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Content History
              </h1>
              <p className="text-gray-600 mt-1">
                {isGuest ? 'Your temporary content (sign up to save permanently)' : 'View and manage all your generated content'}
              </p>
            </div>
            <button
              onClick={() => fetchHistory()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Guest Banner */}
        {isGuest && contents.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-yellow-800 text-sm">
              ⚠️ Your content is saved locally. <Link href="/signup" className="font-semibold underline">Sign up</Link> to save permanently and access from any device!
            </p>
          </div>
        )}

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-12 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => fetchHistory()}
              className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:opacity-90 transition"
            >
              Try Again
            </button>
          </div>
        ) : contents.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No saved content yet</h3>
            <p className="text-gray-500 mb-4">
              When you generate content and save it, it will appear here.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:opacity-90 transition"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {contents.map((content, index) => (
                <motion.div
                  key={content._id || (content as any).id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1 text-gray-800">{content.title || 'Untitled'}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-700">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(content.createdAt).toLocaleDateString()}
                        </span>
                        <span className="capitalize">Type: {content.type || 'generated'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleFavorite(content._id || (content as any).id, content.isFavorite)}
                        disabled={updatingFavorite === (content._id || (content as any).id)}
                        className={`p-2 rounded-lg transition ${
                          content.isFavorite 
                            ? 'text-yellow-500 hover:text-yellow-600' 
                            : 'text-gray-600 hover:text-yellow-500'
                        } ${updatingFavorite === (content._id || (content as any).id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={content.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {updatingFavorite === (content._id || (content as any).id) ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Star className="w-5 h-5" fill={content.isFavorite ? 'currentColor' : 'none'} />
                        )}
                      </button>
                      <button
                        onClick={() => deleteContent(content._id || (content as any).id)}
                        className="p-2 rounded-lg text-gray-600 hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 line-clamp-3">
                    {content.content?.substring(0, 200) || 'No content'}...
                  </p>
                </motion.div>
              ))}
            </div>

            {!isGuest && totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}