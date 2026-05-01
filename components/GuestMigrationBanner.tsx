'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GuestStorage } from '@/lib/GuestStorage';
import { useAuth } from '@/hooks/useAuth';

export default function GuestMigrationBanner() {
  const { isGuest, guestSession } = useAuth();
  const [showBanner, setShowBanner] = useState(true);
  
  if (!isGuest || !guestSession || !showBanner) return null;
  
  const savedContentCount = GuestStorage.getAllContent().length;
  if (savedContentCount === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-4 text-white">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold">🎉 You have {savedContentCount} saved items!</h3>
          <button 
            onClick={() => setShowBanner(false)}
            className="text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-purple-100 mb-3">
          Sign up now to save your content permanently and unlock unlimited generations!
        </p>
        <div className="flex gap-2">
          <Link
            href="/signup"
            className="flex-1 text-center px-3 py-1.5 bg-white text-purple-600 rounded-lg text-sm font-medium hover:bg-opacity-90 transition"
          >
            Sign Up Free
          </Link>
          <button
            onClick={() => {
              localStorage.setItem('migrateData', 'true');
              window.location.href = '/signup';
            }}
            className="flex-1 text-center px-3 py-1.5 border border-white/30 rounded-lg text-sm hover:bg-white/10 transition"
          >
            Save My Data
          </button>
        </div>
      </div>
    </div>
  );
}