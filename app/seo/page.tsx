import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { Metadata } from 'next';
import SeoContent from './SeoContent';

export const metadata: Metadata = {
  title: 'SEO Audit & Fixer — AI Content Writer',
  description:
    'Run a complete SEO audit on any URL and get ready-to-paste fixes for titles, meta tags, headings, sitemaps, robots.txt, and more.',
};

export default function SeoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      }
    >
      <SeoContent />
    </Suspense>
  );
}
