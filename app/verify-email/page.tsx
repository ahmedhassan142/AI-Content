'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No verification token provided');
      setVerifying(false);
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await res.json();
        
        if (data.success) {
          setSuccess(true);
          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        } else {
          setError(data.error || 'Verification failed');
        }
      } catch (err) {
        setError('An error occurred. Please try again.');
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="w-10 h-10 text-purple-600" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Email Verification
            </h1>
          </div>
          <p className="text-gray-700 mt-2">Verifying your email address</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {verifying ? (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="w-16 h-16 animate-spin text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Verifying your email...
              </h2>
              <p className="text-gray-600">
                Please wait while we confirm your email address.
              </p>
            </>
          ) : success ? (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Email Verified Successfully!
              </h2>
              <p className="text-gray-600 mb-6">
                Thank you for verifying your email address. You can now access all features.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="w-16 h-16 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Verification Failed
              </h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="space-y-3">
                <Link
                  href="/login"
                  className="inline-block w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition"
                >
                  Go to Login
                </Link>
                <button
                  onClick={() => window.location.href = '/'}
                  className="inline-block w-full px-6 py-3 border-2 border-purple-200 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition"
                >
                  Back to Home
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}