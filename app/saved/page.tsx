'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Trash2, Star, FileText, Calendar, Loader2, 
  RefreshCw, Heart, Eye
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { GuestStorage } from '@/lib/GuestStorage';

interface Favorite {
  _id: string;
  title: string;
  content: string;
  type: string;
  isFavorite: boolean;
  createdAt: string;
  tone?: string;
  length?: string;
  language?: string;
}

export default function FavoritesPage() {
  const router = useRouter();
  const { user, guestSession, isGuest } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchFavorites();
  }, [page]);

  const fetchFavorites = async () => {
    setLoading(true);
    setError(null);
    
    // Guest user - load from localStorage
    if (isGuest) {
      try {
        const guestFavorites = GuestStorage.getFavorites();
        setFavorites(guestFavorites as any);
        setTotalPages(1);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load guest favorites:', error);
        setError('Failed to load your favorites');
        setLoading(false);
      }
      return;
    }
    
    // Registered user - load from API
    try {
      const res = await fetch(`/api/content/favorites?page=${page}&limit=10`);
      const data = await res.json();
      
      console.log('Favorites API response:', data);
      
      if (data.success) {
        setFavorites(data.contents || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        setError(data.error || 'Failed to fetch favorites');
        if (data.error === 'Unauthorized' || res.status === 401) {
          router.push('/login');
        }
      }
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (id: string, currentStatus: boolean) => {
    // Guest user - handle in localStorage
    if (isGuest) {
      try {
        GuestStorage.toggleFavorite(id);
        // Refresh favorites list
        const updatedFavorites = GuestStorage.getFavorites();
        setFavorites(updatedFavorites as any);
      } catch (error) {
        console.error('Failed to update favorite:', error);
        alert('Failed to update favorite. Please try again.');
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
      if (res.ok) {
        setFavorites(favorites.filter(c => c._id !== id));
      }
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  };

  const deleteContent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    
    // Guest user - handle in localStorage
    if (isGuest) {
      try {
        GuestStorage.deleteContent(id);
        setFavorites(favorites.filter(c => (c as any).id !== id));
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
      if (res.ok) {
        setFavorites(favorites.filter(c => c._id !== id));
        alert('Content deleted successfully!');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete content. Please try again.');
    }
  };

  const viewContent = (content: Favorite) => {
    sessionStorage.setItem('viewContentId', content._id || (content as any).id);
    router.push('/dashboard?view=content');
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
              <div className="flex items-center gap-3">
                <Heart className="w-8 h-8 text-red-500 fill-current" />
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    My Favorites
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {isGuest ? 'Your favorite content (sign up to save permanently)' : 'Your favorite saved content'}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => fetchFavorites()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Guest Banner */}
        {isGuest && favorites.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-yellow-800 text-sm">
              ⚠️ Your favorites are saved locally. <Link href="/signup" className="font-semibold underline">Sign up</Link> to save permanently and access from any device!
            </p>
          </div>
        )}

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-12 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => fetchFavorites()}
              className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:opacity-90 transition"
            >
              Try Again
            </button>
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Heart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No favorites yet</h3>
            <p className="text-gray-500 mb-4">
              Star your favorite content from the history page to see it here.
            </p>
            <Link
              href="/history"
              className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:opacity-90 transition"
            >
              Go to History
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((favorite, index) => (
                <motion.div
                  key={favorite._id || (favorite as any).id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden group"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1 text-gray-800 line-clamp-2">
                          {favorite.title || 'Untitled'}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(favorite.createdAt).toLocaleDateString()}
                          </span>
                          <span className="capitalize px-2 py-0.5 bg-gray-100 rounded-full">
                            {favorite.type || 'generated'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleFavorite(favorite._id || (favorite as any).id, favorite.isFavorite)}
                          className="p-1.5 rounded-lg text-yellow-500 hover:bg-yellow-50 transition"
                          title="Remove from favorites"
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                        <button
                          onClick={() => deleteContent(favorite._id || (favorite as any).id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                      {favorite.content?.substring(0, 150) || 'No content'}...
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {favorite.tone && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded-full">
                          {favorite.tone}
                        </span>
                      )}
                      {favorite.length && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
                          {favorite.length}
                        </span>
                      )}
                      {favorite.language && favorite.language !== 'English' && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded-full">
                          {favorite.language}
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => viewContent(favorite)}
                      className="w-full py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Full Content
                    </button>
                  </div>
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