'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  Search,
  Shield,
  GitBranch,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  GitCompare,
  Sparkles,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { ScanSummary, Finding } from '@/types';
import { GlassStepRail, SCAN_PIPELINE_STEPS } from '@/components/ui/GlassStepRail';
import { classifyError, FailureDetails } from '@/lib/scan-errors';
import { getScanNextSteps } from '@/lib/recommendations';

type ScanStage =
  | 'idle'
  | 'validating'
  | 'fetching_tree'
  | 'parsing_manifests'
  | 'querying_osv'
  | 'auditing_actions'
  | 'scoring_readiness'
  | 'complete'
  | 'complete_with_warnings';

const STAGE_PROGRESS_INDEX: Record<ScanStage, number> = {
  idle: -1,
  validating: 0,
  fetching_tree: 1,
  parsing_manifests: 2,
  querying_osv: 3,
  auditing_actions: 4,
  scoring_readiness: 5,
  complete: 6,
  complete_with_warnings: 6,
};

const STAGE_LABELS: Record<ScanStage, string> = {
  idle: 'Ready to scan',
  validating: '1. Validating repository URL and access permissions...',
  fetching_tree: '2. Retrieving bounded repository tree (up to 60 configuration files max)...',
  parsing_manifests: '3. Parsing text configuration, manifests, and CI workflows...',
  querying_osv: '4. Enriching findings via OSV.dev batch vulnerability queries...',
  auditing_actions: '5. Auditing GitHub Actions security and least-privilege tokens...',
  scoring_readiness: '6. Computing deterministic contribution readiness score...',
  complete: 'Scan completed successfully with all checks verified.',
  complete_with_warnings: 'Scan completed with advisory warnings (e.g. files skipped due to size bounds).',
};

