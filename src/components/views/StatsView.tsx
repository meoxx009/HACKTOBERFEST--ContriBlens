'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GitPullRequest, Shield, FolderGit2, Users, ArrowLeft, Sparkles, RotateCw, CheckCircle2 } from 'lucide-react';

interface PublicStatsData {
  reposScanned: number;
  findingsVerified: number;
  routesGenerated: number;
  contributorsGuided: number;
  lastUpdated?: string;
}

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('reduce-motion'));

    if (prefersReduced) {
      setDisplayValue(value);
      return;
    }

    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // ease-out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(easedProgress * value));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}

export default function StatsView({ initialStats }: { initialStats: PublicStatsData }) {
  const [stats, setStats] = useState<PublicStatsData>(initialStats);
  const [loading, setLoading] = useState(false);

  const fetchLiveStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          reposScanned: data.reposScanned ?? initialStats.reposScanned,
          findingsVerified: data.findingsVerified ?? initialStats.findingsVerified,
          routesGenerated: data.routesGenerated ?? initialStats.routesGenerated,
          contributorsGuided: data.contributorsGuided ?? initialStats.contributorsGuided,
          lastUpdated: data.lastUpdated,
        });
      }
    } catch {
      // Keep initial stats on network failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statCards = [
    {
      label: 'Repositories Scanned',
      value: stats.reposScanned,
      sub: 'Bounded read-only scans',
      icon: FolderGit2,
      color: 'text-electricTangerine',
    },
    {
      label: 'Verified Findings',
      value: stats.findingsVerified,
      sub: 'Deterministic + OSV cross-checked',
      icon: Shield,
      color: 'text-lemonChiffon',
    },
    {
      label: 'PR Plans Generated',
      value: stats.routesGenerated,
      sub: 'With tests & acceptance criteria',
      icon: GitPullRequest,
      color: 'text-paleLavender',
    },
    {
      label: 'Contributors Guided',
      value: stats.contributorsGuided,
      sub: 'First-time contributors supported',
      icon: Users,
      color: 'text-botticelli',
    },
  ];

  return (
    <>
      {/* Smoky Ambient Background Glow per DESIGN.md (capped blur <= 40px for mobile GPU budget) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[380px] bg-electricTangerine/10 blur-[40px] rounded-full pointer-events-none" />

      <div className="relative z-10 space-y-10">
        {/* Header & Smoky Hero Section */}
        <div className="space-y-4">
          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-textMuted hover:text-lemonChiffon transition-colors mb-2 press-spring touch-manipulation"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-platinumSilver/20 text-xs font-mono text-lemonChiffon">
              <Sparkles className="w-3.5 h-3.5 text-electricTangerine" />
              <span>Verified Platform Metrics</span>
            </div>

            <button
              type="button"
              onClick={fetchLiveStats}
              disabled={loading}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blackHole border border-borderDark text-xs font-mono text-textMuted hover:text-lemonChiffon transition-colors disabled:opacity-50 press-spring touch-manipulation"
              title="Refresh live public aggregates from /api/stats (cached ~5m)"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-lemonChiffon' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Live Sync'}</span>
            </button>
          </div>

          <div className="liquid-glass-hero p-8 rounded-3xl space-y-3 border border-platinumSilver/20 shadow-2xl">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-sustainableLinen tracking-tight font-heading">
              ContribLens Public Activity
            </h1>
            <p className="text-sm sm:text-base text-textMuted max-w-2xl leading-relaxed">
              Real-time platform statistics computed from safe public aggregates. We never expose user credentials, private repo data, or unmasked secrets.
            </p>
          </div>
        </div>

        {/* 4 Stat Cards with Count-up Animation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {statCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="liquid-glass-card p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-sustainableLinen font-mono">
                    <AnimatedCounter value={stat.value} />
                  </div>
                  <div className="text-xs font-medium text-textMuted mt-1">{stat.label}</div>
                  <div className="text-[11px] text-platinumSilver/40 mt-0.5">{stat.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Measurement Standard Card */}
        <div className="liquid-glass p-8 rounded-2xl border border-platinumSilver/15 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-lemonChiffon" />
            <h3 className="text-base font-bold text-sustainableLinen">
              Our Open Measurement Standard
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-textMuted leading-relaxed">
            All counters represent verified security and hygiene findings generated by the deterministic scanner, OSV.dev queries, and completed contribution plans. No vanity metrics or speculative numbers are logged in production. Aggregate numbers are cached for approximately 5 minutes on the server to prevent database overhead.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-textMuted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Zero Private Data</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-lemonChiffon" />
              <span>Deterministic Counting</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-botticelli" />
              <span>Cached ~5m</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
