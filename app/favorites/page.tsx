'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Trash2, Star, Calendar, Loader2,
  RefreshCw, Heart, Eye,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GuestStorage } from '@/lib/GuestStorage';

interface Favorite {
  _id?: string;
  id?: string;
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
  const { user, isGuest, getAuthHeader } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Guest user - load from localStorage
    if (isGuest) {
      try {
        const guestFavorites = GuestStorage.getFavorites();
        setFavorites(guestFavorites as Favorite[]);
        setTotalPages(1);
      } catch (err) {
        console.error('Failed to load guest favorites:', err);
        setError('Failed to load your favorites');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Registered user - load from API
    try {
      const res = await fetch(
        `/api/content/favorites?page=${page}&limit=12`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
      const data = await res.json();

      if (data.success) {
        setFavorites(data.contents || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        setError(data.error || 'Failed to fetch favorites');
        if (data.error === 'Unauthorized' || res.status === 401) {
          router.push('/login');
        }
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isGuest, page, router, getAuthHeader]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const getContentId = (favorite: Favorite): string =>
    (favorite._id || favorite.id || '') as string;

  const toggleFavorite = async (favorite: Favorite) => {
    const id = getContentId(favorite);
    if (!id) return;

    // Guest user - handle in localStorage
    if (isGuest) {
      try {
        GuestStorage.toggleFavorite(id);
        const updatedFavorites = GuestStorage.getFavorites();
        setFavorites(updatedFavorites as Favorite[]);
      } catch (err) {
        console.error('Failed to update favorite:', err);
        alert('Failed to update favorite. Please try again.');
      }
      return;
    }

    // Registered user - API call (unfavorite)
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ isFavorite: false }),
      });
      if (res.ok) {
        setFavorites((prev) => prev.filter((c) => getContentId(c) !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to update favorite');
      }
    } catch (err) {
      console.error('Failed to update favorite:', err);
      alert('Failed to update favorite. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteContent = async (favorite: Favorite) => {
    const id = getContentId(favorite);
    if (!id) return;
    if (!confirm('Are you sure you want to delete this content?')) return;

    // Guest user - handle in localStorage
    if (isGuest) {
      try {
        GuestStorage.deleteContent(id);
        setFavorites((prev) => prev.filter((c) => getContentId(c) !== id));
      } catch (err) {
        console.error('Failed to delete:', err);
        alert('Failed to delete content. Please try again.');
      }
      return;
    }

    // Registered user - API call
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      if (res.ok) {
        setFavorites((prev) => prev.filter((c) => getContentId(c) !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete content');
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete content. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const viewContent = (favorite: Favorite) => {
    const id = getContentId(favorite);
    if (!id) return;
    sessionStorage.setItem('viewContentId', id);
    router.push('/dashboard?view=content');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-700 hover:text-purple-600 transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-500 fill-current" />
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  My Favorites
                </h1>
                <p className="text-gray-700 mt-1">
                  {isGuest
                    ? 'Your favorite content (sign up to save permanently)'
                    : 'Your favorite saved content'}
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchFavorites()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Guest Banner */}
        {isGuest && favorites.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-yellow-800 text-sm">
              ⚠️ Saved locally.{' '}
              <Link href="/signup" className="font-semibold underline">
                Sign up
              </Link>{' '}
              to persist.
            </p>
          </div>
        )}

        {/* Error state */}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-12 text-center">
            <p className="text-red-700 mb-4 font-medium">{error}</p>
            <button
              onClick={() => fetchFavorites()}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:opacity-90 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : favorites.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Heart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No favorites yet
            </h3>
            <p className="text-gray-700 mb-4">
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
            {/* Favorites Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((favorite, index) => {
                const id = getContentId(favorite);
                const isLoading = actionLoadingId === id;
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden group flex flex-col"
                  >
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-1 text-gray-900 line-clamp-2">
                            {favorite.title || 'Untitled'}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-gray-700">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(favorite.createdAt).toLocaleDateString()}
                            </span>
                            <span className="capitalize px-2 py-0.5 bg-gray-100 rounded-full text-gray-800">
                              {favorite.type || 'generated'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => toggleFavorite(favorite)}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg text-yellow-500 hover:bg-yellow-50 transition disabled:opacity-50"
                            title="Remove from favorites"
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Star className="w-4 h-4 fill-current" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteContent(favorite)}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg text-gray-700 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-gray-700 text-sm line-clamp-3 mb-4">
                        {favorite.content?.substring(0, 150) || 'No content'}...
                      </p>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {favorite.tone && (
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                            {favorite.tone}
                          </span>
                        )}
                        {favorite.length && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                            {favorite.length}
                          </span>
                        )}
                        {favorite.language && favorite.language !== 'English' && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            {favorite.language}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => viewContent(favorite)}
                        className="mt-auto w-full py-2 text-sm text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition flex items-center justify-center gap-2 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination (authenticated users only) */}
            {!isGuest && totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition text-gray-800 font-medium"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-800">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition text-gray-800 font-medium"
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
