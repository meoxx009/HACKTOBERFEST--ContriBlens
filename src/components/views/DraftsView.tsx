'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  FileText,
  Copy,
  Download,
  Check,
  Loader2,
  Code2,
  Eye,
  Edit3,
  Trash2,
  Save,
  Tag,
  ShieldAlert,
  Sparkles,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { IssueDraft } from '@/types';
import { redactSecrets } from '@/lib/redaction';
import { EngineBadge } from '@/components/ui/EngineBadge';

function DraftsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get('draftId');

  const { activeScan, showToast } = useApp();

  const [drafts, setDrafts] = useState<IssueDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<IssueDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'raw'>('preview');

  // Edit draft form state
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editLabels, setEditLabels] = useState('');
  const [editStatus, setEditStatus] = useState<'draft' | 'reviewed' | 'exported'>('draft');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScan]);

  useEffect(() => {
    if (selectedDraft) {
      setEditTitle(selectedDraft.title);
      setEditBody(selectedDraft.markdownContent || selectedDraft.body || '');
      setEditLabels((selectedDraft.labels || []).join(', '));
      setEditStatus(selectedDraft.status || 'draft');
      setConfirmDelete(false);
    }
  }, [selectedDraft]);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const url = activeScan ? `/api/drafts?scanId=${activeScan.id}` : '/api/drafts';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const loadedDrafts: IssueDraft[] = data.drafts || [];
        setDrafts(loadedDrafts);

        if (requestedDraftId) {
          const match = loadedDrafts.find((d) => d.id === requestedDraftId);
          if (match) setSelectedDraft(match);
          else if (loadedDrafts.length > 0) setSelectedDraft(loadedDrafts[0]);
        } else if (loadedDrafts.length > 0) {
          setSelectedDraft(loadedDrafts[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load drafts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateDraft = async () => {
    if (!selectedDraft) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/issue-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: selectedDraft.id,
          regenerate: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.draft) {
        setSelectedDraft(data.draft);
        setDrafts((prev) => prev.map((d) => (d.id === data.draft.id ? data.draft : d)));
        showToast(
          data.draft.generatedBy === 'gemini'
            ? 'Draft regenerated via Gamma 4 using server-side evidence!'
            : 'Draft regenerated via Deterministic Planner (Fallback)',
          'success'
        );
      } else {
        showToast(data.error || 'Failed to regenerate draft', 'error');
      }
    } catch {
      showToast('Error regenerating draft', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedDraft) return;
    setSaving(true);
    try {
      const parsedLabels = editLabels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      // Defensively re-redact before sending
      const cleanMarkdown = redactSecrets(editBody);
      const cleanTitle = redactSecrets(editTitle.trim());

      const res = await fetch('/api/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: selectedDraft.id,
          title: cleanTitle,
          markdownContent: cleanMarkdown,
          labels: parsedLabels,
          status: editStatus,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.draft;
        setSelectedDraft(updated);
        setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        showToast('Draft updated and saved successfully!', 'success');
        setViewMode('preview');
      } else {
        showToast('Failed to save draft changes', 'error');
      }
    } catch {
      showToast('Error saving draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!selectedDraft) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/drafts?draftId=${selectedDraft.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Draft deleted successfully', 'info');
        const remaining = drafts.filter((d) => d.id !== selectedDraft.id);
        setDrafts(remaining);
        setSelectedDraft(remaining.length > 0 ? remaining[0] : null);
        setConfirmDelete(false);
      } else {
        showToast('Failed to delete draft', 'error');
      }
    } catch {
      showToast('Error deleting draft', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (newStatus: 'draft' | 'reviewed' | 'exported') => {
    if (!selectedDraft) return;
    try {
      const res = await fetch('/api/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: selectedDraft.id,
          status: newStatus,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.draft;
        setSelectedDraft(updated);
        setEditStatus(updated.status);
        setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        showToast(`Draft status updated to "${newStatus}"`, 'info');
      }
    } catch {
      showToast('Error updating draft status', 'error');
    }
  };

  const handleCopy = () => {
    if (!selectedDraft) return;
    // Defensive re-redaction before clipboard copy
    const safeContent = redactSecrets(selectedDraft.markdownContent);
    navigator.clipboard.writeText(safeContent);
    setCopied(true);
    showToast('Markdown draft copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);

    if (selectedDraft.status !== 'exported') {
      handleStatusChange('exported');
    }
  };

  const handleDownload = () => {
    if (!selectedDraft) return;
    // Defensive re-redaction before export
    const safeContent = redactSecrets(selectedDraft.markdownContent);
    const blob = new Blob([safeContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedDraft.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Draft exported as .md file', 'success');

    if (selectedDraft.status !== 'exported') {
      handleStatusChange('exported');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 bg-black text-textPrimary">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-borderDark">
        <div>
          <h1 className="text-2xl font-heading font-bold text-textPrimary flex items-center gap-2">
            <span>Maintainer Issue Drafts</span>
            {activeScan && (
              <span className="text-xs font-mono font-medium text-lemonChiffon bg-coffeeBean px-3 py-1 rounded-full border border-lemonChiffon/20">
                {activeScan.repoName}
              </span>
            )}
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Polite, reviewable issue drafts engineered for open-source maintainers. Includes problem description, evidence, impact, test plans, and acceptance criteria.
          </p>
        </div>

        {/* Global Safety Notice: Clearly labeled Maintainer review required & Never auto-published */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-coffeeBean border border-electricTangerine/40 text-xs text-lemonChiffon">
          <ShieldAlert className="w-4 h-4 text-electricTangerine" />
          <span className="font-semibold">Maintainer review required • Never auto-published</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 text-lemonChiffon animate-spin mx-auto mb-2" />
          <p className="text-xs text-textMuted">Loading issue drafts...</p>
        </div>
      ) : drafts.length > 0 && selectedDraft ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Drafts Sidebar List (Col 1) */}
          <div className="space-y-3 lg:col-span-1">
            <h3 className="text-xs font-heading font-semibold text-textMuted uppercase tracking-wider">
              Saved Drafts ({drafts.length})
            </h3>
            <div className="space-y-2.5 max-h-[700px] overflow-y-auto no-scrollbar pr-1">
              {drafts.map((d) => {
                const isSelected = selectedDraft.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDraft(d)}
                    className={`w-full min-h-[44px] p-4 rounded-xl text-left border transition-all press-spring touch-manipulation ${
                      isSelected
                        ? 'bg-coffeeBean border-lemonChiffon shadow-md'
                        : 'glass-panel hover:border-borderDark/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-textMuted mb-1">
                      <span
                        className={`font-mono px-2 py-0.5 rounded-full text-[10px] border ${
                          d.generatedBy === 'gemini'
                            ? 'bg-electricTangerine/15 text-electricTangerine border-electricTangerine/30'
                            : 'bg-coffeeBean text-lemonChiffon border-lemonChiffon/30'
                        }`}
                      >
                        {d.generatedBy === 'gemini' ? '✦ GEMMA' : 'DETERMINISTIC'}
                      </span>
                      <span className="capitalize px-1.5 py-0.5 rounded text-[9px] bg-black border border-borderDark text-textMuted">
                        {d.status || 'draft'}
                      </span>
                    </div>
                    <h4 className="text-xs font-heading font-semibold text-textPrimary line-clamp-2">{d.title}</h4>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-textMuted/70">
                      <span>{d.repoName}</span>
                      <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Draft Workspace & Surface (Col 2, 3, 4) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Action Bar */}
            <div className="glass-panel p-4 rounded-2xl border border-borderDark flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                {/* Badges: Evidence-linked, AI-validated / Fallback, and Maintainer Review Required */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {selectedDraft.findingId && (
                    <Link
                      href={`/app/findings/${selectedDraft.findingId}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-coffeeBean hover:bg-black text-lemonChiffon border border-lemonChiffon/30 transition-colors"
                      title="Navigate to verified evidence in Findings view"
                    >
                      <ExternalLink className="w-3 h-3 text-electricTangerine" />
                      <span>Evidence-linked: #{selectedDraft.findingId}</span>
                    </Link>
                  )}

                  <EngineBadge
                    engine={selectedDraft.generatedBy === 'gemini' ? 'gemma' : (selectedDraft.generatedBy || 'deterministic')}
                    fallback={selectedDraft.fallback ?? (selectedDraft.generatedBy === 'deterministic' || !selectedDraft.generatedBy)}
                    fallbackReason={selectedDraft.fallbackReason || 'Deterministic explanation — AI unavailable'}
                  />

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rosewood/20 border border-rosewood/50 text-[10px] font-semibold text-rosewood">
                    <ShieldAlert className="w-3 h-3 text-rosewood" />
                    <span>Maintainer review required</span>
                  </span>
                </div>

                <h2 className="text-base font-heading font-bold text-textPrimary mt-0.5">{selectedDraft.title}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Lifecycle Stepper: draft → reviewed → exported */}
                <div className="bg-black p-1 rounded-full border border-borderDark flex items-center text-xs font-mono overflow-x-auto no-scrollbar">
                  <span className="text-[10px] text-textMuted px-2 font-sans uppercase">Lifecycle:</span>
                  {(['draft', 'reviewed', 'exported'] as const).map((st, idx) => {
                    const isCurrent = (selectedDraft.status || 'draft') === st;
                    return (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(st)}
                        className={`min-h-[44px] px-3.5 py-1.5 rounded-full capitalize text-[11px] font-semibold flex items-center gap-1 transition-all press-spring touch-manipulation shrink-0 ${
                          isCurrent
                            ? st === 'exported'
                              ? 'bg-botticelli text-black'
                              : st === 'reviewed'
                              ? 'bg-lemonChiffon text-black'
                              : 'bg-coffeeBean text-lemonChiffon border border-lemonChiffon/30'
                            : 'text-textMuted hover:text-textPrimary'
                        }`}
                        title={`Set lifecycle to ${st}`}
                      >
                        <span>{idx + 1}.</span>
                        <span>{st}</span>
                      </button>
                    );
                  })}
                </div>

                {/* View Mode Toggle: Preview / Edit / Markdown */}
                <div className="bg-black p-1 rounded-full border border-borderDark flex items-center text-xs overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`min-h-[44px] px-3.5 py-1.5 rounded-full flex items-center gap-1 font-medium text-xs press-spring touch-manipulation shrink-0 ${
                      viewMode === 'preview' ? 'bg-coffeeBean text-lemonChiffon' : 'text-textMuted'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button
                    onClick={() => setViewMode('edit')}
                    className={`min-h-[44px] px-3.5 py-1.5 rounded-full flex items-center gap-1 font-medium text-xs press-spring touch-manipulation shrink-0 ${
                      viewMode === 'edit' ? 'bg-coffeeBean text-lemonChiffon' : 'text-textMuted'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setViewMode('raw')}
                    className={`min-h-[44px] px-3.5 py-1.5 rounded-full flex items-center gap-1 font-medium text-xs press-spring touch-manipulation shrink-0 ${
                      viewMode === 'raw' ? 'bg-coffeeBean text-lemonChiffon' : 'text-textMuted'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" /> Markdown
                  </button>
                </div>

                {/* Regenerate Button (Gamma 4 server-side evidence load) */}
                <button
                  onClick={handleRegenerateDraft}
                  disabled={regenerating}
                  className="min-h-[44px] px-4 py-2 rounded-full bg-black hover:bg-coffeeBean text-lemonChiffon text-xs font-semibold flex items-center gap-1.5 transition-colors border border-lemonChiffon/30 disabled:opacity-50 press-spring touch-manipulation"
                  title="Regenerate issue draft via Gamma 4 with fresh server-side evidence"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                  <span>{regenerating ? 'Regenerating...' : 'Regenerate'}</span>
                </button>

                {/* Copy Action */}
                <button
                  onClick={handleCopy}
                  className="min-h-[44px] px-4 py-2 rounded-full bg-blackHole hover:bg-black text-textPrimary text-xs font-semibold flex items-center gap-1.5 transition-colors border border-borderDark press-spring touch-manipulation"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-lemonChiffon" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy MD'}</span>
                </button>

                {/* Download / Export Action */}
                <button
                  onClick={handleDownload}
                  className="min-h-[44px] px-4 py-2 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm press-spring touch-manipulation"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export .md</span>
                </button>

                {/* Delete Draft Action */}
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-black hover:bg-rosewood/30 text-rosewood border border-rosewood/40 transition-colors flex items-center justify-center press-spring touch-manipulation"
                    title="Delete Draft"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-black p-1 rounded-full border border-rosewood">
                    <button
                      onClick={handleDeleteDraft}
                      disabled={deleting}
                      className="min-h-[44px] px-3.5 py-1 rounded-full bg-rosewood text-cotton text-xs font-semibold flex items-center justify-center press-spring touch-manipulation"
                    >
                      {deleting ? '...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[44px] px-3 py-1 text-xs text-textMuted hover:text-textPrimary flex items-center justify-center press-spring touch-manipulation"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* View Mode 1: Edit Form */}
            {viewMode === 'edit' && (
              <div className="glass-panel p-6 rounded-2xl border border-borderDark space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-borderDark">
                  <span className="text-xs font-bold text-lemonChiffon flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4" /> Edit Maintainer Issue Draft
                  </span>
                  <div className="flex items-center gap-3">
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="px-3 py-1 bg-black border border-borderDark rounded-lg text-xs text-textPrimary focus:outline-none focus:border-lemonChiffon"
                    >
                      <option value="draft">Status: Draft</option>
                      <option value="reviewed">Status: Reviewed</option>
                      <option value="exported">Status: Exported</option>
                    </select>
                    <button
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="px-4 py-1.5 bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-bold rounded-full flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-textMuted mb-1">Issue Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black border border-borderDark rounded-xl text-xs sm:text-sm text-textPrimary focus:outline-none focus:border-lemonChiffon"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-textMuted mb-1 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-electricTangerine" />
                      <span>Suggested Labels (comma separated)</span>
                    </label>
                    <input
                      type="text"
                      value={editLabels}
                      onChange={(e) => setEditLabels(e.target.value)}
                      placeholder="e.g. security, good-first-issue, beginner"
                      className="w-full px-4 py-2 bg-black border border-borderDark rounded-xl text-xs text-textPrimary focus:outline-none focus:border-lemonChiffon"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-textMuted mb-1">Markdown Body</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={18}
                      className="w-full p-4 bg-black border border-borderDark rounded-xl font-mono text-xs text-lemonChiffon/90 focus:outline-none focus:border-lemonChiffon leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* View Mode 2: Sustainable Linen Cream Preview */}
            {viewMode === 'preview' && (
              <div className="p-4 sm:p-8 md:p-10 rounded-2xl bg-sustainableLinen text-[#1a1614] shadow-2xl border border-sustainableLinen/80 space-y-6 overflow-hidden">
                {/* Surface Header with Badges */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e2d8c7] text-xs text-[#665e57]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-[#4d4036] bg-[#ebe3d7] px-2.5 py-1 rounded-md">
                      GitHub Issue Preview
                    </span>
                    {selectedDraft.findingId && (
                      <Link
                        href={`/app/findings/${selectedDraft.findingId}`}
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[#7d2e1b] bg-[#f2e6dc] hover:bg-[#e8d7c9] px-2.5 py-1 rounded-md transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-[#943828]" />
                        <span>Evidence #{selectedDraft.findingId}</span>
                      </Link>
                    )}
                    <span className="text-[11px] font-mono text-[#332b26] bg-[#ebe3d7] px-2.5 py-1 rounded-md">
                      {selectedDraft.generatedBy === 'gemini' ? '✦ Gemma 4 Grounded' : 'Deterministic Explanation'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedDraft.labels && selectedDraft.labels.length > 0 && (
                      <div className="flex items-center gap-1 mr-2">
                        {selectedDraft.labels.map((lbl) => (
                          <span
                            key={lbl}
                            className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#dfd4c4] text-[#4d4036]"
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="font-semibold text-rosewood bg-[#f7e6d8] border border-rosewood/30 px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rosewood" />
                      Maintainer review required • Never auto-published
                    </span>
                  </div>
                </div>

                {/* Markdown Rendered Content */}
                <div className="space-y-6 text-xs sm:text-sm leading-relaxed">
                  {selectedDraft.markdownContent.split('\n\n').map((block, idx) => {
                    const trimmed = block.trim();

                    // Main Title
                    if (trimmed.startsWith('# ')) {
                      return (
                        <h1
                          key={idx}
                          className="text-2xl font-bold text-[#141210] border-b border-[#e2d8c7] pb-3 tracking-tight"
                        >
                          {trimmed.replace('# ', '')}
                        </h1>
                      );
                    }

                    // Section Headings (1-7)
                    if (trimmed.startsWith('### ')) {
                      const isReviewNote = trimmed.includes('Maintainer Review Note');
                      return (
                        <h3
                          key={idx}
                          className={`text-base font-bold mt-6 mb-2 flex items-center gap-2 ${
                            isReviewNote ? 'text-rosewood border-t border-[#e2d8c7] pt-4' : 'text-[#3d1810]'
                          }`}
                        >
                          {trimmed.replace('### ', '')}
                        </h3>
                      );
                    }

                    // Maintainer Notice Blockquote
                    if (trimmed.startsWith('> ')) {
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-[#ede3d3] border-l-4 border-rosewood text-[#3d2f25] text-xs space-y-1 my-3 shadow-inner"
                        >
                          {trimmed.split('\n').map((line, lIdx) => (
                            <p key={lIdx} className="leading-relaxed">
                              {line.replace(/^>\s?/, '')}
                            </p>
                          ))}
                        </div>
                      );
                    }

                    // Code Blocks (Evidence)
                    if (trimmed.startsWith('```')) {
                      return (
                        <pre
                          key={idx}
                          className="p-4 bg-[#231e1a] text-lemonChiffon rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all border border-[#3b332c] shadow-md"
                        >
                          {trimmed.replace(/```[a-z]*\n?/g, '').replace(/```/g, '')}
                        </pre>
                      );
                    }

                    // Bullet / Checklist items
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                      return (
                        <ul key={idx} className="space-y-2 pl-2 text-[#332b26]">
                          {trimmed.split('\n').map((li, liIdx) => {
                            const isChecklist = li.includes('- [ ]') || li.includes('- [x]');
                            const isChecked = li.includes('- [x]');
                            const text = li.replace(/^[*-] (\[[ x]\] )?/, '');

                            return (
                              <li key={liIdx} className="flex items-start gap-2">
                                {isChecklist ? (
                                  <span
                                    className={`mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded border ${
                                      isChecked
                                        ? 'bg-rosewood text-cotton border-rosewood'
                                        : 'border-[#8c7e73] bg-[#f4ece0]'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3 h-3 text-cotton" />}
                                  </span>
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#8c7e73] mt-2 shrink-0" />
                                )}
                                <span>{text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      );
                    }

                    // Footer divider
                    if (trimmed === '---') {
                      return <hr key={idx} className="border-[#e2d8c7] my-4" />;
                    }

                    // Standard Paragraph
                    return (
                      <p key={idx} className="text-[#332b26]">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {/* View Mode 3: Raw Markdown */}
            {viewMode === 'raw' && (
              <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-borderDark font-mono text-xs overflow-x-auto text-lemonChiffon/90 bg-black leading-relaxed">
                <pre className="whitespace-pre-wrap break-all select-text">{selectedDraft.markdownContent}</pre>
              </div>
            )}

            {/* Strict Safe Disclosure Policy Card */}
            <div className="p-4 rounded-xl bg-coffeeBean/70 border border-electricTangerine/30 flex items-start gap-3 text-xs text-lemonChiffon">
              <ShieldAlert className="w-5 h-5 text-electricTangerine shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-lemonChiffon block">ContribLens Safe Disclosure Policy</span>
                <p className="text-textMuted mt-0.5">
                  ContribLens never connects directly to GitHub issue or pull request APIs. Maintainers must review and publish issue drafts manually. Secrets, credentials, and sensitive private security disclosures are strictly blocked from public issue generation.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-24 glass-panel rounded-2xl border border-borderDark max-w-lg mx-auto p-8 space-y-4">
          <FileText className="w-12 h-12 text-lemonChiffon/50 mx-auto" />
          <h2 className="text-lg font-heading font-bold text-textPrimary">No Issue Drafts Available</h2>
          <p className="text-xs text-textMuted leading-relaxed">
            Generate your first maintainer-reviewable issue draft from verified findings in the Contributions + Stack view.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/app/findings"
              className="px-5 py-2.5 rounded-full bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-semibold transition-colors shadow-sm"
            >
              Browse Verified Findings →
            </Link>
            <button
              onClick={() => router.push('/app/contributions')}
              className="px-5 py-2.5 rounded-full bg-coffeeBean hover:bg-coffeeBean/80 text-lemonChiffon border border-lemonChiffon/30 text-xs font-semibold transition-colors"
            >
              Browse Contributions
            </button>
            <button
              onClick={() => router.push('/app/scan')}
              className="px-5 py-2.5 rounded-full bg-blackHole hover:bg-black text-textPrimary text-xs font-semibold border border-borderDark transition-colors"
            >
              Scan Repository
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IssueDraftsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-8 text-center text-textMuted">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-lemonChiffon mb-2" />
          <p className="text-xs">Loading Issue Drafts Workspace...</p>
        </div>
      }
    >
      <DraftsContent />
    </Suspense>
  );
}
