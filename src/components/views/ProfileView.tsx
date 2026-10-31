'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  User as UserIcon,
  Moon,
  Sun,
  Download,
  Trash2,
  LogOut,
  Shield,
  Sliders,
  ChevronDown,
  Lock,
  AlertTriangle,
  Activity,
  Clock,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { ActivityEvent } from '@/types';

const DISCLOSURE_FAQ = [
  {
    q: 'How does the Disclosure Guard protect exposed secrets?',
    a: 'All API keys, GitHub tokens, AWS credentials, and passwords detected during analysis are masked in-memory before database persistence, logs, or AI prompt contexts. When secrets or critical severity findings are identified, public issue draft generation is strictly blocked (DISCLOSURE_BLOCKED 403), and maintainer private disclosure guidance is provided instead.',
  },
  {
    q: 'Does ContribLens execute repository code?',
    a: 'Never. ContribLens performs 100% static, read-only AST and manifest parsing. It never executes repository code, never runs shell scripts, and never executes package manager commands (e.g. npm install, pip install).',
  },
  {
    q: 'Will ContribLens ever auto-publish pull requests or issues?',
    a: 'Strictly never. Operating under the invariant "Code verifies. AI explains. Human approves.", ContribLens requires explicit human approval for any external publication or PR submission. We never auto-create GitHub issues or PRs.',
  },
  {
    q: 'How are vulnerability advisories and CVEs verified?',
    a: 'Vulnerabilities are cross-referenced directly against official OSV.dev schemas and deterministic scanner rules. AI explanations can only interpret verified finding IDs and cannot invent CVEs or manipulate risk ratings.',
  },
  {
    q: 'Where is my repository analysis data stored?',
    a: 'Analysis results are stored ephemerally with zero long-term raw repository caching. You have complete data sovereignty: export your entire history as JSON at any time or purge all records with one click.',
  },
];

