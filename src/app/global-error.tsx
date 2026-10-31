"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-textPrimary min-h-screen flex items-center justify-center p-6">
        <div className="bg-blackHole border border-white/10 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-rosewood/30 border border-rosewood flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-electricTangerine" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-sustainableLinen">
              System Error
            </h2>
            <p className="text-sm text-textMuted mt-2">
              A critical failure occurred. Please refresh or retry.
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-full bg-electricTangerine text-black font-semibold text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reload application
          </button>
        </div>
      </body>
    </html>
  );
}
