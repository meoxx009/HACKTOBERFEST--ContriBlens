"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log safe error summary
    console.error("ContribLens Application Error:", error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="liquid-glass p-8 max-w-md w-full text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-rosewood/30 border border-rosewood flex items-center justify-center text-rosewood">
          <AlertCircle className="w-7 h-7 text-electricTangerine" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-sustainableLinen">
            Something went wrong
          </h2>
          <p className="text-sm text-textMuted mt-2">
            An unexpected error occurred. No security data was compromised.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-full bg-electricTangerine text-black font-medium text-sm flex items-center gap-2 hover:bg-electricTangerine-hover transition-colors shadow-glow-tangerine"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-full bg-blackHole border border-platinumSilver/20 text-sustainableLinen font-medium text-sm flex items-center gap-2 hover:bg-white/5 transition-colors"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