export default function ProfileView() {
  const router = useRouter();
  const { user, setUser, updateSettings, showToast, setActiveScan } = useApp();

  const [savingName, setSavingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);

  // Accordion open sections
  const [openSection, setOpenSection] = useState<'profile' | 'appearance' | 'safety' | 'activity' | 'data'>('safety');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (user?.name) {
      setDisplayName(user.name);
    }
  }, [user?.name]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.activities) {
            setActivities(data.activities);
          }
        }
      } catch {}

      try {
        const statusRes = await fetch('/api/integrations/status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setIntegrationStatus(statusData.status);
        }
      } catch {}
    }
    loadData();
  }, []);

  const userSettings = user?.settings;
  const settings = {
    theme: userSettings?.theme || 'black-hole',
    fontSize: userSettings?.fontSize || 'medium',
    fontFamily: userSettings?.fontFamily || 'sans',
    reducedMotion: Boolean(userSettings?.reducedMotion ?? (userSettings as any)?.reduceMotion ?? false),
    strictRedaction: userSettings?.strictRedaction !== false,
    geminiGroundingPolicy: userSettings?.geminiGroundingPolicy !== false,
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        showToast('Profile name updated!', 'success');
      }
    } catch {
      showToast('Failed to update name', 'error');
    } finally {
      setSavingName(false);
    }
  };

  const handleExportData = async () => {
    try {
      const res = await fetch('/api/profile?export=true');
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `contriblens_workspace_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Workspace data exported successfully (.JSON)', 'success');
      }
    } catch {
      showToast('Export failed', 'error');
    }
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' });
      if (res.ok) {
        try {
          localStorage.removeItem('contriblens_active_scan');
        } catch {}
        setActiveScan(null);
        showToast('All scan records and drafts cleared.', 'info');
        setConfirmClear(false);
        router.push('/app/dashboard');
      }
    } catch {
      showToast('Failed to clear data', 'error');
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/profile?account=true', { method: 'DELETE' });
      if (res.ok) {
        try {
          localStorage.removeItem('contriblens_active_scan');
          localStorage.removeItem('contriblens_user_settings');
        } catch {}
        setActiveScan(null);
        setUser(null);
        showToast('Account and associated data deleted permanently.', 'info');
        router.push('/');
      } else {
        showToast('Failed to delete account', 'error');
      }
    } catch {
      showToast('Network error deleting account', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    try {
      localStorage.removeItem('contriblens_active_scan');
    } catch {}
    setActiveScan(null);
    setUser(null);
    showToast('Logged out', 'info');
    router.push('/login');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 bg-black text-textPrimary">
      {/* Header */}
      <div className="pb-6 border-b border-borderDark">
        <h1 className="text-2xl font-heading font-bold text-textPrimary flex items-center gap-2">
          <UserIcon className="w-6 h-6 text-electricTangerine" />
          <span>Profile &amp; Safety Controls</span>
        </h1>
        <p className="text-xs text-textMuted mt-1">
          Safety policies, visual accessibility preferences, live diagnostics, and local data retention settings.
        </p>
      </div>

      {/* Accordion 1: Safety & AI Guardrails + Disclosure FAQ */}
      <div className="glass-panel rounded-2xl border border-borderDark overflow-hidden">
        <button
          onClick={() => setOpenSection(openSection === 'safety' ? ('' as any) : 'safety')}
          className="w-full min-h-[44px] p-6 text-left flex items-center justify-between hover:bg-blackHole/40 transition-colors press-spring touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-coffeeBean flex items-center justify-center text-electricTangerine border border-borderDark">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-heading font-bold text-textPrimary">Safety &amp; Responsible Disclosure Center</h2>
              <span className="text-xs text-textMuted">Secret masking, AI grounding policy, and disclosure FAQ</span>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-botticelli transition-transform ${
              openSection === 'safety' ? 'rotate-180 text-lemonChiffon' : ''
            }`}
          />
        </button>

        {openSection === 'safety' && (
          <div className="p-6 pt-2 border-t border-borderDark space-y-5 text-xs">
            {/* Always ON: Secret Masking */}
            <div className="p-4 rounded-xl bg-black border border-borderDark flex items-center justify-between">
              <div>
                <span className="font-semibold text-textPrimary block">Strict Secret Masking</span>
                <span className="text-textMuted">
                  API tokens, AWS keys, and private keys are masked with asterisks before model calls or database writes.
                </span>
              </div>
              <span className="text-lemonChiffon font-bold px-3 py-1 rounded-full bg-coffeeBean border border-lemonChiffon/30 text-[10px]">
                ALWAYS ON
              </span>
            </div>

            {/* Toggle: Gemini Grounding Policy */}
            <div className="p-4 rounded-xl bg-black border border-borderDark flex items-center justify-between">
              <div>
                <span className="font-semibold text-textPrimary block">Gemini Evidence Grounding Policy</span>
                <span className="text-textMuted">
                  Restricts AI explanations strictly to verified finding IDs with deterministic fallback on failure.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.geminiGroundingPolicy)}
                  onChange={(e) => updateSettings({ geminiGroundingPolicy: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-blackHole peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-cotton after:border-borderDark after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lemonChiffon" />
              </label>
            </div>

            {/* Sensitive Publishing Control */}
            <div className="p-4 rounded-xl bg-coffeeBean/70 border border-borderDark flex items-center justify-between">
              <div>
                <span className="font-semibold text-textPrimary block">Human Review Enforcement</span>
                <span className="text-textMuted">
                  Prohibits automatic PR creation and forces human maintainer review for all issue drafts.
                </span>
              </div>
              <span className="text-electricTangerine font-bold px-3 py-1 rounded-full bg-black border border-electricTangerine/40 text-[10px]">
                ENFORCED
              </span>
            </div>

            {/* Live Integration Status (Safe enum report - No secrets in payload) */}
            {integrationStatus && (
              <div className="p-4 rounded-xl bg-black border border-borderDark space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-textPrimary text-xs block">
                    Verified Integration Status (Diagnostics)
                  </span>
                  <span className="text-[10px] text-textMuted font-mono">Zero secrets exposed</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-blackHole border border-borderDark">
                    <span className="text-[10px] text-textMuted block">Supabase</span>
                    <span
                      className={`text-[11px] font-mono font-bold capitalize ${
                        integrationStatus.supabase === 'configured' ? 'text-lemonChiffon' : 'text-textMuted'
                      }`}
                    >
                      {integrationStatus.supabase}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blackHole border border-borderDark">
                    <span className="text-[10px] text-textMuted block">GitHub API</span>
                    <span
                      className={`text-[11px] font-mono font-bold capitalize ${
                        integrationStatus.github === 'token configured' ? 'text-electricTangerine' : 'text-botticelli'
                      }`}
                    >
                      {integrationStatus.github}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blackHole border border-borderDark">
                    <span className="text-[10px] text-textMuted block">OSV Engine</span>
                    <span
                      className={`text-[11px] font-mono font-bold capitalize ${
                        integrationStatus.osv === 'reachable' ? 'text-emerald-400' : 'text-rosewood'
                      }`}
                    >
                      {integrationStatus.osv}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blackHole border border-borderDark">
                    <span className="text-[10px] text-textMuted block">Gemini AI</span>
                    <span
                      className={`text-[11px] font-mono font-bold capitalize ${
                        integrationStatus.gemini === 'configured' ? 'text-lemonChiffon' : 'text-electricTangerine'
                      }`}
                    >
                      {integrationStatus.gemini}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blackHole border border-borderDark">
                    <span className="text-[10px] text-textMuted block">Persistence DB</span>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      {integrationStatus.database}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Task 3: FAQ-style Disclosure Accordion */}
            <div className="space-y-2 pt-2 border-t border-borderDark">
              <span className="font-heading font-bold text-sustainableLinen text-xs block mb-2 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-electricTangerine" />
                <span>Responsible Disclosure FAQ</span>
              </span>
              <div className="space-y-2">
                {DISCLOSURE_FAQ.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={idx} className="rounded-xl border border-borderDark bg-black overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full min-h-[44px] p-3 text-left flex items-center justify-between text-xs font-semibold text-textPrimary hover:bg-blackHole transition-colors press-spring touch-manipulation"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-botticelli transition-transform shrink-0 ml-2 ${
                            isOpen ? 'rotate-180 text-lemonChiffon' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="p-3 pt-1 text-[11px] text-textMuted border-t border-borderDark/60 leading-relaxed bg-blackHole/40">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Privacy & Safety Center Documentation Links */}
            <div className="pt-2 border-t border-borderDark flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-textMuted">Official Safety &amp; Governance Center:</span>
              <div className="flex items-center gap-4">
                <Link
                  href="/security"
                  className="text-lemonChiffon hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <span>Security Model &amp; Disclosure Policy</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <Link
                  href="/safety"
                  className="text-lemonChiffon hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <span>Safety Guarantees</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <Link
                  href="/privacy"
                  className="text-lemonChiffon hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <span>Privacy Notice</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 2: Profile & Credentials (Account, Email + GitHub connection) */}
      <div className="glass-panel rounded-2xl border border-borderDark overflow-hidden">
        <button
          onClick={() => setOpenSection(openSection === 'profile' ? ('' as any) : 'profile')}
          className="w-full min-h-[44px] p-6 text-left flex items-center justify-between hover:bg-blackHole/40 transition-colors press-spring touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-coffeeBean flex items-center justify-center text-lemonChiffon border border-borderDark">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-heading font-bold text-textPrimary">Account &amp; Credentials</h2>
              <span className="text-xs text-textMuted">Display name, email address, and GitHub connection</span>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-botticelli transition-transform ${
              openSection === 'profile' ? 'rotate-180 text-lemonChiffon' : ''
            }`}
          />
        </button>

        {openSection === 'profile' && (
          <div className="p-6 pt-2 border-t border-borderDark space-y-4">
            <form onSubmit={handleUpdateName} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-textMuted mb-1">Display Name</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={displayName ?? ''}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 min-h-[44px] px-4 py-2 bg-black border border-borderDark rounded-xl text-sm text-textPrimary focus:outline-none focus:border-lemonChiffon"
                  />
                  <button
                    type="submit"
                    disabled={savingName}
                    className="min-h-[44px] px-5 py-2 bg-lemonChiffon hover:bg-sustainableLinen text-black text-xs font-semibold rounded-full transition-colors disabled:opacity-50 press-spring touch-manipulation flex items-center justify-center"
                  >
                    {savingName ? 'Saving...' : 'Save Name'}
                  </button>
                </div>
              </div>

              {/* Task 1: Account (Email + GitHub connection) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-black border border-borderDark space-y-1">
                  <span className="text-textMuted block text-[10px] uppercase font-mono">Email Address</span>
                  <span className="text-textPrimary font-medium font-mono">{user?.email || 'N/A'}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-black border border-borderDark space-y-1">
                  <span className="text-textMuted block text-[10px] uppercase font-mono">GitHub Connection</span>
                  {user?.githubUsername ? (
                    <div className="flex items-center justify-between">
                      <span className="text-lemonChiffon font-mono font-semibold flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 fill-current text-botticelli shrink-0" viewBox="0 0 24 24">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        @{user.githubUsername}
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                        Connected
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-textMuted flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 fill-current text-textMuted shrink-0" viewBox="0 0 24 24">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        Not connected
                      </span>
                      <Link
                        href="/api/auth/oauth/github"
                        className="min-h-[44px] text-xs text-lemonChiffon hover:underline bg-coffeeBean border border-lemonChiffon/30 px-3.5 py-1.5 rounded-full font-mono transition-colors press-spring touch-manipulation inline-flex items-center"
                      >
                        Connect GitHub
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Accordion 3: Appearance & Accessibility (Task 1: theme, font scale, font family, reduce motion) */}
      <div className="glass-panel rounded-2xl border border-borderDark overflow-hidden">
        <button
          onClick={() => setOpenSection(openSection === 'appearance' ? ('' as any) : 'appearance')}
          className="w-full min-h-[44px] p-6 text-left flex items-center justify-between hover:bg-blackHole/40 transition-colors press-spring touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-coffeeBean flex items-center justify-center text-botticelli border border-borderDark">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-heading font-bold text-textPrimary">Appearance &amp; Accessibility</h2>
              <span className="text-xs text-textMuted">Theme (black-hole/linen/system), font scale, font stack, and reduced motion</span>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-botticelli transition-transform ${
              openSection === 'appearance' ? 'rotate-180 text-lemonChiffon' : ''
            }`}
          />
        </button>

        {openSection === 'appearance' && (
          <div className="p-6 pt-2 border-t border-borderDark space-y-6">
            {/* Theme: black-hole / linen / system */}
            <div>
              <label className="block text-xs font-medium text-textMuted mb-2">Theme Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md">
                {[
                  { id: 'black-hole', label: 'Black Hole', sub: 'Dark (Default)', icon: Moon },
                  { id: 'linen', label: 'Sustainable Linen', sub: 'Light Cream', icon: Sun },
                  { id: 'system', label: 'System Match', sub: 'OS Automatic', icon: Sliders },
                ].map((t) => {
                  const Icon = t.icon;
                  const isSelected =
                    settings.theme === t.id ||
                    (t.id === 'black-hole' && settings.theme === 'dark') ||
                    (t.id === 'linen' && settings.theme === 'light');
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateSettings({ theme: t.id as any })}
                      className={`min-h-[44px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-medium transition-all press-spring touch-manipulation ${
                        isSelected
                          ? 'bg-coffeeBean border-lemonChiffon text-lemonChiffon shadow-sm'
                          : 'bg-black border-borderDark text-textMuted hover:text-textPrimary'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-[10px] text-textMuted/70">{t.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Scale: small / medium / large */}
            <div>
              <label className="block text-xs font-medium text-textMuted mb-2">Font Scale</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md">
                {[
                  { id: 'small', label: 'Small (14px)' },
                  { id: 'medium', label: 'Medium (16px)' },
                  { id: 'large', label: 'Large (18px)' },
                ].map((fs) => {
                  const isSelected =
                    settings.fontSize === fs.id ||
                    (fs.id === 'medium' && (settings.fontSize === 'normal' || !settings.fontSize));
                  return (
                    <button
                      key={fs.id}
                      type="button"
                      onClick={() => updateSettings({ fontSize: fs.id as any })}
                      className={`min-h-[44px] py-2 px-3 rounded-full border text-xs font-medium transition-colors press-spring touch-manipulation flex items-center justify-center ${
                        isSelected
                          ? 'bg-lemonChiffon text-black font-semibold shadow-sm'
                          : 'bg-black border-borderDark text-textMuted hover:text-textPrimary'
                      }`}
                    >
                      {fs.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Typography Stack: sans / mono / system */}
            <div>
              <label className="block text-xs font-medium text-textMuted mb-2">Typography Stack</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md">
                {[
                  { id: 'sans', label: 'Inter Sans' },
                  { id: 'mono', label: 'JetBrains Mono' },
                  { id: 'system', label: 'System Native' },
                ].map((ff) => {
                  const isSelected = (settings.fontFamily || 'sans') === ff.id;
                  return (
                    <button
                      key={ff.id}
                      type="button"
                      onClick={() => updateSettings({ fontFamily: ff.id as any })}
                      className={`min-h-[44px] py-2 px-3 rounded-full border text-xs font-medium transition-colors press-spring touch-manipulation flex items-center justify-center ${
                        isSelected
                          ? 'bg-lemonChiffon text-black font-semibold shadow-sm'
                          : 'bg-black border-borderDark text-textMuted hover:text-textPrimary'
                      }`}
                    >
                      {ff.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reduced Motion Toggle */}
            <div className="pt-2">
              <label className="min-h-[44px] flex items-center gap-3 cursor-pointer touch-manipulation">
                <input
                  type="checkbox"
                  checked={Boolean(settings.reducedMotion)}
                  onChange={(e) =>
                    updateSettings({ reducedMotion: e.target.checked, reduceMotion: e.target.checked })
                  }
                  className="w-5 h-5 rounded bg-black border-borderDark text-lemonChiffon focus:ring-lemonChiffon touch-manipulation"
                />
                <div>
                  <span className="text-xs font-semibold text-textPrimary block">
                    Enable Reduced Motion
                  </span>
                  <span className="text-[11px] text-textMuted">
                    Disables ambient float effects, spring animations, and smooth transitions.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 4: Activity History & Audit Trail */}
      <div className="glass-panel rounded-2xl border border-borderDark overflow-hidden">
        <button
          onClick={() => setOpenSection(openSection === 'activity' ? ('' as any) : 'activity')}
          className="w-full min-h-[44px] p-6 text-left flex items-center justify-between hover:bg-blackHole/40 transition-colors press-spring touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-coffeeBean flex items-center justify-center text-electricTangerine border border-borderDark">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-heading font-bold text-textPrimary">Activity History &amp; Audit Trail</h2>
              <span className="text-xs text-textMuted">Local timeline of scans, generated routes, and issue draft exports</span>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-botticelli transition-transform ${
              openSection === 'activity' ? 'rotate-180 text-lemonChiffon' : ''
            }`}
          />
        </button>

        {openSection === 'activity' && (
          <div className="p-6 pt-2 border-t border-borderDark space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-textMuted text-xs">
                <Clock className="w-6 h-6 mx-auto mb-2 text-textMuted/60" />
                <p>No activity recorded yet.</p>
                <p className="text-[11px] text-textMuted/70 mt-1">
                  Run a repository scan or create contribution routes to begin tracking actions.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {activities.map((act) => {
                  const getBadge = (type: string) => {
                    switch (type) {
                      case 'scan':
                        return 'bg-botticelli/20 text-botticelli border-botticelli/30';
                      case 'route_created':
                        return 'bg-lemonChiffon/20 text-lemonChiffon border-lemonChiffon/30';
                      case 'draft_generated':
                        return 'bg-electricTangerine/20 text-electricTangerine border-electricTangerine/30';
                      case 'route_updated':
                      case 'route_completed':
                        return 'bg-sustainableLinen/20 text-sustainableLinen border-sustainableLinen/30';
                      default:
                        return 'bg-coffeeBean text-cotton border-borderDark';
                    }
                  };

                  return (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-xl bg-black border border-borderDark flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-start sm:items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${getBadge(
                            act.type
                          )}`}
                        >
                          {act.type.replace('_', ' ')}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-textPrimary">{act.repoName}</span>
                          </div>
                          <p className="text-[11px] text-textMuted mt-0.5">{act.description}</p>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-textMuted flex items-center gap-1 sm:self-center shrink-0">
                        <Clock className="w-3 h-3 text-textMuted/80" />
                        <span>{new Date(act.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion 5: Workspace Data & Export (Task 3: Botticelli Export + Rosewood Clear) */}
      <div className="glass-panel rounded-2xl border border-borderDark overflow-hidden">
        <button
          onClick={() => setOpenSection(openSection === 'data' ? ('' as any) : 'data')}
          className="w-full min-h-[44px] p-6 text-left flex items-center justify-between hover:bg-blackHole/40 transition-colors press-spring touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-coffeeBean flex items-center justify-center text-rosewood border border-borderDark">
              <Download className="w-5 h-5 text-lemonChiffon" />
            </div>
            <div>
              <h2 className="text-sm font-heading font-bold text-textPrimary">Workspace Data &amp; Export</h2>
              <span className="text-xs text-textMuted">Export scans as JSON, clear database history, or delete account</span>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-botticelli transition-transform ${
              openSection === 'data' ? 'rotate-180 text-lemonChiffon' : ''
            }`}
          />
        </button>

        {openSection === 'data' && (
          <div className="p-6 pt-2 border-t border-borderDark space-y-4">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {/* Task 3: Export All Data (Botticelli) */}
              <button
                onClick={handleExportData}
                className="min-h-[44px] px-5 py-2.5 rounded-full bg-botticelli/15 hover:bg-botticelli/25 text-botticelli border border-botticelli/40 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm press-spring touch-manipulation"
              >
                <Download className="w-4 h-4 text-botticelli" />
                <span>Export All Data (.JSON)</span>
              </button>

              {/* Task 3: Clear History (Rosewood) with Inline Confirm */}
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-full bg-rosewood/30 hover:bg-rosewood/50 text-sustainableLinen text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-rosewood press-spring touch-manipulation"
                >
                  <Trash2 className="w-4 h-4 text-rosewood" />
                  <span>Clear History</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-black border border-rosewood">
                  <span className="text-[11px] text-rosewood font-medium px-2">Wipe history &amp; local cache?</span>
                  <button
                    onClick={handleClearData}
                    disabled={clearing}
                    className="min-h-[44px] px-4 py-1.5 rounded-full bg-rosewood text-cotton text-xs font-semibold transition-colors disabled:opacity-50 press-spring touch-manipulation flex items-center justify-center"
                  >
                    {clearing ? 'Clearing...' : 'Confirm Clear'}
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[44px] px-3 py-1.5 rounded-full bg-black border border-borderDark text-textMuted text-xs hover:text-textPrimary press-spring touch-manipulation flex items-center justify-center"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Delete Account (Rosewood) with Inline Confirm */}
              {!confirmDeleteAccount ? (
                <button
                  onClick={() => setConfirmDeleteAccount(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-full bg-black hover:bg-rosewood/20 text-rosewood text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-rosewood/50 press-spring touch-manipulation"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Delete Account</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-black border border-rosewood">
                  <span className="text-[11px] text-rosewood font-medium px-2">Permanently delete account?</span>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="min-h-[44px] px-4 py-1.5 rounded-full bg-rosewood text-cotton text-xs font-bold transition-colors disabled:opacity-50 press-spring touch-manipulation flex items-center justify-center"
                  >
                    {deletingAccount ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteAccount(false)}
                    className="min-h-[44px] px-3 py-1.5 rounded-full bg-black border border-borderDark text-textMuted text-xs hover:text-textPrimary press-spring touch-manipulation flex items-center justify-center"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-borderDark">
              <button
                onClick={handleLogout}
                className="min-h-[44px] px-5 py-2.5 rounded-full bg-black hover:bg-blackHole text-rosewood border border-rosewood/40 text-xs font-semibold flex items-center gap-2 transition-colors press-spring touch-manipulation"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of ContribLens</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
