"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ContribLensLogo from "@/components/ContribLensLogo";
import { calculatePasswordStrength } from "@/lib/password";
import { ArrowLeft, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

type AuthState = "idle" | "focused" | "invalid" | "submitting" | "success" | "server-error";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = calculatePasswordStrength(password);

  const getNextRedirect = useCallback(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        return next;
      }
    }
    return "/app/dashboard";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (!email.trim() || !password) {
      setAuthState("invalid");
      setError("Please complete all required fields.");
      return;
    }

    if (password !== passwordConfirmation) {
      setAuthState("invalid");
      setError("Password confirmation does not match.");
      return;
    }

    if (password.length < 8) {
      setAuthState("invalid");
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!acceptedTerms) {
      setAuthState("invalid");
      setError("Please accept the terms of service and privacy notice to continue.");
      return;
    }

    setAuthState("submitting");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          passwordConfirmation,
          acceptedTerms,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setAuthState("invalid");
        setError(data.error || "Unable to create account. Please verify your details.");
        return;
      }

      setAuthState("success");
      const destination = getNextRedirect();
      router.push(destination);
      router.refresh();
    } catch {
      setAuthState("server-error");
      const refId = "ERR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      setError(`Unable to connect to authentication service (Ref: ${refId}). Please check your connection and retry.`);
    }
  };

  const handleGitHubOAuth = async () => {
    setOauthLoading(true);
    setError(null);
    try {
      const destination = getNextRedirect();
      const supabase = getSupabaseBrowserClient();

      if (supabase && isSupabaseConfigured()) {
        const { error: sbError } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
          },
        });
        if (sbError) {
          throw sbError;
        }
        return;
      }

      // Fallback for local zero-config / simulated environment
      const res = await fetch("/api/auth/oauth/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "mock_code" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAuthState("success");
        router.push(destination);
        router.refresh();
      } else {
        setAuthState("server-error");
        setError("GitHub OAuth account setup failed. Please retry.");
        setOauthLoading(false);
      }
    } catch (err: any) {
      setAuthState("server-error");
      const refId = "ERR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      setError(err?.message || `Unable to complete GitHub sign-in (Ref: ${refId}). Please retry.`);
      setOauthLoading(false);
    }
  };

  const isSubmitting = authState === "submitting" || oauthLoading;

  return (
    <div className="min-h-screen bg-black text-textPrimary flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden page-atmosphere">
      {/* Orange ambient top glow (capped blur <= 40px for mobile GPU budget) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-electricTangerine/15 blur-[40px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-textMuted hover:text-sustainableLinen transition-colors mb-4 press-spring"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
          <div className="flex justify-center">
            <ContribLensLogo size={36} />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-sustainableLinen tracking-tight">
            Create your ContribLens account
          </h1>
          <p className="text-xs text-textMuted">
            Save verified scan histories and track your pull request learning progress
          </p>
        </div>

        {/* Centered Floating Glass Panel */}
        <div className="glass-panel p-6 sm:p-8 space-y-6 border border-platinumSilver/25 rounded-2xl shadow-2xl relative">
          {/* Inline Error Alert */}
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rosewood/20 border border-rosewood/40 text-xs text-sustainableLinen flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 text-electricTangerine shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {authState === "success" && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-sustainableLinen flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Account created successfully. Redirecting...</span>
            </div>
          )}

          {/* GitHub One-Click OAuth (Glass with Platinum Silver rim) */}
          <button
            type="button"
            onClick={handleGitHubOAuth}
            disabled={isSubmitting}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-platinumSilver/25 hover:border-platinumSilver/40 text-sustainableLinen text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all press-spring disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lemonChiffon/60"
          >
            <svg className="w-4 h-4 fill-current text-sustainableLinen shrink-0" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>{oauthLoading ? "Connecting to GitHub..." : "Continue with GitHub"}</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-platinumSilver/15 w-full" />
            <span className="bg-blackHole px-3 text-[10px] font-mono uppercase text-textMuted/70 absolute rounded-full">
              or sign up with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="text-xs font-medium text-sustainableLinen">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-textMuted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onFocus={() => setAuthState("focused")}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contributor@example.com"
                  className="w-full min-h-[44px] bg-black/60 border border-platinumSilver/20 focus:border-lemonChiffon/60 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-sustainableLinen placeholder:text-textMuted/40 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="text-xs font-medium text-sustainableLinen">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-textMuted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="signup-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onFocus={() => setAuthState("focused")}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full min-h-[44px] bg-black/60 border border-platinumSilver/20 focus:border-lemonChiffon/60 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-sustainableLinen placeholder:text-textMuted/40 focus:outline-none transition-colors"
                />
              </div>

              {/* Password strength meter */}
              {password && (
                <div className="pt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-textMuted">Password Strength:</span>
                    <span
                      className={
                        strength.score >= 3
                          ? "text-emerald-400 font-bold"
                          : strength.score === 2
                          ? "text-lemonChiffon font-bold"
                          : "text-rosewood font-bold"
                      }
                    >
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`rounded-full transition-colors ${
                          strength.score >= step
                            ? strength.score >= 3
                              ? "bg-emerald-400"
                              : strength.score === 2
                              ? "bg-lemonChiffon"
                              : "bg-rosewood"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-textMuted/70 font-mono">
                    Minimum 8 characters with numbers and symbols
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-confirm-password" className="text-xs font-medium text-sustainableLinen">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-textMuted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="signup-confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onFocus={() => setAuthState("focused")}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full min-h-[44px] bg-black/60 border border-platinumSilver/20 focus:border-lemonChiffon/60 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-sustainableLinen placeholder:text-textMuted/40 focus:outline-none transition-colors"
                />
              </div>
              {passwordConfirmation && password !== passwordConfirmation && (
                <p className="text-[11px] text-rosewood font-medium flex items-center gap-1 pt-0.5">
                  <AlertCircle className="w-3 h-3" />
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Terms Consent Checkbox (44px min tap area) */}
            <label className="flex items-start gap-3 pt-1 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-platinumSilver/30 bg-black/60 text-electricTangerine focus:ring-0 focus:outline-none cursor-pointer"
              />
              <span className="text-xs text-textMuted leading-relaxed">
                I agree to the{" "}
                <Link href="/privacy" className="text-lemonChiffon hover:underline font-medium">
                  Privacy Notice
                </Link>{" "}
                and the responsible open source disclosure policy.
              </span>
            </label>

            {/* Primary Submit (Tangerine button) */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-electricTangerine text-black font-bold text-xs sm:text-sm hover:bg-electricTangerine-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow-tangerine press-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electricTangerine"
            >
              <span>{authState === "submitting" ? "Creating account..." : "Create free account"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-textMuted border-t border-platinumSilver/15">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-lemonChiffon hover:underline font-semibold press-spring ml-1"
            >
              Log in →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