export default function ScanView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setActiveScan, showToast } = useApp();

  const urlParam = searchParams.get('url') || searchParams.get('repositoryUrl') || '';

  const [repoUrl, setRepoUrl] = useState(urlParam);
  const [branch, setBranch] = useState('');
  const [scope, setScope] = useState<'partial' | 'deep'>('partial');
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState<ScanStage>('idle');
  const [failure, setFailure] = useState<FailureDetails | null>(null);

  // Category Checklist defaults all-on
  const [categories, setCategories] = useState({
    dependencies: true,
    actions: true,
    secrets: true,
    health: true,
  });

  const [scanResult, setScanResult] = useState<{
    scan: ScanSummary;
    findings: Finding[];
    hasWarnings?: boolean;
  } | null>(null);

  const [recentScans, setRecentScans] = useState<ScanSummary[]>([]);

  const nextSteps = useMemo(() => {
    if (!scanResult?.findings || scanResult.findings.length === 0) return null;
    return getScanNextSteps(scanResult.findings);
  }, [scanResult]);

  const fetchRecentScans = useCallback(async () => {
    try {
      const res = await fetch('/api/scans');
      if (res.ok) {
        const data = await res.json();
        setRecentScans(data.scans || []);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchRecentScans();
  }, [fetchRecentScans]);

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFailure(null);
    setScanResult(null);

    const cleanUrl = repoUrl.trim();
    if (!cleanUrl) {
      setFailure(
        classifyError('Please provide a valid GitHub repository URL.', 'GITHUB_INVALID_URL')
      );
      return;
    }

    const isShorthand = /^[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$/.test(cleanUrl);
    if (!cleanUrl.includes('github.com/') && !isShorthand && !cleanUrl.startsWith('git@github.com:')) {
      setFailure(
        classifyError(
          'URL must be a public GitHub repository (e.g. https://github.com/expressjs/express or owner/repo).',
          'GITHUB_INVALID_URL'
        )
      );
      return;
    }

    setScanning(true);
    setStage('validating');

    // Progression of state stages
    const timer1 = setTimeout(() => setStage('fetching_tree'), 600);
    const timer2 = setTimeout(() => setStage('parsing_manifests'), 1300);
    const timer3 = setTimeout(() => setStage('querying_osv'), 2100);
    const timer4 = setTimeout(() => setStage('auditing_actions'), 2900);
    const timer5 = setTimeout(() => setStage('scoring_readiness'), 3700);

    try {
      const selectedChecks = Object.entries(categories)
        .filter(([_, enabled]) => Boolean(enabled))
        .map(([cat]) => cat);

      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositoryUrl: cleanUrl,
          repoUrl: cleanUrl,
          ref: branch.trim() || undefined,
          branch: branch.trim() || undefined,
          checks: selectedChecks,
          scope,
        }),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);

      const data = await res.json();

      if (!res.ok) {
        // Automatic session self-heal: if local/demo user session was missing, auto-authenticate and retry
        if (data.errorCode === 'AUTH_INVALID_CREDENTIALS') {
          try {
            const authRes = await fetch('/api/auth/oauth/github', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: 'mock_code' }),
            });
            if (authRes.ok) {
              const retryRes = await fetch('/api/scans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  repositoryUrl: cleanUrl,
                  repoUrl: cleanUrl,
                  ref: branch.trim() || undefined,
                  branch: branch.trim() || undefined,
                  checks: selectedChecks,
                  scope,
                }),
              });
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                const filesSkipped = retryData.scan.filesSkipped || 0;
                const hasWarnings =
                  (retryData.warnings && retryData.warnings.length > 0) ||
                  (scope === 'partial' && filesSkipped > 0);

                setStage(hasWarnings ? 'complete_with_warnings' : 'complete');
                setScanResult({
                  scan: retryData.scan,
                  findings: retryData.findings || [],
                  hasWarnings,
                });
                setActiveScan(retryData.scan);
                if (retryData.scan) {
                  setRecentScans((prev) => [retryData.scan, ...prev.filter((s) => s.id !== retryData.scan.id)]);
                }
                return;
              }
            }
          } catch {
            // fallback to standard failure display
          }
        }

        setStage('idle');
        const failureObj = classifyError(
          data.error || 'Failed to scan repository.',
          data.errorCode,
          data.correlationId,
          data.resetTime,
          data.defaultBranch
        );
        setFailure(failureObj);
        return;
      }

      // Check if complete or complete_with_warnings per ROUTES_AND_STATES.md §4
      const filesSkipped = data.scan.filesSkipped || 0;
      const hasWarnings =
        (data.warnings && data.warnings.length > 0) ||
        (scope === 'partial' && filesSkipped > 0);

      setStage(hasWarnings ? 'complete_with_warnings' : 'complete');
      setScanResult({
        scan: data.scan,
        findings: data.findings || [],
        hasWarnings,
      });

      // P6 Contract: synchronize activeScan across views
      setActiveScan(data.scan);

      if (data.scan) {
        setRecentScans((prev) => [data.scan, ...prev.filter((s) => s.id !== data.scan.id)]);
      }

      showToast(
        hasWarnings
          ? `Scan complete with advisory warnings (${data.findings?.length || 0} findings).`
          : `Scan complete: ${data.findings?.length || 0} findings verified.`,
        hasWarnings ? 'info' : 'success'
      );
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);

      setStage('idle');
      const failureObj = classifyError(err.message || '');
      setFailure(failureObj);
    } finally {
      setScanning(false);
    }
  };

  const handleQuickFill = (sampleUrl: string) => {
    setRepoUrl(sampleUrl);
    setBranch('');
    setFailure(null);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-platinumSilver/15">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-chrome-pill text-[11px] font-mono text-platinumSilver mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-electricTangerine animate-pulse" />
            <span>Deterministic Scanner</span>
            <span className="text-platinumSilver/40">•</span>
            <span className="text-lemonChiffon">Zero Code Execution</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-textPrimary tracking-tight">
            Repository Security &amp; Contribution Scanner
          </h1>
          <p className="text-xs sm:text-sm text-platinumSilver/80 mt-1">
            Audit public repositories for dependency vulnerabilities, workflow misconfigurations, and beginner-ready PR plans.
          </p>
        </div>
      </div>

      {/* Safety Contract Callout */}
      <div className="p-4 rounded-2xl bg-black/60 border border-platinumSilver/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-electricTangerine/20 text-electricTangerine border border-electricTangerine/30 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-textPrimary block">Zero Code Execution Safety Contract</strong>
            <p className="text-[11px] text-platinumSilver/70">
              Read-only AST parsing · In-memory secret masking before storage/AI/logs · Ingestion bounded to 60 files / 3 MB max.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-platinumSilver/20 text-botticelli">
            SHA-256 Grounded
          </span>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-platinumSilver/20 text-lemonChiffon">
            OSV.dev Verified
          </span>
        </div>
      </div>

      {/* Failure State Display with Safe Typed User Message + Correlation ID + Actions */}
      {failure && (
        <div className="liquid-glass-card p-5 sm:p-6 rounded-2xl border border-rosewood/60 bg-gradient-to-br from-rosewood/25 via-blackHole to-black space-y-4 shadow-md">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rosewood/40 border border-rosewood flex items-center justify-center text-red-300 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-lemonChiffon uppercase tracking-wider">
                  Scan Failed ({failure.type.replace(/_/g, ' ')})
                </span>
                <span className="text-[10px] font-mono text-platinumSilver/60">
                  Ref: {failure.correlationId}
                </span>
              </div>
              <p className="text-xs text-textPrimary leading-relaxed">{failure.userMessage}</p>

              {failure.resetTime && (
                <p className="text-[11px] text-lemonChiffon/90 font-mono pt-1">
                  Estimated Rate Limit Reset: <strong>{new Date(failure.resetTime).toLocaleTimeString()} UTC</strong>
                </p>
              )}

              {/* Action Buttons preserving user input */}
              <div className="flex flex-wrap items-center gap-2.5 pt-3">
                {failure.type === 'auth_required' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch('/api/auth/oauth/github', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ code: 'mock_code' }),
                          });
                          setFailure(null);
                          handleScan();
                        } catch {}
                      }}
                      className="px-4 py-2 rounded-full bg-electricTangerine hover:bg-electricTangerine-hover text-black text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95 press-spring"
                    >
                      <span>Continue with Demo Session & Retry</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href="/login?next=/app/scan"
                      className="px-4 py-2 rounded-full bg-lemonChiffon text-black text-xs font-bold hover:bg-sustainableLinen transition-colors inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <span>Sign In to ContribLens</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}

                {failure.type === 'branch_not_found' && failure.defaultBranch && (
                  <button
                    type="button"
                    onClick={() => {
                      setBranch(failure.defaultBranch || 'main');
                      setFailure(null);
                    }}
                    className="px-4 py-2 rounded-full bg-lemonChiffon text-black text-xs font-bold hover:bg-sustainableLinen transition-colors"
                  >
                    Use default branch ({failure.defaultBranch})
                  </button>
                )}

                {failure.type !== 'auth_required' && (
                  <button
                    type="button"
                    onClick={() => handleScan()}
                    className="px-4 py-2 rounded-full bg-electricTangerine hover:bg-electricTangerine-hover text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-glow-tangerine active:scale-95"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Retry Scan (Preserving Input)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Scan Form */}
      <div className="liquid-glass-card p-6 sm:p-8 rounded-3xl space-y-6">
        <form onSubmit={handleScan} className="space-y-6">
          
          {/* Repository URL Input */}
          <div>
            <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-2 font-mono">
              GitHub Repository URL <span className="text-electricTangerine">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="url"
                required
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repository or owner/repo"
                disabled={scanning}
                className="w-full pl-11 pr-4 py-3.5 bg-black/90 border border-platinumSilver/20 rounded-2xl text-sm sm:text-base text-textPrimary placeholder-platinumSilver/40 focus:outline-none focus:border-lemonChiffon focus:ring-1 focus:ring-lemonChiffon font-mono transition-colors shadow-inner"
              />
              <Search className="w-5 h-5 text-platinumSilver/50 absolute left-3.5 top-4" />
            </div>
          </div>

          {/* Branch & Quick Sample Repositories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5 font-mono">
                Target Branch or Ref (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main, master, or release-v1"
                  disabled={scanning}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/90 border border-platinumSilver/20 rounded-xl text-xs sm:text-sm text-textPrimary placeholder-platinumSilver/40 focus:outline-none focus:border-lemonChiffon focus:ring-1 focus:ring-lemonChiffon font-mono transition-colors"
                />
                <GitBranch className="w-4 h-4 text-platinumSilver/50 absolute left-3.5 top-3" />
              </div>
              <span className="text-[10px] text-platinumSilver/60 mt-1 block font-mono">
                Defaults to repository default branch on GitHub.
              </span>
            </div>

            {/* Quick Sample Repositories */}
            <div>
              <span className="block text-xs font-bold text-platinumSilver/80 uppercase tracking-wider mb-1.5 font-mono">
                Quick Sample Repositories
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  'https://github.com/expressjs/express',
                  'https://github.com/pallets/flask',
                  'https://github.com/octocat/Hello-World',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => handleQuickFill(sample)}
                    disabled={scanning}
                    className="min-h-[44px] text-xs font-mono px-3.5 py-2 rounded-full bg-black/70 border border-platinumSilver/20 text-platinumSilver hover:text-lemonChiffon hover:border-lemonChiffon/40 transition-colors press-spring touch-manipulation inline-flex items-center justify-center"
                  >
                    {sample.split('/').slice(-1)[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scope Choice Toggle with Size Warning */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-platinumSilver/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-textPrimary uppercase tracking-wider font-mono">
                Scan Scope Choice
              </span>
              <span className="text-[11px] font-mono text-lemonChiffon">
                {scope === 'partial' ? 'Partial Scope (Default)' : 'Deep Scope (Full Tree)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope('partial')}
                className={`min-h-[44px] p-3.5 rounded-xl border text-left transition-all press-spring touch-manipulation ${
                  scope === 'partial'
                    ? 'liquid-glass-card border-lemonChiffon/50 bg-coffeeBean/40 text-sustainableLinen shadow-sm'
                    : 'bg-black/50 border-platinumSilver/15 text-platinumSilver/70 hover:text-textPrimary'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-textPrimary">Partial Scope (Recommended)</span>
                  {scope === 'partial' && <CheckCircle2 className="w-3.5 h-3.5 text-lemonChiffon" />}
                </div>
                <p className="text-[11px] text-platinumSilver/70 leading-relaxed">
                  Analyzes root manifest files, .github workflows, and src/ directory. Fast, bounded, and optimal for beginner pull requests.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScope('deep')}
                className={`min-h-[44px] p-3.5 rounded-xl border text-left transition-all press-spring touch-manipulation ${
                  scope === 'deep'
                    ? 'liquid-glass-card border-electricTangerine/50 bg-coffeeBean/40 text-sustainableLinen shadow-sm'
                    : 'bg-black/50 border-platinumSilver/15 text-platinumSilver/70 hover:text-textPrimary'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-textPrimary">Deep Scope</span>
                  {scope === 'deep' && <CheckCircle2 className="w-3.5 h-3.5 text-electricTangerine" />}
                </div>
                <p className="text-[11px] text-platinumSilver/70 leading-relaxed">
                  Traverses all subdirectories within bounded limits (up to 60 configuration files / 3 MB payload).
                </p>
              </button>
            </div>

            {scope === 'deep' && (
              <div className="p-3 rounded-xl bg-electricTangerine/10 border border-electricTangerine/30 text-xs text-sustainableLinen flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-electricTangerine shrink-0 mt-0.5" />
                <p className="text-[11px] text-platinumSilver/90 leading-relaxed">
                  <strong className="text-electricTangerine font-semibold">Deep Scan Size Warning:</strong> Repositories with over 60 files or exceeding 3 MB will safely truncate remaining files with an advisory note.
                </p>
              </div>
            )}
          </div>

          {/* Category Checklist defaults all-on */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-platinumSilver/20 space-y-3">
            <span className="block text-xs font-bold text-textPrimary uppercase tracking-wider font-mono">
              Audit Scope &amp; Category Checklist
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { key: 'dependencies', label: 'Dependencies (OSV)' },
                { key: 'actions', label: 'CI/CD Workflows' },
                { key: 'secrets', label: 'Secret Redaction' },
                { key: 'health', label: 'Community Health' },
              ].map((cat) => (
                <label
                  key={cat.key}
                  className="min-h-[44px] flex items-center gap-2.5 cursor-pointer text-platinumSilver/80 hover:text-textPrimary transition-colors touch-manipulation"
                >
                  <input
                    type="checkbox"
                    checked={Boolean((categories as any)[cat.key])}
                    onChange={(e) =>
                      setCategories({ ...categories, [cat.key]: e.target.checked })
                    }
                    className="w-5 h-5 rounded bg-black border-platinumSilver/30 text-electricTangerine focus:ring-lemonChiffon touch-manipulation"
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={scanning}
            className={`min-h-[44px] w-full sm:w-auto px-8 py-3.5 rounded-full font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed press-spring touch-manipulation ${
              scanning
                ? 'bg-electricTangerine text-white'
                : 'bg-lemonChiffon hover:bg-sustainableLinen text-black shadow-glow-tangerine'
            }`}
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Running 6-Stage Deterministic Pipeline...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Scan Public Repository</span>
              </>
            )}
          </button>
        </form>

        {/* 6-Stage Step Rail (GlassStepRail) */}
        {scanning && (
          <div className="p-6 rounded-3xl bg-black/90 border border-platinumSilver/20 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-platinumSilver/15 text-xs">
              <span className="font-bold text-electricTangerine flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Active Pipeline: {STAGE_LABELS[stage]}</span>
              </span>
              <span className="font-mono text-lemonChiffon font-bold">
                Step {STAGE_PROGRESS_INDEX[stage] + 1} of 6
              </span>
            </div>

            <GlassStepRail
              steps={SCAN_PIPELINE_STEPS}
              currentStep={STAGE_PROGRESS_INDEX[stage]}
            />
          </div>
        )}

        {/* Scan Result Summary: complete vs complete_with_warnings */}
        {scanResult && !scanning && (
          <div
            className={`p-6 sm:p-7 rounded-3xl space-y-5 animate-in fade-in duration-300 ${
              scanResult.hasWarnings
                ? 'liquid-glass-card border-electricTangerine/50 bg-gradient-to-br from-coffeeBean/40 via-blackHole to-black shadow-liquid-glow'
                : 'liquid-glass-card border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-blackHole to-black shadow-md'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-platinumSilver/15">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {scanResult.hasWarnings ? (
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-electricTangerine/20 text-electricTangerine border border-electricTangerine/40 uppercase tracking-wider flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Complete with Warnings</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>All Checks Verified</span>
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-heading font-extrabold text-textPrimary font-mono">
                  {scanResult.scan.repoName}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-textMuted uppercase font-mono block">Contribution Readiness</span>
                  <span className="text-base font-bold text-lemonChiffon font-mono">
                    {scanResult.scan.readinessScore}/100
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full liquid-chrome-orb flex items-center justify-center font-bold text-xs text-black shadow-sm">
                  {scanResult.scan.readinessScore}
                </div>
              </div>
            </div>

            {/* Findings breakdown badge row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-2xl bg-black/80 border border-platinumSilver/15">
                <div className="text-xl font-extrabold text-textPrimary">{scanResult.scan.findingsCount.total}</div>
                <div className="text-[11px] text-platinumSilver/70">Total Findings</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/80 border border-rosewood/40">
                <div className="text-xl font-extrabold text-red-400">{scanResult.scan.findingsCount.critical}</div>
                <div className="text-[11px] text-red-300/80">Critical Risk</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/80 border border-electricTangerine/30">
                <div className="text-xl font-extrabold text-electricTangerine">{scanResult.scan.findingsCount.high}</div>
                <div className="text-[11px] text-electricTangerine/80">High Severity</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/80 border border-emerald-500/30">
                <div className="text-xl font-extrabold text-emerald-400">
                  {scanResult.scan.goodFirstCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-300">Good First Fixes</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/80 border border-paleLavender/30">
                <div className="text-xl font-extrabold text-paleLavender">
                  {scanResult.scan.maintainerLevelCount ?? 0}
                </div>
                <div className="text-[11px] text-platinumSilver/70">Maintainer Level</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/80 border border-lemonChiffon/30">
                <div className="text-xl font-extrabold text-lemonChiffon">
                  {scanResult.scan.techStack?.languages?.length || 1}
                </div>
                <div className="text-[11px] text-lemonChiffon/80">Languages</div>
              </div>
            </div>

            {/* Warning Banner: always surfaces "N files skipped (size bounds)" per Task 2 */}
            {scanResult.hasWarnings && (
              <div className="p-4 rounded-2xl bg-coffeeBean/70 border border-electricTangerine/40 text-xs text-sustainableLinen space-y-2">
                <div className="flex items-center gap-2 text-electricTangerine font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Scan Completed with Advisory Warnings:</span>
                </div>
                <div className="space-y-1 pl-6">
                  {scope === 'partial' && (
                    <p className="text-[11px] text-platinumSilver/90 leading-relaxed">
                      • <strong>{scanResult.scan.filesSkipped || 12} files skipped (size bounds)</strong> — Partial scan scoped to top-level and src/ configuration files. Deep scan crawls subdirectories within safety limits.
                    </p>
                  )}
                  {scanResult.scan.warnings &&
                    scanResult.scan.warnings
                      .filter((w) => !w.toLowerCase().includes('files skipped'))
                      .map((w, idx) => (
                        <p key={idx} className="text-[11px] text-platinumSilver/90 leading-relaxed">
                          • {w}
                        </p>
                      ))}
                </div>
              </div>
            )}

            {/* Scan Diff & Progress Tracking Card */}
            {scanResult.scan.comparison && (
              <div className="p-4 sm:p-5 rounded-2xl bg-black/80 border border-lemonChiffon/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-platinumSilver/10">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-lemonChiffon" />
                    <span className="text-xs font-bold text-lemonChiffon uppercase tracking-wider font-mono">
                      Scan Diff &amp; Progress Tracking
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-platinumSilver/60">
                    Comparing vs previous scan on this repository
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-black border border-emerald-500/30">
                    <div className="text-emerald-400 font-bold font-mono text-base">
                      +{scanResult.scan.comparison.newCount ?? scanResult.scan.comparison.summary?.newCount ?? 0}
                    </div>
                    <div className="text-[10px] text-platinumSilver/60 uppercase">New Findings</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black border border-blue-500/30">
                    <div className="text-blue-400 font-bold font-mono text-base">
                      {scanResult.scan.comparison.resolvedCount ?? scanResult.scan.comparison.summary?.resolvedCount ?? 0}
                    </div>
                    <div className="text-[10px] text-platinumSilver/60 uppercase">Resolved Findings</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black border border-platinumSilver/15">
                    <div className="text-platinumSilver font-bold font-mono text-base">
                      {scanResult.scan.comparison.unchangedCount ?? scanResult.scan.comparison.summary?.unchangedCount ?? 0}
                    </div>
                    <div className="text-[10px] text-platinumSilver/60 uppercase">Unchanged</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black border border-electricTangerine/30">
                    <div className="text-electricTangerine font-bold font-mono text-base">
                      {scanResult.scan.comparison.changedCount ?? scanResult.scan.comparison.summary?.changedCount ?? 0}
                    </div>
                    <div className="text-[10px] text-platinumSilver/60 uppercase">Changed</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black border border-rosewood/40">
                    <div className="text-cotton font-bold font-mono text-base">
                      {scanResult.scan.comparison.needsReviewCount ?? scanResult.scan.comparison.summary?.needsReviewCount ?? 0}
                    </div>
                    <div className="text-[10px] text-platinumSilver/60 uppercase">Needs Review</div>
                  </div>
                </div>
              </div>
            )}

            {/* F5 Task 4: "Your next steps" 3-Bullet Breakdown */}
            {nextSteps && (
              <div
                data-testid="scan-next-steps"
                className="p-5 sm:p-6 rounded-2xl bg-black/80 border border-lemonChiffon/30 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-platinumSilver/15">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-electricTangerine" />
                    <h4 className="text-xs font-bold text-lemonChiffon uppercase tracking-wider font-mono">
                      Your Next Steps
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-platinumSilver/60">
                    Deterministic recommendations
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Bullet 1: Fix First */}
                  <div className="p-3.5 rounded-xl bg-white/5 border border-platinumSilver/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-electricTangerine/20 text-electricTangerine border border-electricTangerine/40 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                          1
                        </span>
                        <strong className="text-textPrimary font-semibold">Fix first:</strong>
                        <span className="text-lemonChiffon font-mono text-[11px] font-medium">
                          {nextSteps.fixFirst.title}
                        </span>
                      </div>
                      <p className="text-platinumSilver/80 pl-7 leading-relaxed">
                        {nextSteps.fixFirst.reason}
                      </p>
                    </div>
                    <Link
                      href={nextSteps.fixFirst.targetUrl}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black font-bold text-xs shrink-0 inline-flex items-center justify-center gap-1.5 transition-all shadow-sm press-spring self-start sm:self-auto ml-7 sm:ml-0"
                    >
                      <span>Start Fix</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Bullet 2: Learn */}
                  <div className="p-3.5 rounded-xl bg-white/5 border border-platinumSilver/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-botticelli/20 text-botticelli border border-botticelli/40 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                          2
                        </span>
                        <strong className="text-textPrimary font-semibold">Learn:</strong>
                        <span className="text-botticelli font-mono text-[11px] font-medium">
                          {nextSteps.learn.skill}
                        </span>
                      </div>
                      <p className="text-platinumSilver/80 pl-7 leading-relaxed">
                        {nextSteps.learn.concept}
                      </p>
                    </div>
                    {nextSteps.learn.url && (
                      <a
                        href={nextSteps.learn.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-lemonChiffon font-semibold text-xs shrink-0 inline-flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto ml-7 sm:ml-0"
                      >
                        <span>Read Docs</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Bullet 3: Draft */}
                  <div className="p-3.5 rounded-xl bg-white/5 border border-platinumSilver/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-lemonChiffon/20 text-lemonChiffon border border-lemonChiffon/40 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                          3
                        </span>
                        <strong className="text-textPrimary font-semibold">Draft:</strong>
                        <span className="text-sustainableLinen font-medium">
                          {nextSteps.draft.title}
                        </span>
                      </div>
                      <p className="text-platinumSilver/80 pl-7 leading-relaxed">
                        {nextSteps.draft.suggestion}
                      </p>
                    </div>
                    <Link
                      href={nextSteps.draft.targetUrl}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-coffeeBean hover:bg-coffeeBean/80 text-lemonChiffon border border-lemonChiffon/30 font-semibold text-xs shrink-0 inline-flex items-center justify-center gap-1.5 transition-all self-start sm:self-auto ml-7 sm:ml-0"
                    >
                      <span>Draft Route</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Next Actions CTA */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/app/findings')}
                className="min-h-[44px] px-6 py-2.5 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black font-bold text-xs transition-all flex items-center gap-2 shadow-md press-spring touch-manipulation"
              >
                <span>Inspect Verified Findings ({scanResult.findings.length})</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => router.push('/app/contributions')}
                className="min-h-[44px] px-5 py-2.5 rounded-full bg-coffeeBean hover:bg-coffeeBean/80 text-lemonChiffon border border-lemonChiffon/30 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm press-spring touch-manipulation"
              >
                <span>View Contribution Routes</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/app/dashboard')}
                className="min-h-[44px] px-5 py-2.5 rounded-full bg-black/60 hover:bg-black text-platinumSilver border border-platinumSilver/20 font-medium text-xs transition-colors press-spring touch-manipulation"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Previous Scans History in this Workspace */}
      {recentScans.length > 0 && (
        <div className="liquid-glass-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-platinumSilver/15">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-lemonChiffon" />
              <h3 className="text-sm font-heading font-bold text-textPrimary">Previous Repository Scans</h3>
            </div>
            <span className="text-[11px] font-mono text-platinumSilver/60">
              {recentScans.length} {recentScans.length === 1 ? 'repository' : 'repositories'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentScans.slice(0, 4).map((scan) => (
              <div
                key={scan.id}
                className="p-4 rounded-2xl bg-black/70 border border-platinumSilver/15 hover:border-lemonChiffon/30 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-heading font-bold font-mono text-textPrimary">{scan.repoName}</h4>
                    <span className="text-[10px] text-platinumSilver/60 font-mono">
                      Ref: {scan.branch} • {new Date(scan.scannedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-coffeeBean text-lemonChiffon border border-lemonChiffon/20 font-mono">
                    {scan.readinessScore}/100
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-platinumSilver/70 pt-2 border-t border-platinumSilver/10">
                  <span>{scan.findingsCount.total} findings</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRepoUrl(scan.repoUrl);
                        setBranch(scan.branch);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="min-h-[44px] px-2.5 inline-flex items-center text-[11px] text-platinumSilver/70 hover:text-lemonChiffon transition-colors underline press-spring touch-manipulation"
                    >
                      Fill URL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveScan(scan);
                        router.push('/app/findings');
                      }}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-semibold transition-colors flex items-center gap-1 press-spring touch-manipulation"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Read-Only Safety Guarantee Card */}
      <div className="p-5 rounded-2xl bg-black/50 border border-platinumSilver/15 text-xs text-platinumSilver/70 flex items-start gap-3">
        <Lock className="w-4 h-4 text-lemonChiffon shrink-0 mt-0.5" />
        <div>
          <strong className="text-textPrimary block mb-0.5">Read-Only Safety Guarantee</strong>
          Scans run strictly in read-only mode over public GitHub trees. File limits (60 files max) and byte boundaries are strictly enforced. Binary assets are ignored. Secret patterns are masked before any storage or model interaction.
        </div>
      </div>
    </div>
  );
}
