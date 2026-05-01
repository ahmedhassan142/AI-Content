import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import DashboardContent from './dashboardcontent';

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}