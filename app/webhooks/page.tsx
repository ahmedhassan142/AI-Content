import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { Metadata } from 'next';
import WebhooksContent from './WebhooksContent';

export const metadata: Metadata = {
  title: 'Webhook Integrations | AI Content Writer Pro',
  description:
    'Send content, SEO data, and fixes to your website automatically with webhooks.',
};

export default function WebhooksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      }
    >
      <WebhooksContent />
    </Suspense>
  );
}
