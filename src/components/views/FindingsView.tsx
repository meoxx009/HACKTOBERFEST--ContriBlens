'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  Shield,
  Filter,
  Search,
  Sparkles,
  Compass,
  FileCode,
  Lock,
  ArrowRight,
  Loader2,
  X,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Info,
  ChevronRight,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Clock,
  Layers,
  HelpCircle,
  GitCompare,
  TrendingUp,
} from 'lucide-react';
import type { Finding, Severity, GroundedExplanation, ExplanationMode } from '@/types';
import { EngineBadge } from '@/components/ui/EngineBadge';
import { EvidenceChainView } from '@/components/ui/EvidenceChainView';
import { SkillsGapPanel } from '@/components/ui/SkillsGapPanel';

const SEVERITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Categories' },
  { id: 'dependency', label: 'Dependency' },
  { id: 'github-actions', label: 'GitHub Actions' },
  { id: 'secret', label: 'Secret' },
  { id: 'repository-health', label: 'Repository Health' },
] as const;

const READINESS_OPTIONS = [
  { id: 'ALL', label: 'All Readiness' },
  { id: 'good-first-contribution', label: 'Good First (80+)' },
  { id: 'beginner-friendly', label: 'Beginner (60-79)' },
  { id: 'intermediate', label: 'Intermediate (40-59)' },
  { id: 'maintainer-assistance', label: 'Maintainer (<40)' },
] as const;

const DIFF_OPTIONS = [
  { id: 'ALL', label: 'All Diff States' },
  { id: 'new', label: 'New' },
  { id: 'unchanged', label: 'Unchanged' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'changed', label: 'Changed' },
  { id: 'needs-review', label: 'Needs Review' },
] as const;

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 5,
  critical: 5,
  HIGH: 4,
  high: 4,
  MEDIUM: 3,
  medium: 3,
  LOW: 2,
  low: 2,
  INFO: 1,
  info: 1,
};

function getConfidenceScore(conf: number | string | undefined): number {
  if (typeof conf === 'number') return conf;
  if (!conf) return 0.5;
  const upper = String(conf).toUpperCase();
  if (upper === 'HIGH') return 0.85;
  if (upper === 'MEDIUM') return 0.70;
  if (upper === 'LOW') return 0.50;
  return 0.50;
}

/**
 * P8 Task 1 & 2: Severity badge ALWAYS includes both an icon and a text label.
 * Color is NEVER the only signal.
 */
function SeverityBadge({ severity, className = '' }: { severity?: Severity | string; className?: string }) {
  const sev = (severity || 'INFO').toUpperCase();
  let colorStyles = 'bg-blackHole text-platinumSilver border-borderDark';
  let Icon = HelpCircle;

  switch (sev) {
    case 'CRITICAL':
      colorStyles = 'bg-rosewood text-sustainableLinen border-rosewood';
      Icon = AlertOctagon;
      break;
    case 'HIGH':
      colorStyles = 'bg-coffeeBean text-electricTangerine border-electricTangerine/60';
      Icon = AlertTriangle;
      break;
    case 'MEDIUM':
      colorStyles = 'bg-coffeeBean text-lemonChiffon border-lemonChiffon/40';
      Icon = AlertCircle;
      break;
    case 'LOW':
      colorStyles = 'bg-blackHole text-botticelli border-botticelli/30';
      Icon = Info;
      break;
    case 'INFO':
    default:
      colorStyles = 'bg-blackHole text-platinumSilver/70 border-platinumSilver/20';
      Icon = HelpCircle;
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${colorStyles} ${className}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{sev}</span>
    </span>
  );
}

function getReadinessBadge(label?: string) {
  switch (label) {
    case 'good-first-contribution':
      return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50';
    case 'beginner-friendly':
      return 'bg-coffeeBean text-lemonChiffon border-lemonChiffon/40';
    case 'intermediate':
      return 'bg-[#2D120D] text-electricTangerine border-electricTangerine/40';
    case 'maintainer-assistance':
    default:
      return 'bg-rosewood/30 text-sustainableLinen border-rosewood/40';
  }
}

function getDiffStatusBadge(status?: string) {
  switch (status) {
    case 'new':
      return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40';
    case 'resolved':
      return 'bg-blue-950/60 text-blue-300 border-blue-500/40';
    case 'changed':
      return 'bg-coffeeBean text-electricTangerine border-electricTangerine/40';
    case 'needs-review':
      return 'bg-rosewood/30 text-lemonChiffon border-rosewood/40';
    case 'unchanged':
    default:
      return 'bg-black text-textMuted border-borderDark';
  }
}

/**
 * P8 Task 2: Standardized disclosure mode badges per EVIDENCE_AND_SCHEMAS.md §2 & §7
 */
function DisclosureLabel({ mode, category }: { mode?: string; category?: string }) {
  const isPrivate = mode === 'security-disclosure' || category === 'secret';
  const isMaintainer = mode === 'maintainer-review';

  if (isPrivate) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rosewood/40 text-sustainableLinen border border-rosewood">
        <Lock className="w-3 h-3 text-sustainableLinen" />
        <span>Private Disclosure Only</span>
      </span>
    );
  }

  if (isMaintainer) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-coffeeBean text-lemonChiffon border border-lemonChiffon/40">
        <AlertCircle className="w-3 h-3 text-lemonChiffon" />
        <span>Maintainer Review Required</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
      <span>Public Issue Allowed</span>
    </span>
  );
}

/**
 * P8 Task 2: 3-line code context snippet (monospace, Botticelli-tinted)
 */
