'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  Search,
  AlertTriangle,
  Compass,
  CheckCircle2,
  GitBranch,
  ArrowRight,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  FileText,
  Cpu,
  Zap,
  RotateCw,
} from 'lucide-react';
import { ScanSummary, ContributionRoute, ActivityEvent, Finding } from '@/types';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { GlassMetricCard } from '@/components/ui/GlassMetricCard';
import {
  reconcileActiveScan,
  computeDashboardMetrics,
  getScanDiffBadgeData,
} from '@/lib/dashboard-sync';
import { getRecommendations } from '@/lib/recommendations';

export default function DashboardView() {
  const router = useRouter();
  const { user, activeScan, setActiveScan, loading: appLoading } = useApp();

  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [routes, setRoutes] = useState<ContributionRoute[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [scansRes, routesRes, findingsRes, profileRes] = await Promise.all([
        fetch('/api/scans'),
        fetch('/api/routes'),
        fetch('/api/findings'),
        fetch('/api/profile'),
      ]);

      if (scansRes.ok) {
        const data = await scansRes.json();
        const serverScans: ScanSummary[] = data.scans || [];
        setScans(serverScans);

        // Authoritative reconciliation: localStorage must never contradict server
        const reconciled = reconcileActiveScan(serverScans, activeScan);
        if (reconciled?.id !== activeScan?.id || (reconciled && activeScan && reconciled.readinessScore !== activeScan.readinessScore)) {
          setActiveScan(reconciled);
        }
      }

      if (routesRes.ok) {
        const data = await routesRes.json();
        setRoutes(data.routes || []);
      }

      if (findingsRes.ok) {
        const data = await findingsRes.json();
        setFindings(data.findings || []);
      }

      if (profileRes.ok) {
        const data = await profileRes.json();
        setActivities(data.activities || []);
      }
    } catch (e: any) {
      console.error('Failed to load dashboard data:', e);
      setFetchError('Failed to load workspace data. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  }, [activeScan, setActiveScan]);

  useEffect(() => {
    if (!appLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, appLoading]);

  // Derive all metrics deterministically from real API data
  const {
    totalScans,
    activeFindingsCount,
    displayedRoutes,
    openRoutesCount,
    completedRoutesCount,
    progressPercentage,
    avgReadiness,
    recommendedRoute,
  } = computeDashboardMetrics({
    scans,
    activeScan,
    routes,
    findings,
  });

  const recommendations = useMemo(() => {
    const filteredFindings = activeScan
      ? findings.filter((f) => f.scanId === activeScan.id)
      : findings;
    const filteredRoutes = activeScan
      ? routes.filter((r) => r.scanId === activeScan.id)
      : routes;
    const scoped = getRecommendations({ findings: filteredFindings, routes: filteredRoutes });
    if (scoped.length > 0) return scoped;
    return getRecommendations({ findings, routes });
  }, [findings, routes, activeScan]);

  // Skeleton loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-platinumSilver/15">
          <div className="space-y-2">
            <div className="h-5 w-36 rounded-full bg-white/10" />
            <div className="h-8 w-64 rounded-xl bg-white/10" />
            <div className="h-4 w-96 max-w-full rounded-lg bg-white/5" />
          </div>
          <div className="h-10 w-36 rounded-full bg-white/10" />
        </div>

        {/* Pipeline Stepper skeleton */}
        <div className="liquid-glass-hero p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-platinumSilver/15">
            <div className="h-6 w-48 rounded-lg bg-white/10" />
            <div className="h-8 w-24 rounded-full bg-white/10" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 rounded-xl bg-black/60 border border-platinumSilver/10 h-16" />
            ))}
          </div>
        </div>

        {/* 4 Metric Cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="liquid-glass-card p-4 rounded-2xl flex items-center gap-3 border-platinumSilver/20 h-20">
              <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-5 w-12 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="liquid-glass-card p-6 rounded-3xl h-64 border-platinumSilver/20" />
            <div className="liquid-glass-card p-6 rounded-3xl h-40 border-platinumSilver/20" />
          </div>
          <div className="space-y-6">
            <div className="liquid-glass-card p-6 rounded-3xl h-56 border-platinumSilver/20" />
            <div className="liquid-glass-card p-6 rounded-3xl h-64 border-platinumSilver/20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Dashboard Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-platinumSilver/15">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-chrome-pill text-[11px] font-mono text-platinumSilver mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Workspace Active</span>
            <span className="text-platinumSilver/40">•</span>
            <span className="text-lemonChiffon">ContribLens OSS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-textPrimary tracking-tight flex items-center gap-2">
            Welcome back, <span className="font-showcase italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-platinumSilver via-lemonChiffon to-electricTangerine">{user?.name || 'Contributor'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-platinumSilver/80 mt-1">
            Navigate verified findings, plan bounded contributor fixes, and generate maintainer-ready drafts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/app/scan"
            className="min-h-[44px] px-6 py-3 rounded-full bg-electricTangerine hover:bg-electricTangerine-hover text-white font-bold text-xs transition-all shadow-glow-tangerine flex items-center gap-2 press-spring touch-manipulation"
          >
            <Search className="w-4 h-4" />
            <span>Scan Repository</span>
          </Link>
        </div>
      </div>

      {/* Error state with functional retry button */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-rosewood/25 border border-rosewood/50 text-sustainableLinen text-xs flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-electricTangerine shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="min-h-[44px] px-4 py-1.5 rounded-full bg-lemonChiffon text-black font-semibold text-xs hover:bg-sustainableLinen transition-colors flex items-center gap-1.5 shadow-sm press-spring touch-manipulation"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Visually Connected Readiness & Pipeline Stepper */}
      <div className="liquid-glass-hero p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-platinumSilver/15">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-electricTangerine/20 border border-electricTangerine/40 flex items-center justify-center text-electricTangerine">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-heading font-bold text-textPrimary">Contribution Pipeline Status</h2>
              <span className="text-[11px] text-platinumSilver/70">
                {activeScan ? `Active Context: ${activeScan.repoName}` : 'Select a repository to inspect pipeline'}
              </span>
            </div>
          </div>

          {activeScan && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-textMuted uppercase font-mono block">Repository Readiness</span>
                <span className="text-sm font-bold text-lemonChiffon font-mono">{activeScan.readinessScore}/100</span>
              </div>
              <div className="w-10 h-10 rounded-full liquid-chrome-orb flex items-center justify-center font-bold text-xs text-black shadow-sm" title="Repository environment & health readiness score">
                {activeScan.readinessScore}
              </div>
            </div>
          )}
        </div>

        {/* 4 Connected Pipeline Stages */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-black/60 border border-platinumSilver/20 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-electricTangerine font-semibold">1. Scan</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-[10px] text-platinumSilver/80">Static analysis complete</p>
          </div>

          <div className="p-3 rounded-xl bg-black/60 border border-platinumSilver/20 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-botticelli font-semibold">2. Verify</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-[10px] text-platinumSilver/80">OSV &amp; SHA-256 verified</p>
          </div>

          <div className="p-3 rounded-xl bg-black/60 border border-platinumSilver/20 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-paleLavender font-semibold">3. Understand</span>
              <Cpu className="w-3.5 h-3.5 text-paleLavender" />
            </div>
            <p className="text-[10px] text-platinumSilver/80">Grounded Gemma 4 active</p>
          </div>

          <div className="p-3 rounded-xl bg-black/60 border border-platinumSilver/20 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-lemonChiffon font-semibold">4. Drafts</span>
              <FileText className="w-3.5 h-3.5 text-lemonChiffon" />
            </div>
            <p className="text-[10px] text-platinumSilver/80">Ready for review</p>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards with GlassMetricCard Primitives */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Repositories Scanned */}
        <GlassMetricCard
          value={totalScans}
          label="Repositories Scanned"
          icon={<GitBranch className="w-5 h-5 text-electricTangerine" />}
          badge={
            <span className="text-[10px] font-mono text-platinumSilver/60">
              {totalScans === 1 ? '1 repo' : `${totalScans} repos`}
            </span>
          }
        />

        {/* Metric 2: Active Findings */}
        <GlassMetricCard
          value={activeFindingsCount}
          label="Active Findings"
          icon={<AlertTriangle className="w-5 h-5 text-electricTangerine" />}
          badge={
            activeScan && activeScan.findingsCount?.critical > 0 ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rosewood/40 text-red-300 border border-rosewood">
                {activeScan.findingsCount.critical} critical
              </span>
            ) : activeScan ? (
              <span className="text-[10px] font-mono text-platinumSilver/60">
                in context
              </span>
            ) : undefined
          }
        />

        {/* Metric 3: Open Routes (isPrimary - Elevated Primary Metric) */}
        <GlassMetricCard
          value={openRoutesCount}
          label="Open Routes"
          isPrimary={true}
          icon={<Compass className="w-5 h-5 text-lemonChiffon" />}
          badge={
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-coffeeBean text-lemonChiffon border border-lemonChiffon/40">
              {completedRoutesCount} completed
            </span>
          }
        />

        {/* Metric 4: Avg Readiness */}
        <GlassMetricCard
          value={`${avgReadiness}/100`}
          label="Avg Readiness"
          icon={<Zap className="w-5 h-5 text-botticelli" />}
          badge={
            <span className="text-[10px] font-mono text-platinumSilver/60">
              {totalScans > 0 ? 'Across repos' : 'No scans'}
            </span>
          }
        />
      </div>

      {/* Main Grid: Recommended Task & Tech Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recommended Next Task (Col span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* F5: "Recommended for you" Panel (Top 3 Recommendations) */}
          <div className="liquid-glass-card p-6 rounded-3xl space-y-4" data-testid="recommended-for-you-panel">
            <div className="flex items-center justify-between pb-3 border-b border-platinumSilver/15">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-electricTangerine" />
                <h3 className="text-sm font-heading font-bold text-textPrimary">Recommended for you</h3>
              </div>
              <span className="text-[11px] font-mono text-lemonChiffon bg-black/60 px-3 py-1 rounded-full border border-lemonChiffon/30 shadow-inner">
                {recommendations.length > 0
                  ? `Top ${Math.min(3, recommendations.length)} of ${recommendations.length}`
                  : 'Deterministic Scoring'}
              </span>
            </div>

            {recommendations.length > 0 ? (
              <div className="space-y-3.5">
                {recommendations.slice(0, 3).map((rec, index) => {
                  const isTopPick = index === 0;
                  const priorityColor =
                    rec.priorityLabel === 'Fix this now'
                      ? 'bg-rosewood/30 text-sustainableLinen border-rosewood/50'
                      : rec.priorityLabel === 'Good next step'
                      ? 'bg-coffeeBean text-lemonChiffon border-lemonChiffon/40'
                      : 'bg-blackHole text-platinumSilver/70 border-platinumSilver/20';

                  return (
                    <div
                      key={rec.id}
                      className={`p-4 sm:p-5 rounded-2xl transition-all ${
                        isTopPick
                          ? 'bg-black/90 border border-lemonChiffon/40 shadow-sm space-y-3'
                          : 'bg-black/60 border border-platinumSilver/15 hover:border-platinumSilver/30 space-y-2.5'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-platinumSilver">
                              #{index + 1}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${priorityColor}`}
                            >
                              {rec.priorityLabel}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-coffeeBean text-lemonChiffon/90 border border-lemonChiffon/20 capitalize">
                              {rec.difficulty}
                            </span>
                            <span className="text-[10px] font-mono text-platinumSilver/60 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-platinumSilver/50" />
                              <span>{rec.estimatedMinutes} mins</span>
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-heading font-bold text-textPrimary leading-snug pt-0.5">
                            {rec.title}
                          </h4>
                          {rec.targetFile && (
                            <p className="text-[11px] text-platinumSilver/70 font-mono">
                              File: <span className="text-lemonChiffon">{rec.targetFile}</span>
                            </p>
                          )}
                        </div>

                        <Link
                          href={rec.targetUrl}
                          className="min-h-[44px] px-4 py-2 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-bold shrink-0 inline-flex items-center justify-center gap-1.5 transition-all shadow-sm press-spring touch-manipulation self-start sm:self-auto"
                        >
                          <span>{rec.targetType === 'route' ? 'View Route' : 'Inspect'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                      {/* One plain-English reason sentence */}
                      <p className="text-xs text-platinumSilver/90 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-platinumSilver/10">
                        {rec.reason}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-platinumSilver/60">
                        <div className="flex items-center gap-1.5">
                          <span>Focus skill:</span>
                          <strong className="text-lemonChiffon">{rec.learnSkill}</strong>
                        </div>
                        <span className="font-mono text-[10px]">Score: {rec.score} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Actionable Empty State per Task 5 */
              <div className="text-center py-10 px-6 rounded-2xl bg-black/60 border border-dashed border-platinumSilver/20 space-y-4">
                <div className="w-12 h-12 rounded-full liquid-chrome-orb flex items-center justify-center mx-auto text-black shadow-md">
                  <Compass className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h4 className="text-sm font-heading font-bold text-textPrimary">
                    Run a scan to get personalized next steps
                  </h4>
                  <p className="text-xs text-platinumSilver/70 leading-relaxed">
                    Scan your first public GitHub repository to discover verified security findings and deterministic contribution routes.
                  </p>
                </div>
                <Link
                  href="/app/scan"
                  className="min-h-[44px] inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-electricTangerine hover:bg-electricTangerine-hover text-white text-xs font-bold transition-all shadow-glow-tangerine press-spring touch-manipulation"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Scan Repository</span>
                </Link>
              </div>
            )}
          </div>

          {/* Open Contribution Progress */}
          <div className="liquid-glass-card p-6 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-lemonChiffon" />
                <h3 className="text-sm font-heading font-bold text-textPrimary">Open Contribution Progress</h3>
              </div>
              <span className="text-xs font-mono font-semibold text-lemonChiffon">
                {completedRoutesCount} of {displayedRoutes.length} completed ({progressPercentage}%)
              </span>
            </div>
            <ProgressBar
              value={progressPercentage}
              variant="tangerine"
              size="md"
            />
            <div className="flex items-center justify-between text-[11px] text-platinumSilver/70 pt-1">
              <span>Status: {openRoutesCount} active routes awaiting review</span>
              <Link href="/app/contributions" className="text-lemonChiffon hover:underline font-medium">
                View All Routes →
              </Link>
            </div>
          </div>

          {/* Recent Repositories */}
          <div className="liquid-glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-platinumSilver/15">
              <h3 className="text-sm font-heading font-bold text-textPrimary">Recent Repositories</h3>
              <Link href="/app/scan" className="text-xs text-lemonChiffon hover:underline font-semibold">
                New Scan →
              </Link>
            </div>

            {scans.length > 0 ? (
              <div className="space-y-3">
                {scans.slice(0, 4).map((s) => {
                  const isSelected = activeScan?.id === s.id;
                  const diffData = getScanDiffBadgeData(s);
                  const highestRisk =
                    s.findingsCount.critical > 0
                      ? { label: 'CRITICAL', style: 'bg-rosewood/40 text-red-300 border-rosewood' }
                      : s.findingsCount.high > 0
                      ? { label: 'HIGH', style: 'bg-electricTangerine/20 text-electricTangerine border-electricTangerine/40' }
                      : s.findingsCount.medium > 0
                      ? { label: 'MEDIUM', style: 'bg-botticelli/20 text-botticelli border-botticelli/40' }
                      : { label: 'LOW', style: 'bg-white/10 text-platinumSilver/70 border-platinumSilver/20' };

                  const diffBadgeStyle =
                    diffData.badgeType === 'resolved'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : diffData.badgeType === 'new'
                      ? 'bg-electricTangerine/15 text-electricTangerine border-electricTangerine/30'
                      : diffData.badgeType === 'mixed'
                      ? 'bg-emerald-500/10 text-lemonChiffon border-lemonChiffon/30'
                      : 'bg-white/5 text-platinumSilver/60 border-platinumSilver/20';

                  const scanDate = new Date(s.scannedAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const techList = s.techStack.languages.map((l) => l.name).slice(0, 3).join(', ') || 'Multi-tech';

                  return (
                    <div
                      key={s.id}
                      onClick={() => setActiveScan(s)}
                      className={`min-h-[44px] p-4 rounded-2xl border cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 press-spring touch-manipulation ${
                        isSelected
                          ? 'bg-black/90 border-lemonChiffon shadow-md'
                          : 'bg-black/50 border-platinumSilver/15 hover:border-platinumSilver/30 hover:bg-black/70'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <GitBranch className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-lemonChiffon' : 'text-platinumSilver/60'}`} />
                        <div>
                          <div className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                            <span>{s.repoName}</span>
                            {isSelected && (
                              <span className="text-[10px] bg-coffeeBean text-lemonChiffon border border-lemonChiffon/30 px-2 py-0.5 rounded-full font-mono">
                                Active Context
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-platinumSilver/70 flex flex-wrap items-center gap-2 mt-1">
                            <span>Last scan: <strong className="text-platinumSilver">{scanDate}</strong></span>
                            <span>•</span>
                            <span>Stack: <strong className="text-lemonChiffon font-mono">{techList}</strong></span>
                            <span>•</span>
                            <span>{s.findingsCount.total} findings</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-platinumSilver/15">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${diffBadgeStyle}`} title="Scan difference vs previous scan">
                          {diffData.label}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${highestRisk.style}`}>
                          {highestRisk.label}
                        </span>
                        <div className="text-right">
                          <div className="text-xs font-bold text-lemonChiffon font-mono">{s.readinessScore}/100</div>
                          <div className="text-[10px] text-platinumSilver/60">Readiness</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-platinumSilver/50 hidden sm:block" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Actionable Empty State for Repositories */
              <div className="py-8 px-4 text-center space-y-4">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-platinumSilver/20 flex items-center justify-center mx-auto text-platinumSilver/60">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-heading font-bold text-textPrimary">Scan your first public repository</h3>
                  <p className="text-xs text-platinumSilver/70 max-w-sm mx-auto mt-1 leading-relaxed">
                    Provide any public GitHub repository URL to evaluate its health, dependencies, and contribution readiness.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
                  <span className="text-textMuted font-mono">Sample:</span>
                  <Link
                    href="/app/scan?url=https://github.com/expressjs/express"
                    className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-lemonChiffon border border-lemonChiffon/20 font-mono text-xs inline-flex items-center press-spring touch-manipulation"
                  >
                    expressjs/express
                  </Link>
                  <Link
                    href="/app/scan?url=https://github.com/pallets/flask"
                    className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-lemonChiffon border border-lemonChiffon/20 font-mono text-xs inline-flex items-center press-spring touch-manipulation"
                  >
                    pallets/flask
                  </Link>
                </div>
                <Link
                  href="/app/scan"
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-bold transition-all shadow-md press-spring touch-manipulation"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Scan your first repository →</span>
                </Link>
              </div>
            )}
          </div>

        </div>

        {/* Sidebar: Latest Tech Snapshot & Activity Timeline */}
        <div className="space-y-6">
          
          {/* Latest Tech Snapshot */}
          <div className="liquid-glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-platinumSilver/15">
              <Layers className="w-4 h-4 text-electricTangerine" />
              <h3 className="text-sm font-heading font-bold text-textPrimary">Technology Snapshot</h3>
            </div>

            {activeScan ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-platinumSilver/70 mb-1.5">Primary Languages</div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeScan.techStack.languages.map((l) => (
                      <span
                        key={l.name}
                        className="text-xs px-2.5 py-1 rounded-full bg-black/80 border border-platinumSilver/20 text-platinumSilver"
                      >
                        {l.name} ({l.percentage}%)
                      </span>
                    ))}
                  </div>
                </div>

                {activeScan.techStack.frameworks.length > 0 && (
                  <div>
                    <div className="text-xs text-platinumSilver/70 mb-1.5">Frameworks</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeScan.techStack.frameworks.map((f) => (
                        <span
                          key={f.name}
                          className="text-xs px-2.5 py-1 rounded-full bg-black/80 border border-lemonChiffon/30 text-lemonChiffon"
                        >
                          {f.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeScan.techStack.tooling.length > 0 && (
                  <div>
                    <div className="text-xs text-platinumSilver/70 mb-1.5">Tooling &amp; CI/CD</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeScan.techStack.tooling.map((t) => (
                        <span
                          key={t.name}
                          className="text-xs px-2.5 py-1 rounded-full bg-black/80 border border-platinumSilver/20 text-cotton"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-platinumSilver/15">
                  <Link
                    href="/app/contributions"
                    className="min-h-[44px] inline-flex items-center gap-1 text-xs text-lemonChiffon hover:underline font-semibold press-spring touch-manipulation"
                  >
                    <span>View Stack Matrix &amp; Routes</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-platinumSilver/70 py-4 leading-relaxed">
                Select or scan a repository to inspect its technology snapshot and dependency signals.
              </p>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="liquid-glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-platinumSilver/15">
              <Clock className="w-4 h-4 text-platinumSilver/70" />
              <h3 className="text-sm font-heading font-bold text-textPrimary">Recent Activity</h3>
            </div>

            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.slice(0, 5).map((act) => (
                  <div key={act.id} className="text-xs border-l-2 border-lemonChiffon/60 pl-3 py-1 space-y-0.5">
                    <p className="text-textPrimary font-medium leading-snug">{act.description}</p>
                    <span className="text-[10px] text-platinumSilver/60 block font-mono">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(act.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center space-y-3">
                <p className="text-xs text-platinumSilver/70">No recent activity recorded.</p>
                <Link
                  href="/app/scan"
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-full bg-lemonChiffon text-black text-xs font-bold hover:bg-sustainableLinen transition-colors shadow-sm press-spring touch-manipulation"
                >
                  Run First Scan
                </Link>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
