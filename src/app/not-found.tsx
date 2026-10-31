import Link from "next/link";
import { Search, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="liquid-glass p-8 max-w-md w-full text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-botticelli/10 border border-botticelli/30 flex items-center justify-center text-botticelli">
          <Search className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-sustainableLinen">
            404 — Page Not Found
          </h2>
          <p className="text-sm text-textMuted mt-2">
            The page or resource you requested does not exist or has been moved.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-lemonChiffon text-black font-semibold text-sm hover:bg-lemonChiffon-hover transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to ContribLens
          </Link>
        </div>
      </div>
    </div>
  );
}