function CodeContextViewer({
  code,
  file,
  lineStart,
  lineEnd,
  onCopy,
  copied,
}: {
  code?: string;
  file?: string | null;
  lineStart?: number | null;
  lineEnd?: number | null;
  onCopy: () => void;
  copied: boolean;
}) {
  const rawLines = (code || '').split('\n').filter((l) => l.trim().length > 0);
  const startLine = lineStart || 1;

  // Display 3-5 lines of context
  const displayLines =
    rawLines.length > 0
      ? rawLines.slice(0, 5)
      : ['// Structural finding: no raw source snippet required for this check.'];

  return (
    <div className="rounded-xl overflow-hidden border border-botticelli/30 bg-black/90 shadow-inner">
      <div className="px-3.5 py-2 bg-botticelli/[0.06] border-b border-botticelli/20 flex items-center justify-between text-xs text-botticelli">
        <div className="flex items-center gap-2 truncate">
          <FileCode className="w-3.5 h-3.5 text-lemonChiffon shrink-0" />
          <span className="font-mono truncate">{file || 'Repository Configuration'}</span>
          {lineStart && (
            <span className="text-lemonChiffon font-mono font-semibold">
              :{lineStart}
              {lineEnd && lineEnd !== lineStart ? `-${lineEnd}` : ''}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-[11px] font-mono text-botticelli hover:text-lemonChiffon transition-colors shrink-0"
          title="Copy code context snippet"
          aria-label="Copy code context snippet"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="p-3.5 space-y-1 overflow-x-auto whitespace-pre font-mono text-xs">
        {displayLines.map((line, idx) => {
          const currentLine = startLine + idx;
          return (
            <div key={idx} className="flex items-start gap-3">
              <span className="select-none text-platinumSilver/40 w-6 text-right shrink-0 text-[11px]">
                {currentLine}
              </span>
              <span className="text-botticelli break-all whitespace-pre-wrap">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FindingsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeScan, showToast } = useApp();

  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters with URL-synced state per P8 Task 6
  const [severityFilter, setSeverityFilter] = useState<string>(
    () => searchParams?.get('severity') || 'ALL'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(
    () => searchParams?.get('category') || 'all'
  );
  const [readinessFilter, setReadinessFilter] = useState<string>(
    () => searchParams?.get('readiness') || 'ALL'
  );
  const [diffFilter, setDiffFilter] = useState<string>(
    () => searchParams?.get('diff') || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams?.get('q') || ''
  );

  // Interactive actions & explanation depth mode
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>('beginner');
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [currentExplanation, setCurrentExplanation] = useState<GroundedExplanation | null>(null);
  const [creatingRouteId, setCreatingRouteId] = useState<string | null>(null);
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [copiedEvidence, setCopiedEvidence] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Synchronize state changes to URL query parameters smoothly
  const syncFiltersToUrl = useCallback(
    (updates: {
      severity?: string;
      category?: string;
      readiness?: string;
      diff?: string;
      q?: string;
    }) => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);

      const s = updates.severity !== undefined ? updates.severity : severityFilter;
      const c = updates.category !== undefined ? updates.category : categoryFilter;
      const r = updates.readiness !== undefined ? updates.readiness : readinessFilter;
      const d = updates.diff !== undefined ? updates.diff : diffFilter;
      const q = updates.q !== undefined ? updates.q : searchQuery;

      if (s && s !== 'ALL') params.set('severity', s);
      else params.delete('severity');

      if (c && c !== 'all') params.set('category', c);
      else params.delete('category');

      if (r && r !== 'ALL') params.set('readiness', r);
      else params.delete('readiness');

      if (d && d !== 'ALL') params.set('diff', d);
      else params.delete('diff');

      if (q && q.trim()) params.set('q', q.trim());
      else params.delete('q');

      const qs = params.toString();
      const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, '', nextUrl);
    },
    [severityFilter, categoryFilter, readinessFilter, diffFilter, searchQuery]
  );

  const handleSeverityChange = (s: string) => {
    setSeverityFilter(s);
    syncFiltersToUrl({ severity: s });
  };

  const handleCategoryChange = (c: string) => {
    setCategoryFilter(c);
    syncFiltersToUrl({ category: c });
  };

  const handleReadinessChange = (r: string) => {
    setReadinessFilter(r);
    syncFiltersToUrl({ readiness: r });
  };

  const handleDiffChange = (d: string) => {
    setDiffFilter(d);
    syncFiltersToUrl({ diff: d });
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    syncFiltersToUrl({ q });
  };

  const handleResetFilters = () => {
    setSeverityFilter('ALL');
    setCategoryFilter('all');
    setReadinessFilter('ALL');
    setDiffFilter('ALL');
    setSearchQuery('');
    syncFiltersToUrl({
      severity: 'ALL',
      category: 'all',
      readiness: 'ALL',
      diff: 'ALL',
      q: '',
    });
  };

  useEffect(() => {
    fetchFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScan, severityFilter, categoryFilter, readinessFilter, diffFilter]);

  const fetchFindings = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (activeScan) params.set('scanId', activeScan.id);
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (readinessFilter !== 'ALL') params.set('readinessLabel', readinessFilter);
      if (diffFilter !== 'ALL') params.set('diffStatus', diffFilter);

      const res = await fetch(`/api/findings?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load findings (HTTP ${res.status})`);
      }
      const data = await res.json();
      const loaded: Finding[] = data.findings || [];

      // Sort deterministically: Severity rank descending, then Confidence descending
      const sorted = [...loaded].sort((a, b) => {
        const sevA = SEVERITY_RANK[a.severity?.toUpperCase()] || 0;
        const sevB = SEVERITY_RANK[b.severity?.toUpperCase()] || 0;
        if (sevB !== sevA) return sevB - sevA;
        return getConfidenceScore(b.confidence) - getConfidenceScore(a.confidence);
      });

      setFindings(sorted);
      if (sorted.length > 0) {
        setSelectedFinding((prev) => {
          if (!prev) return sorted[0];
          const exists = sorted.find((f) => f.id === prev.id);
          return exists || sorted[0];
        });
      } else {
        setSelectedFinding(null);
      }
    } catch (err: any) {
      console.error('Failed to load findings:', err);
      setFetchError(err.message || 'Failed to load verified findings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReview = async (finding: Finding) => {
    setUpdatingReviewId(finding.id);
    try {
      const nextReviewed = !finding.reviewed;
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: nextReviewed }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedFinding: Finding = data.finding;
        setFindings((prev) =>
          prev.map((f) => (f.id === updatedFinding.id ? updatedFinding : f))
        );
        if (selectedFinding?.id === updatedFinding.id) {
          setSelectedFinding(updatedFinding);
        }
        showToast(
          nextReviewed ? 'Marked finding as reviewed' : 'Unmarked review status',
          'info'
        );
      } else {
        showToast('Failed to update review status', 'error');
      }
    } catch {
      showToast('Error connecting to review API', 'error');
    } finally {
      setUpdatingReviewId(null);
    }
  };

  const handleCopyEvidence = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedEvidence(true);
    showToast('Evidence snippet copied to clipboard', 'info');
    setTimeout(() => setCopiedEvidence(false), 2000);
  };

  const handleCopyHash = (hash?: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    showToast('Evidence SHA-256 hash copied to clipboard', 'info');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleRequestExplanation = async (finding: Finding) => {
    setExplainingId(finding.id);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId: finding.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentExplanation(data.explanation);
      } else {
        showToast(data.error || 'Failed to explain finding', 'error');
      }
    } catch {
      showToast('Network error while requesting explanation', 'error');
    } finally {
      setExplainingId(null);
    }
  };

  const handleCreateRoute = async (finding: Finding) => {
    setCreatingRouteId(finding.id);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId: finding.id }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Contribution route created!', 'success');
        router.push(`/app/contributions?routeId=${data.route.id}`);
      } else {
        showToast(data.error || 'Failed to create route', 'error');
      }
    } catch {
      showToast('Network error while creating route', 'error');
    } finally {
      setCreatingRouteId(null);
    }
  };

  // Filter findings based on text search query
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        (f.file && f.file.toLowerCase().includes(q)) ||
        f.ruleId.toLowerCase().includes(q) ||
        f.impact.toLowerCase().includes(q)
      );
    });
  }, [findings, searchQuery]);

  // Aggregate count metrics
  const counts = useMemo(() => {
    const bySev: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    let reviewed = 0;
    let goodFirst = 0;
    let maintainerAssistance = 0;
    let resolved = 0;

    findings.forEach((f) => {
      const sev = f.severity?.toUpperCase() || 'INFO';
      if (bySev[sev] !== undefined) bySev[sev]++;
      if (f.reviewed) reviewed++;

      const rLabel = f.readiness?.label;
      if (rLabel === 'good-first-contribution') goodFirst++;
      if (rLabel === 'maintainer-assistance') maintainerAssistance++;
      if (f.diffStatus === 'resolved') resolved++;
    });

    return { bySev, reviewed, goodFirst, maintainerAssistance, resolved, total: findings.length };
  }, [findings]);

  // Derived 3-depth explanation text for selected finding
  const explanationText = useMemo(() => {
    if (!selectedFinding) return '';
    if (selectedFinding.explanationModes?.[explanationMode]) {
      return selectedFinding.explanationModes[explanationMode];
    }
    const file = selectedFinding.file || 'Repository Root';
    if (explanationMode === 'beginner') {
      return `This finding identifies "${selectedFinding.title}" in \`${file}\`. Addressing this improves repository security posture and ensures clean standards. As an open-source contributor, you will inspect the file, apply the recommended action, and verify it locally before submitting a clean pull request.`;
    }
    if (explanationMode === 'developer') {
      return `Deterministic rule \`${selectedFinding.ruleId}\` flagged in \`${file}\` with verified severity **${selectedFinding.severity}**. Action required: ${selectedFinding.fixHint}. Validate changes locally using existing tests or linter checks.`;
    }
    return `Maintainer hygiene finding: **${selectedFinding.severity}** severity risk in \`${file}\`. Impact: ${selectedFinding.impact}. Requires strict adherence to disclosure policy and non-breaking regression boundaries.`;
  }, [selectedFinding, explanationMode]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 bg-black text-textPrimary overflow-x-hidden">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-borderDark">
        <div>
          <h1 className="text-2xl font-heading font-bold text-textPrimary flex items-center gap-2">
            <span>Verified Findings</span>
            {activeScan && (
              <span className="text-xs font-mono font-medium text-lemonChiffon bg-coffeeBean px-3 py-1 rounded-full border border-lemonChiffon/20">
                {activeScan.repoName}
              </span>
            )}
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Deterministic security, manifest, and health findings with exact evidence, Contribution Readiness scoring, and grounded contributor trails.
          </p>
        </div>

        <button
          onClick={() => router.push('/app/scan')}
          className="min-h-[44px] px-5 py-2.5 rounded-full bg-blackHole hover:bg-blackHole/80 text-textPrimary border border-borderDark text-xs font-medium transition-colors self-start md:self-auto flex items-center justify-center press-spring touch-manipulation"
        >
          Scan Another Repo
        </button>
      </div>

      {/* Filter Toolbar (P8 Task 6: URL-synced) */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-borderDark space-y-3.5">
        {/* Row 1: Search & Severity Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search */}
          <div className="w-full md:w-80 relative shrink-0">
            <Search className="w-4 h-4 text-textMuted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search findings, files, or rules..."
              aria-label="Search findings by title, file, or rule ID"
              className="w-full min-h-[44px] pl-9 pr-10 py-2 bg-black border border-borderDark rounded-xl text-xs sm:text-sm text-textPrimary placeholder-textMuted/40 focus:outline-none focus:border-lemonChiffon"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="min-w-[44px] min-h-[44px] absolute right-0 top-0 text-textMuted hover:text-textPrimary flex items-center justify-center press-spring touch-manipulation"
                aria-label="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" role="toolbar" aria-label="Severity filter">
            <span className="text-xs text-textMuted font-medium flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3.5 h-3.5" /> Severity:
            </span>
            {SEVERITY_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSeverityChange(s)}
                className={`min-h-[44px] px-3.5 py-2 text-xs rounded-full font-medium transition-colors shrink-0 flex items-center justify-center press-spring touch-manipulation ${
                  severityFilter === s
                    ? 'bg-lemonChiffon text-black font-semibold shadow-sm'
                    : 'text-textMuted hover:text-textPrimary bg-black border border-borderDark'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Category Filter */}
        <div className="pt-2.5 border-t border-borderDark/40 flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" role="toolbar" aria-label="Category filter">
          <span className="text-xs text-textMuted font-medium shrink-0 mr-1">Category:</span>
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleCategoryChange(c.id)}
              className={`min-h-[44px] px-3.5 py-2 text-xs rounded-full font-medium transition-colors shrink-0 flex items-center justify-center press-spring touch-manipulation ${
                categoryFilter === c.id
                  ? 'bg-coffeeBean text-lemonChiffon border border-lemonChiffon/30 font-semibold'
                  : 'text-textMuted hover:text-textPrimary bg-black border border-borderDark'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Row 3 Filters: Contribution Readiness & Diff Status */}
        <div className="pt-2.5 border-t border-borderDark/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Readiness Filter */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-textMuted font-medium flex items-center gap-1 shrink-0 mr-1">
              <TrendingUp className="w-3.5 h-3.5 text-lemonChiffon" /> Readiness:
            </span>
            {READINESS_OPTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleReadinessChange(r.id)}
                className={`min-h-[44px] px-3 py-2 rounded-full text-[11px] font-mono transition-colors shrink-0 flex items-center justify-center press-spring touch-manipulation ${
                  readinessFilter === r.id
                    ? 'bg-lemonChiffon text-black font-semibold shadow-sm'
                    : 'text-textMuted hover:text-textPrimary bg-black border border-borderDark'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Diff Status Filter */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-textMuted font-medium flex items-center gap-1 shrink-0 mr-1">
              <GitCompare className="w-3.5 h-3.5 text-botticelli" /> Diff Status:
            </span>
            {DIFF_OPTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDiffChange(d.id)}
                className={`min-h-[44px] px-3 py-2 rounded-full text-[11px] font-mono transition-colors shrink-0 flex items-center justify-center press-spring touch-manipulation ${
                  diffFilter === d.id
                    ? 'bg-coffeeBean text-lemonChiffon border border-lemonChiffon/30 font-semibold'
                    : 'text-textMuted hover:text-textPrimary bg-black border border-borderDark'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Count Summary */}
        <div className="pt-3 border-t border-borderDark/60 flex flex-wrap items-center justify-between text-xs text-textMuted gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Showing <strong className="text-textPrimary">{filteredFindings.length}</strong> of{' '}
              <strong className="text-textPrimary">{counts.total}</strong> findings
            </span>
            <span className="text-borderDark">•</span>
            <span className="text-emerald-400 font-medium">{counts.goodFirst} Good First</span>
            <span className="text-rosewood font-medium">{counts.maintainerAssistance} Maintainer Assistance</span>
            <span className="text-borderDark">•</span>
            <span className="text-rosewood font-medium">{counts.bySev.CRITICAL} Critical</span>
            <span className="text-electricTangerine font-medium">{counts.bySev.HIGH} High</span>
            <span className="text-lemonChiffon font-medium">{counts.bySev.MEDIUM} Medium</span>
            <span className="text-botticelli font-medium">{counts.bySev.LOW} Low</span>
          </div>

          <div className="flex items-center gap-3">
            {counts.resolved > 0 && (
              <span className="text-blue-400 font-mono text-[11px]">
                {counts.resolved} Resolved
              </span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{counts.reviewed} Reviewed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-rosewood/20 border border-rosewood text-sustainableLinen flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-rosewood shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={fetchFindings}
            className="px-3 py-1 rounded-md bg-rosewood hover:bg-rosewood/80 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-20 glass-panel rounded-2xl border border-borderDark">
          <Loader2 className="w-8 h-8 text-lemonChiffon animate-spin mx-auto mb-3" />
          <p className="text-xs text-textMuted font-mono">Loading verified findings...</p>
        </div>
      ) : filteredFindings.length > 0 ? (
        /* Master-Detail Split Layout (P8 Task 1: list left, detail right, stack on <lg without horizontal overflow) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Accessible Finding List (Col span 5) */}
          <div className="lg:col-span-5 space-y-3 w-full overflow-x-hidden" role="region" aria-label="Findings List">
            <div className="flex items-center justify-between text-xs font-semibold text-textMuted uppercase tracking-wider mb-1">
              <span>Sorted by Severity &amp; Confidence</span>
              <span>{filteredFindings.length} items</span>
            </div>

            <ul role="list" className="space-y-2.5 max-h-[780px] overflow-y-auto pr-1 no-scrollbar">
              {filteredFindings.map((finding) => {
                const isSelected = selectedFinding?.id === finding.id;
                const isCritical = finding.severity?.toUpperCase() === 'CRITICAL';
                const readiness = finding.readiness;
                const topReason = readiness?.reasons?.[0];

                // P8 Task 1: Selected card = tangerine border; CRITICAL = Rosewood
                let cardStyle = 'glass-panel hover:border-platinumSilver/30';
                if (isSelected) {
                  if (isCritical) {
                    cardStyle = 'border-rosewood bg-rosewood/25 shadow-md ring-1 ring-rosewood/50';
                  } else {
                    cardStyle = 'border-electricTangerine shadow-liquid-glow bg-blackHole/80';
                  }
                } else if (isCritical) {
                  cardStyle = 'border-rosewood/40 bg-rosewood/10 hover:border-rosewood/70';
                }

                return (
                  <li role="listitem" key={finding.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedFinding(finding)}
                      aria-pressed={isSelected}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${cardStyle}`}
                    >
                      {/* Top Badges Row: Severity (Text + Icon), Readiness, Diff Status */}
                      <div className="flex flex-wrap items-center justify-between text-[11px] mb-2 gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SeverityBadge severity={finding.severity} />

                          {finding.urgencyScore !== undefined && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-black border border-borderDark text-textMuted">
                              Urg: {finding.urgencyScore}
                            </span>
                          )}

                          {readiness && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${getReadinessBadge(readiness.label)}`}>
                              Readiness: {readiness.total}/100
                            </span>
                          )}

                          {finding.diffStatus && finding.diffStatus !== 'unchanged' && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${getDiffStatusBadge(finding.diffStatus)}`}>
                              {finding.diffStatus}
                            </span>
                          )}

                          {finding.reviewed && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-600/40 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Reviewed
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-textMuted">
                          {typeof finding.confidence === 'number'
                            ? `${Math.round(finding.confidence * 100)}%`
                            : finding.confidence || 'HIGH'}{' '}
                          Conf.
                        </span>
                      </div>

                      <h4 className="text-xs font-heading font-semibold text-textPrimary line-clamp-2">
                        {finding.title}
                      </h4>

                      {/* Top Readiness reason preview */}
                      {topReason && (
                        <p className="mt-1.5 text-[11px] text-textMuted line-clamp-1 italic">
                          💡 {topReason}
                        </p>
                      )}

                      <div className="mt-2.5 text-[11px] text-botticelli font-mono flex items-center justify-between">
                        <span className="truncate max-w-[200px]">{finding.file || 'Repository Root'}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-textMuted shrink-0" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: Finding Detail Panel (Col span 7) */}
          <div className="lg:col-span-7 w-full overflow-x-hidden">
            {selectedFinding ? (
              <div
                className={`glass-panel p-6 sm:p-8 rounded-2xl border transition-all space-y-6 break-words ${
                  selectedFinding.severity?.toUpperCase() === 'CRITICAL'
                    ? 'border-rosewood/70 bg-rosewood/10 shadow-md'
                    : selectedFinding.severity?.toUpperCase() === 'HIGH'
                    ? 'border-electricTangerine/40 bg-coffeeBean/40'
                    : 'border-borderDark'
                }`}
              >
                
                {/* Header: Title, Category, Severity Badge, Rule ID, Confidence, Disclosure Label, Review Toggle */}
                <div className="space-y-3 pb-4 border-b border-borderDark">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={selectedFinding.severity} />

                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-black border border-borderDark text-textMuted uppercase font-mono">
                        {selectedFinding.category}
                      </span>

                      <span className="text-[11px] font-mono text-lemonChiffon bg-blackHole px-2 py-0.5 rounded border border-borderDark">
                        Rule: {selectedFinding.ruleId}
                      </span>

                      <span className="text-[11px] font-mono text-textMuted bg-blackHole px-2 py-0.5 rounded border border-borderDark">
                        Confidence:{' '}
                        {typeof selectedFinding.confidence === 'number'
                          ? `${Math.round(selectedFinding.confidence * 100)}%`
                          : selectedFinding.confidence || 'HIGH'}
                      </span>

                      {/* P8 Task 2: Disclosure label */}
                      <DisclosureLabel
                        mode={selectedFinding.disclosureMode}
                        category={selectedFinding.category}
                      />

                      {selectedFinding.diffStatus && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${getDiffStatusBadge(selectedFinding.diffStatus)}`}>
                          Diff: {selectedFinding.diffStatus}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Review State Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleReview(selectedFinding)}
                        disabled={updatingReviewId === selectedFinding.id}
                        className={`min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold border transition-all press-spring touch-manipulation ${
                          selectedFinding.reviewed
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900/60'
                            : 'bg-[#222222] text-[#AAA9A1] border-white/10 hover:text-[#FFF8CA] hover:border-[#FFF8CA]/30'
                        }`}
                      >
                        {updatingReviewId === selectedFinding.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : selectedFinding.reviewed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#AAA9A1]" />
                        )}
                        <span>{selectedFinding.reviewed ? 'Reviewed ✓' : 'Mark as Reviewed'}</span>
                      </button>

                      {/* Deep Link to Detail Page */}
                      <Link
                        href={`/app/findings/${selectedFinding.id}`}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl text-textMuted hover:text-lemonChiffon hover:bg-black/40 border border-borderDark transition-colors press-spring touch-manipulation"
                        title="Open finding deep link in dedicated page"
                        aria-label="Open finding deep link in dedicated page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  <h3 className="text-lg font-heading font-bold text-textPrimary leading-snug">
                    {selectedFinding.title}
                  </h3>

                  {/* P8 Task 2: file:line and copyable SHA-256 evidenceHash */}
                  <div className="p-3.5 rounded-xl bg-black border border-borderDark space-y-2 text-xs font-mono">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-botticelli">
                      <div className="flex items-center gap-2 truncate">
                        <FileCode className="w-4 h-4 text-lemonChiffon shrink-0" />
                        <span>Exact Location: </span>
                        <strong className="text-textPrimary truncate">
                          {selectedFinding.file || 'Repository Root'}
                          {(selectedFinding.lineStart || selectedFinding.line) && (
                            <span className="text-lemonChiffon ml-1">
                              :{selectedFinding.lineStart || selectedFinding.line}
                              {selectedFinding.lineEnd &&
                              selectedFinding.lineEnd !== (selectedFinding.lineStart || selectedFinding.line)
                                ? `-${selectedFinding.lineEnd}`
                                : ''}
                            </span>
                          )}
                        </strong>
                      </div>
                      <span className="text-[10px] text-textMuted uppercase font-mono px-2 py-0.5 rounded bg-blackHole border border-borderDark shrink-0 self-start sm:self-auto">
                        {selectedFinding.sourceTool || 'Deterministic Engine'}
                      </span>
                    </div>

                    {/* Copyable SHA-256 evidenceHash */}
                    {selectedFinding.evidenceHash && (
                      <div className="pt-2 border-t border-platinumSilver/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2 truncate text-textMuted">
                          <span className="text-lemonChiffon/80 uppercase tracking-wider font-semibold">SHA-256:</span>
                          <span className="text-platinumSilver font-mono truncate max-w-xs sm:max-w-md">
                            {selectedFinding.evidenceHash}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyHash(selectedFinding.evidenceHash)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blackHole hover:bg-black border border-borderDark text-[11px] text-botticelli hover:text-lemonChiffon transition-colors self-start sm:self-auto shrink-0"
                        >
                          {copiedHash ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Hash</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* P8 Task 2: 3-line code context snippet (monospace, Botticelli-tinted) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-textMuted uppercase tracking-wider">
                      Verified Code Context (Redacted)
                    </span>
                    <span className="text-lemonChiffon text-[11px] flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Secrets Redacted In-Memory
                    </span>
                  </div>

                  <CodeContextViewer
                    code={selectedFinding.redactedEvidence || selectedFinding.evidence}
                    file={selectedFinding.file}
                    lineStart={selectedFinding.lineStart || selectedFinding.line}
                    lineEnd={selectedFinding.lineEnd}
                    onCopy={() =>
                      handleCopyEvidence(
                        selectedFinding.redactedEvidence || selectedFinding.evidence
                      )
                    }
                    copied={copiedEvidence}
                  />

                  <p className="text-[10px] text-textMuted">
                    {selectedFinding.category === 'secret'
                      ? 'Credentials strictly redacted. Raw secret material is never logged or exposed.'
                      : 'Evidence extracted deterministically from scanned repository tree.'}
                  </p>
                </div>

                {/* P8 Task 3: Evidence Chain (8 Trust Steps) */}
                <EvidenceChainView evidenceHash={selectedFinding.evidenceHash} />

                {/* P8 Task 4: Engine label EVERYWHERE an explanation renders */}
                <div className="space-y-3 pt-2 border-t border-borderDark">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-lemonChiffon" />
                      <span className="text-xs font-bold text-textPrimary uppercase tracking-wider">
                        Grounded Explanation &amp; Guidance
                      </span>
                    </div>

                    {/* Mode Toggle Pills (Beginner / Developer / Maintainer) */}
                    <div className="flex items-center gap-1 bg-black p-1 rounded-full border border-borderDark overflow-x-auto no-scrollbar">
                      {(['beginner', 'developer', 'maintainer'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setExplanationMode(mode)}
                          className={`min-h-[44px] px-3.5 py-2 text-xs font-mono capitalize rounded-full transition-all press-spring touch-manipulation flex items-center justify-center shrink-0 ${
                            explanationMode === mode
                              ? 'bg-lemonChiffon text-black font-semibold shadow-sm'
                              : 'text-textMuted hover:text-textPrimary'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Engine Badge rendering active engine label + fallback notice */}
                  <EngineBadge
                    engine={currentExplanation?.generatedBy || (activeScan ? 'deterministic' : 'gemma')}
                    fallback={currentExplanation?.fallback ?? true}
                    fallbackReason={currentExplanation?.fallbackReason}
                  />

                  <div className="p-4 rounded-xl bg-black border border-borderDark space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-lemonChiffon capitalize">
                        {explanationMode} Perspective
                      </span>
                      <span className="text-textMuted font-mono text-[10px]">
                        Grounded in identical verified evidence
                      </span>
                    </div>
                    <p className="text-xs text-textPrimary leading-relaxed">
                      {explanationText}
                    </p>
                  </div>
                </div>

                {/* P8 Task 5: Skills Gap panel with Pale Lavender accents & impact score */}
                <SkillsGapPanel
                  skills={selectedFinding.skills}
                  learningResources={selectedFinding.learningResources}
                  difficulty={selectedFinding.readiness?.difficulty}
                  category={selectedFinding.category}
                  contributorImpact={15}
                />

                {/* Contribution Readiness & Risk Separation Section */}
                <div className="space-y-3 pt-2 border-t border-borderDark">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-lemonChiffon" />
                      <span>Contribution Readiness &amp; Risk Separation</span>
                    </span>
                    <span className="text-[10px] font-mono text-textMuted">
                      Deterministic Invariant: Urgency ≠ Readiness
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Urgency & Risk Card */}
                    <div className="p-4 rounded-xl bg-black border border-borderDark space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-textMuted uppercase tracking-wider font-semibold text-[10px]">
                          Risk / Urgency Score
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-rosewood/20 text-sustainableLinen border border-rosewood/40">
                          {selectedFinding.urgencyLabel || 'medium'}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-mono text-electricTangerine">
                          {selectedFinding.urgencyScore ?? 50}
                        </span>
                        <span className="text-textMuted text-[10px] font-mono">/ 100</span>
                      </div>
                      <p className="text-[11px] text-textMuted leading-relaxed">
                        Urgency measures repository threat priority. Critical vulnerabilities must be fixed immediately by maintainers, NOT delegated to beginner contributors.
                      </p>
                    </div>

                    {/* Contribution Readiness Card */}
                    {selectedFinding.readiness ? (
                      <div className="p-4 rounded-xl bg-black border border-lemonChiffon/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-textMuted uppercase tracking-wider font-semibold text-[10px]">
                            Contribution Readiness
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getReadinessBadge(selectedFinding.readiness.label)}`}>
                            {selectedFinding.readiness.label.replace(/-/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold font-mono text-lemonChiffon">
                            {selectedFinding.readiness.total}
                          </span>
                          <span className="text-textMuted text-[10px] font-mono">/ 100</span>
                          {selectedFinding.readiness.estimatedMinutes && (
                            <span className="text-textMuted text-[10px] font-mono ml-auto">
                              ~{selectedFinding.readiness.estimatedMinutes} mins
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-lemonChiffon/80 leading-relaxed">
                          Readiness evaluates whether a new contributor can safely fix and test this finding with clear bounds.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-black border border-borderDark flex items-center justify-center text-textMuted text-xs">
                        Readiness calculated during scan
                      </div>
                    )}
                  </div>

                  {/* 5-Factor Weighted Criteria Breakdown */}
                  {selectedFinding.readiness && (
                    <div className="p-4 rounded-xl bg-black border border-borderDark space-y-3">
                      <span className="text-[11px] font-semibold text-textMuted uppercase tracking-wider block">
                        5-Factor Deterministic Weighting
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-blackHole border border-borderDark space-y-1">
                          <div className="text-textMuted text-[10px]">Clarity</div>
                          <div className="font-mono font-bold text-lemonChiffon">
                            {selectedFinding.readiness.evidenceClarity} <span className="text-textMuted font-normal">/ 25</span>
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-blackHole border border-borderDark space-y-1">
                          <div className="text-textMuted text-[10px]">Scope</div>
                          <div className="font-mono font-bold text-lemonChiffon">
                            {selectedFinding.readiness.scopeSimplicity} <span className="text-textMuted font-normal">/ 20</span>
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-blackHole border border-borderDark space-y-1">
                          <div className="text-textMuted text-[10px]">Testability</div>
                          <div className="font-mono font-bold text-lemonChiffon">
                            {selectedFinding.readiness.testability} <span className="text-textMuted font-normal">/ 20</span>
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-blackHole border border-borderDark space-y-1">
                          <div className="text-textMuted text-[10px]">Skill Accessibility</div>
                          <div className="font-mono font-bold text-lemonChiffon">
                            {selectedFinding.readiness.skillAccessibility} <span className="text-textMuted font-normal">/ 20</span>
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-blackHole border border-borderDark space-y-1">
                          <div className="text-textMuted text-[10px]">Context</div>
                          <div className="font-mono font-bold text-lemonChiffon">
                            {selectedFinding.readiness.contextCompleteness} <span className="text-textMuted font-normal">/ 15</span>
                          </div>
                        </div>
                      </div>

                      {/* Reasons list */}
                      {selectedFinding.readiness.reasons.length > 0 && (
                        <div className="pt-2 border-t border-borderDark/40 space-y-1">
                          <span className="text-[10px] font-mono uppercase text-lemonChiffon font-semibold">Positive Indicators:</span>
                          <ul className="space-y-1">
                            {selectedFinding.readiness.reasons.map((r, i) => (
                              <li key={i} className="text-[11px] text-textMuted flex items-start gap-1.5">
                                <span className="text-emerald-400 mt-0.5">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Blockers list */}
                      {selectedFinding.readiness.blockers && selectedFinding.readiness.blockers.length > 0 && (
                        <div className="pt-2 border-t border-borderDark/40 space-y-1">
                          <span className="text-[10px] font-mono uppercase text-rosewood font-semibold">Disclosure Blockers:</span>
                          <ul className="space-y-1">
                            {selectedFinding.readiness.blockers.map((b, i) => (
                              <li key={i} className="text-[11px] text-sustainableLinen flex items-start gap-1.5">
                                <span className="text-rosewood mt-0.5">✕</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Suggested Action & Operational Impact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-borderDark">
                  <div className="p-3.5 rounded-xl bg-black border border-borderDark text-xs text-textPrimary space-y-1">
                    <span className="font-semibold text-lemonChiffon block">Suggested Action</span>
                    <p className="text-textMuted leading-relaxed">{selectedFinding.fixHint}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black border border-borderDark text-xs text-textPrimary space-y-1">
                    <span className="font-semibold text-textMuted uppercase tracking-wider block">Impact Summary</span>
                    <p className="text-textMuted leading-relaxed">{selectedFinding.impact}</p>
                  </div>
                </div>

                {/* Action Buttons: Explain with Gemma 4 & Create Contribution Route */}
                <div className="pt-4 flex flex-col sm:flex-row items-center gap-3 border-t border-borderDark">
                  <button
                    onClick={() => handleRequestExplanation(selectedFinding)}
                    disabled={explainingId === selectedFinding.id}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-full bg-coffeeBean hover:bg-coffeeBean/80 text-textPrimary border border-borderDark text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 press-spring touch-manipulation"
                  >
                    {explainingId === selectedFinding.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-electricTangerine" />
                        <span>Querying Grounded Explanation...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-lemonChiffon" />
                        <span>Explain with Gemma 4</span>
                      </>
                    )}
                  </button>

                  {selectedFinding.disclosureMode === 'security-disclosure' ||
                  selectedFinding.category === 'secret' ? (
                    <div className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-full bg-rosewood/30 text-sustainableLinen border border-rosewood text-xs font-semibold flex items-center justify-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-lemonChiffon" />
                      <span>Public Draft Blocked (Private Disclosure Only)</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCreateRoute(selectedFinding)}
                      disabled={creatingRouteId === selectedFinding.id}
                      className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lemonChiffon/20 disabled:opacity-50 press-spring touch-manipulation"
                    >
                      {creatingRouteId === selectedFinding.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Structuring Route...</span>
                        </>
                      ) : (
                        <>
                          <Compass className="w-3.5 h-3.5" />
                          <span>Find Safe Contribution</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>

              </div>
            ) : null}
          </div>

        </div>
      ) : (
        /* Empty State (P8 Task 7: "No supported deterministic findings detected", never "secure") */
        <div className="text-center py-20 glass-panel rounded-2xl border border-dashed border-borderDark px-4">
          <Shield className="w-10 h-10 text-lemonChiffon/70 mx-auto mb-3" />
          <h3 className="text-sm font-heading font-semibold text-textPrimary">
            {findings.length === 0
              ? 'No supported deterministic findings detected'
              : 'No supported deterministic findings detected matching filter criteria'}
          </h3>
          <p className="text-xs text-textMuted mt-1.5 max-w-md mx-auto leading-relaxed">
            {findings.length === 0
              ? 'ContribLens analyzes bounded repository manifests, GitHub Actions workflows, repository governance, and exposed secrets. No supported deterministic issues were detected in this bounded scan.'
              : 'No deterministic findings match the current severity, category, or search filters.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-full bg-coffeeBean text-lemonChiffon border border-lemonChiffon/30 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Reset Filters
            </button>
            <button
              onClick={() => router.push('/app/scan')}
              className="px-5 py-2 rounded-full bg-lemonChiffon text-black text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Scan Another Repository
            </button>
          </div>
        </div>
      )}

      {/* Grounded Explanation Modal with EngineBadge */}
      {currentExplanation && selectedFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-2xl w-full glass-panel border border-borderDark rounded-2xl shadow-glass-card p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <EngineBadge
                    engine={currentExplanation.generatedBy || 'gemma'}
                    fallback={currentExplanation.fallback}
                    fallbackReason={currentExplanation.fallbackReason}
                  />
                  <span className="text-xs text-botticelli capitalize font-mono">
                    {currentExplanation.difficulty} Track
                  </span>
                </div>
                <h3 className="text-lg font-heading font-bold text-textPrimary">{selectedFinding.title}</h3>
              </div>
              <button
                onClick={() => setCurrentExplanation(null)}
                className="text-textMuted hover:text-textPrimary p-1"
                aria-label="Close explanation modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-textPrimary">
              <div>
                <h4 className="font-heading font-semibold text-textMuted uppercase tracking-wider mb-1">
                  Educational Context
                </h4>
                <p className="leading-relaxed bg-black p-3.5 rounded-xl border border-borderDark">
                  {currentExplanation.explanation}
                </p>
              </div>

              <div>
                <h4 className="font-heading font-semibold text-textMuted uppercase tracking-wider mb-1">
                  Repository Risk
                </h4>
                <p className="leading-relaxed bg-black p-3.5 rounded-xl border border-borderDark">
                  {currentExplanation.riskContext}
                </p>
              </div>

              <div>
                <h4 className="font-heading font-semibold text-textMuted uppercase tracking-wider mb-1">
                  Step-by-Step Fix Guidance
                </h4>
                <p className="leading-relaxed bg-black p-3.5 rounded-xl border border-borderDark text-lemonChiffon">
                  {currentExplanation.recommendedFix}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-black border border-borderDark">
                  <span className="text-textMuted text-[10px] block mb-0.5">Estimated Time</span>
                  <span className="font-semibold text-textPrimary">{currentExplanation.estimatedEffort}</span>
                </div>
                <div className="p-3 rounded-xl bg-black border border-borderDark">
                  <span className="text-textMuted text-[10px] block mb-0.5">Required Skills</span>
                  <span className="font-semibold text-textPrimary">{currentExplanation.skillsNeeded.join(', ')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-borderDark">
              <button
                onClick={() => setCurrentExplanation(null)}
                className="px-4 py-2 rounded-full bg-blackHole text-textPrimary text-xs font-semibold hover:bg-black transition-colors"
              >
                Close
              </button>
              {selectedFinding.disclosureMode !== 'security-disclosure' && selectedFinding.category !== 'secret' && (
                <button
                  onClick={() => {
                    const target = selectedFinding;
                    setCurrentExplanation(null);
                    handleCreateRoute(target);
                  }}
                  className="px-5 py-2 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Create Route from this Explanation</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
