'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { User, UserSettings, ScanSummary } from '@/types';
import { reconcileActiveScan } from '@/lib/dashboard-sync';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  activeScan: ScanSummary | null;
  setActiveScan: (scan: ScanSummary | null) => void;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  refreshUser: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function applySettingsToDom(settings?: UserSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const theme = settings?.theme || 'black-hole';
  root.classList.remove('theme-black-hole', 'theme-linen', 'theme-system', 'dark');
  if (theme === 'black-hole' || theme === 'dark') {
    root.classList.add('dark', 'theme-black-hole');
  } else if (theme === 'linen' || theme === 'light') {
    root.classList.add('theme-linen');
  } else {
    // system
    root.classList.add('theme-system');
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
  }

  // Font size: small/medium/large (also supports compact/normal/comfortable)
  root.classList.remove('text-sm-mode', 'text-base-mode', 'text-lg-mode');
  if (settings?.fontSize === 'small' || settings?.fontSize === 'compact') {
    root.classList.add('text-sm-mode');
  } else if (settings?.fontSize === 'large' || settings?.fontSize === 'comfortable') {
    root.classList.add('text-lg-mode');
  } else {
    root.classList.add('text-base-mode');
  }

  // Font family
  root.classList.remove('font-sans-mode', 'font-system-mode', 'font-mono-mode');
  if (settings?.fontFamily === 'mono') {
    root.classList.add('font-mono-mode');
  } else if (settings?.fontFamily === 'system') {
    root.classList.add('font-system-mode');
  } else {
    root.classList.add('font-sans-mode');
  }

  // Reduced motion
  if (settings?.reducedMotion || (settings as any)?.reduceMotion) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeScan, setActiveScan] = useState<ScanSummary | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const protectedPrefixes = ['/app', '/dashboard', '/scan', '/findings', '/contributions', '/drafts', '/issue-drafts', '/profile'];
    const isProtected = protectedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
    );
    if (isProtected && !user) {
      const fullPath = pathname + (typeof window !== 'undefined' ? window.location.search : '');
      router.push(`/login?next=${encodeURIComponent(fullPath)}`);
    }
  }, [loading, user, pathname, router]);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        applySettingsToDom(data.user?.settings);
        if (data.user?.settings) {
          try {
            localStorage.setItem('contriblens_user_settings', JSON.stringify(data.user.settings));
          } catch {}
        }

        // Authoritative reconciliation: activeScan (localStorage) never contradicts server state
        if (data.user) {
          try {
            const scansRes = await fetch('/api/scans', { cache: 'no-store' });
            if (scansRes.ok) {
              const scansData = await scansRes.json();
              const serverScans: ScanSummary[] = scansData.scans || [];
              const savedScanRaw = typeof window !== 'undefined' ? localStorage.getItem('contriblens_active_scan') : null;
              const savedScan: ScanSummary | null = savedScanRaw ? JSON.parse(savedScanRaw) : null;
              const reconciled = reconcileActiveScan(serverScans, savedScan);
              handleSetActiveScan(reconciled);
            }
          } catch {}
        }
      } else {
        setUser(null);
        try {
          const localSettings = localStorage.getItem('contriblens_user_settings');
          if (localSettings) {
            applySettingsToDom(JSON.parse(localSettings));
          }
        } catch {}
      }
    } catch {
      setUser(null);
      try {
        const localSettings = localStorage.getItem('contriblens_user_settings');
        if (localSettings) {
          applySettingsToDom(JSON.parse(localSettings));
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    // Load last active scan from local storage if available
    try {
      const savedScan = localStorage.getItem('contriblens_active_scan');
      if (savedScan) {
        setActiveScan(JSON.parse(savedScan));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetActiveScan = (scan: ScanSummary | null) => {
    setActiveScan(scan);
    if (scan) {
      try {
        localStorage.setItem('contriblens_active_scan', JSON.stringify(scan));
      } catch {}
    } else {
      localStorage.removeItem('contriblens_active_scan');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const currentSettings: Partial<UserSettings> = user?.settings || {};
    const updated: UserSettings = {
      theme: currentSettings.theme || 'black-hole',
      ...currentSettings,
      ...newSettings,
    };
    applySettingsToDom(updated);
    try {
      localStorage.setItem('contriblens_user_settings', JSON.stringify(updated));
    } catch {}

    if (!user) {
      showToast('Settings updated', 'info');
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        showToast('Settings saved successfully', 'success');
      }
    } catch {
      showToast('Failed to save settings to server', 'error');
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        setUser,
        activeScan,
        setActiveScan: handleSetActiveScan,
        toasts,
        showToast,
        removeToast,
        refreshUser,
        updateSettings,
      }}
    >
      {children}

      {/* Global Toast Notifications Container (z-[60] strictly above z-40 floating capsule nav & respecting safe-area-inset-bottom) */}
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] left-[max(1rem,env(safe-area-inset-left))] sm:left-auto z-[60] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-2xl text-sm border font-medium transition-all duration-200 glass-card ${
              toast.type === 'success'
                ? 'bg-coffeeBean text-lemonChiffon border-electricTangerine/60'
                : toast.type === 'error'
                ? 'bg-rosewood text-recycledCotton border-rosewood/60'
                : 'bg-coffeeBean text-sustainableLinen border-botticelli/30'
            }`}
          >
            <span className="text-xs sm:text-sm leading-snug">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 min-w-[44px] min-h-[44px] -my-2 -mr-2 flex items-center justify-center text-botticelli hover:text-sustainableLinen text-xs press-spring touch-manipulation"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
