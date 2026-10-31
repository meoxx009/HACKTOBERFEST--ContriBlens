'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase-browser';
import ContribLensLogo from '@/components/ContribLensLogo';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function completeAuth() {
      const nextParam = searchParams.get('next');
      const destination = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? nextParam
        : '/app/dashboard';

      if (!isSupabaseConfigured()) {
        setError('Supabase authentication is unconfigured.');
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setError('Unable to initialize Supabase client.');
        return;
      }

      // Check URL for error from provider
      const urlError = searchParams.get('error_description') || searchParams.get('error');
      if (urlError) {
        setError(urlError);
        return;
      }

      try {
        // 1. Check existing session from Supabase client
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (session?.user) {
          await syncWithBackend(session, destination);
          return;
        }

        // 2. Listen to onAuthStateChange in case token exchange is in flight
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!isMounted) return;
          if (currentSession?.user) {
            subscription.unsubscribe();
            await syncWithBackend(currentSession, destination);
          }
        });

        // 3. Set a safety timeout
        const timeout = setTimeout(() => {
          if (isMounted) {
            setError('GitHub authentication timed out. Please try logging in again.');
          }
        }, 8000);

        return () => {
          clearTimeout(timeout);
          subscription.unsubscribe();
        };
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Authentication error.');
        }
      }
    }

    async function syncWithBackend(session: any, destination: string) {
      const sbUser = session.user;
      const res = await fetch('/api/auth/oauth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseToken: session.access_token,
          supabaseUser: {
            id: sbUser.id,
            email: sbUser.email,
            name: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.user_metadata?.user_name || sbUser.email?.split('@')[0],
            githubUsername: sbUser.user_metadata?.user_name || sbUser.user_metadata?.preferred_username,
            githubId: sbUser.user_metadata?.sub || sbUser.id,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        router.push(destination);
        router.refresh();
      } else {
        setError(data.error || 'Failed to synchronize user session.');
      }
    }

    completeAuth();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-black text-textPrimary flex flex-col items-center justify-center p-6 page-atmosphere">
      <div className="liquid-glass p-8 max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <ContribLensLogo size={36} />
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-rosewood/30 border border-rosewood flex items-center justify-center text-rosewood">
              <span className="text-xl">⚠️</span>
            </div>
            <p className="text-xs text-rosewood font-medium">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 rounded-full bg-electricTangerine text-black text-xs font-semibold hover:bg-electricTangerine-hover transition-colors"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-8 h-8 border-2 border-electricTangerine border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono text-lemonChiffon/90">
              Completing GitHub authentication...
            </p>
            <p className="text-[11px] text-textMuted">
              Synchronizing contributor profile and security context
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-textPrimary flex items-center justify-center page-atmosphere">
          <div className="w-8 h-8 border-2 border-electricTangerine border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
