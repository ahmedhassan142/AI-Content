import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { Metadata } from 'next';
import WordPressContent from './WordPressContent';

export const metadata: Metadata = {
  title: 'WordPress Sites | AI Content Writer Pro',
  description:
    'Connect your WordPress websites and publish generated content directly.',
};

export default function WordPressPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      }
    >
      <WordPressContent />
    </Suspense>
  );
}
