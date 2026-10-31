'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import ScanView from '@/components/views/ScanView';

export default function AppScanPage() {
  const { user, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?next=/app/scan');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-electricTangerine border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-lemonChiffon/80">
          Checking authentication...
        </p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-electricTangerine border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-lemonChiffon/80">
            Initializing ContribLens Scanner...
          </p>
        </div>
      }
    >
      <ScanView />
    </Suspense>
  );
}
