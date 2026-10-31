/**
 * ContribLens GitHub Fetcher
 * Strictly read-only, bounded file retrieval.
 * NEVER executes code. Respects byte and file boundaries.
 */

export interface GitHubRepoMeta {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  licenseName?: string;
}

export interface BoundedFile {
  path: string;
  size: number;
  content: string;
}

export class GitHubRateLimitError extends Error {
  resetTime?: Date;
  constructor(message: string, resetTime?: Date) {
    super(message);
    this.name = 'GitHubRateLimitError';
    this.resetTime = resetTime;
  }
}

export class GitHubNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubNotFoundError';
  }
}

export class GitHubPrivateOrUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubPrivateOrUnavailableError';
  }
}

export class GitHubBranchNotFoundError extends Error {
  branch: string;
  defaultBranch?: string;
  constructor(message: string, branch: string, defaultBranch?: string) {
    super(message);
    this.name = 'GitHubBranchNotFoundError';
    this.branch = branch;
    this.defaultBranch = defaultBranch;
  }
}

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

export const MAX_FILES = Number(process.env.SCAN_MAX_FILES) || 60;
export const MAX_FILE_SIZE_BYTES = Number(process.env.SCAN_MAX_FILE_BYTES) || 180 * 1024;
export const MAX_TOTAL_BYTES = Number(process.env.SCAN_MAX_TOTAL_BYTES) || 3 * 1024 * 1024;
const MAX_TREE_ENTRIES = Number(process.env.SCAN_MAX_TREE_ENTRIES) || 20000;

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.exe', '.dll',
  '.so', '.dylib', '.bin', '.woff', '.woff2', '.ttf', '.eot',
  '.mp4', '.mp3', '.mov', '.avi', '.lockb', '.wasm', '.jar'
]);

const IGNORED_DIRECTORIES = [
  'node_modules/',
  'vendor/',
  '.git/',
  'dist/',
  'build/',
  '.next/',
  'out/',
  'venv/',
  '.venv/',
  '__pycache__/',
  'target/',
  '.terraform/',
  'coverage/',
];

function isValidGitHubIdentifier(val: string): boolean {
  return /^[a-zA-Z0-9_\-\.]+$/.test(val) && val !== '.' && val !== '..';
}

export function parseGitHubUrl(rawUrl: string): { owner: string; repo: string; branch?: string } | null {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let clean = rawUrl.trim();
    if (!clean) return null;

    // Strip hash and query parameters
    clean = clean.split('#')[0].split('?')[0].trim();
    // Strip trailing slashes
    clean = clean.replace(/\/+$/, '');

    // SSH format: git@github.com:owner/repo(.git)
    if (clean.startsWith('git@github.com:')) {
      clean = clean.replace(/^git@github\.com:/, 'https://github.com/');
    }

    // Shorthand format: owner/repo(.git)
    if (!clean.includes('://') && !clean.includes('github.com')) {
      const parts = clean.split('/');
      if (parts.length === 2) {
        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/i, '');
        if (isValidGitHubIdentifier(owner) && isValidGitHubIdentifier(repo)) {
          return { owner, repo };
        }
      }
      return null;
    }

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }

    const parsed = new URL(clean);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== 'github.com' && hostname !== 'www.github.com') {
      return null;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, '');

    if (!isValidGitHubIdentifier(owner) || !isValidGitHubIdentifier(repo)) {
      return null;
    }

    let branch: string | undefined = undefined;
    if (parts.length >= 4 && (parts[2] === 'tree' || parts[2] === 'blob')) {
      if (parts[2] === 'tree') {
        branch = parts.slice(3).join('/');
      } else if (parts[2] === 'blob') {
        branch = parts[3];
      }
    }

    const result: { owner: string; repo: string; branch?: string } = { owner, repo };
    if (branch) {
      result.branch = branch;
    }
    return result;
  } catch {
    return null;
  }
}

let isOptionalTokenInvalid = false;

export function resetGitHubTokenState(): void {
  isOptionalTokenInvalid = false;
}

export function getSanitizedGitHubToken(): string | null {
  if (isOptionalTokenInvalid) return null;
  const raw = process.env.GITHUB_TOKEN;
  if (!raw || typeof raw !== 'string') return null;
  const token = raw.trim();
  if (
    !token ||
    token === 'your_github_token_here' ||
    token === 'placeholder' ||
    token === 'undefined' ||
    token === 'null' ||
    token.startsWith('ghp_xxxx')
  ) {
    return null;
  }
  return token;
}

export function getGitHubHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ContribLens-OSS-Scanner',
  };
  const token = includeAuth ? getSanitizedGitHubToken() : null;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  return headers;
}

export interface GitHubRequestOptions {
  headers?: HeadersInit;
  timeoutMs?: number;
  skipAuth?: boolean;
}

/**
 * Unified, resilient GitHub API request client.
 * Strictly bounded with timeouts and SSRF host verification.
 * Automatically and safely falls back to unauthenticated public access if the optional
 * GITHUB_TOKEN receives HTTP 401 Bad Credentials.
 */
export async function executeGitHubRequest(
  url: string,
  options: GitHubRequestOptions = {}
): Promise<Response> {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'api.github.com' && hostname !== 'raw.githubusercontent.com') {
    throw new Error(`Untrusted host for GitHub request: ${hostname}`);
  }

  const timeoutMs = options.timeoutMs || 15000;
  const hasToken = !options.skipAuth && Boolean(getSanitizedGitHubToken());
  const headers = options.headers || getGitHubHeaders(!options.skipAuth);

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('aborted')) {
      throw new Error(`GitHub request timed out after ${timeoutMs}ms.`);
    }
    throw new Error(`Network failure connecting to GitHub: ${err.message || 'connection error'}`);
  }

  // Resilient public-data fallback: If authenticated request failed with 401 Bad credentials,
  // the optional GITHUB_TOKEN is invalid. Retry once unauthenticated for public repository access.
  if (response.status === 401 && hasToken) {
    console.warn('[ContribLens Scanner] Optional GITHUB_TOKEN rejected with HTTP 401. Falling back to unauthenticated public access.');
    isOptionalTokenInvalid = true;

    const unauthHeaders = getGitHubHeaders(false);
    try {
      response = await fetch(url, {
        headers: unauthHeaders,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (retryErr: any) {
      if (retryErr.name === 'TimeoutError' || retryErr.message?.includes('timeout')) {
        throw new Error(`GitHub unauthenticated fallback request timed out after ${timeoutMs}ms.`);
      }
      throw new Error(`Network failure during GitHub unauthenticated fallback: ${retryErr.message || 'connection error'}`);
    }
  }

  return response;
}

export async function fetchRepoMetadata(owner: string, repo: string): Promise<GitHubRepoMeta> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const response = await executeGitHubRequest(url);

  if (!response.ok) {
    if (response.status === 401) {
      throw new GitHubAuthError('GitHub API access was denied (HTTP 401).');
    }
    if (response.status === 403 || response.status === 429) {
      const resetHeader = response.headers.get('x-ratelimit-reset');
      const resetTime = resetHeader ? new Date(Number(resetHeader) * 1000) : undefined;
      const resetMsg = resetTime ? ` Rate limit resets at ${resetTime.toLocaleTimeString()} UTC.` : '';
      throw new GitHubRateLimitError(
        `GitHub API rate limit exceeded.${resetMsg} Please configure a read-only GITHUB_TOKEN in your environment or retry later.`,
        resetTime
      );
    }
    if (response.status === 404) {
      throw new GitHubPrivateOrUnavailableError(`Repository "${owner}/${repo}" was not found or is private.`);
    }
    throw new Error(`GitHub API error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  return {
    owner: data.owner?.login || owner,
    repo: data.name || repo,
    defaultBranch: data.default_branch || 'main',
    description: data.description || '',
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    openIssues: data.open_issues_count || 0,
    licenseName: data.license?.spdx_id || data.license?.name,
  };
}

export async function fetchBoundedRepositoryTree(
  owner: string,
  repo: string,
  branch: string,
  defaultBranch?: string,
  scope: 'partial' | 'deep' = 'partial'
): Promise<{ files: BoundedFile[]; totalFilesIndexed: number; totalBytes: number; warnings: string[] }> {
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const response = await executeGitHubRequest(treeUrl);

  if (!response.ok) {
    if (response.status === 401) {
      throw new GitHubAuthError('GitHub API access was denied while loading repository tree.');
    }
    if (response.status === 403 || response.status === 429) {
      const resetHeader = response.headers.get('x-ratelimit-reset');
      const resetTime = resetHeader ? new Date(Number(resetHeader) * 1000) : undefined;
      const resetMsg = resetTime ? ` Rate limit resets at ${resetTime.toLocaleTimeString()} UTC.` : '';
      throw new GitHubRateLimitError(
        `GitHub API rate limit exceeded.${resetMsg} Please configure a read-only GITHUB_TOKEN in your environment or retry later.`,
        resetTime
      );
    }
    if (response.status === 404) {
      const defaultHint = defaultBranch ? ` (default branch: "${defaultBranch}")` : '';
      throw new GitHubBranchNotFoundError(
        `Branch "${branch}" was not found in repository "${owner}/${repo}"${defaultHint}. Please verify the branch name or select the default branch.`,
        branch,
        defaultBranch
      );
    }
    throw new Error(`Failed to load repository tree for branch "${branch}": ${response.statusText || response.status}`);
  }

  const data = await response.json();
  const tree: Array<{ path: string; type: string; size?: number; url: string }> = data.tree || [];
  const warnings: string[] = [];

  if (data.truncated) {
    warnings.push('Repository tree was truncated by GitHub API due to size constraints. Analysis bounded to available entries.');
  }

  if (tree.length > MAX_TREE_ENTRIES) {
    warnings.push(`Repository tree contains ${tree.length} entries, exceeding safe limit of ${MAX_TREE_ENTRIES}. Analysis bounded.`);
  }

  const candidateBlobs = tree.filter((item) => {
    if (item.type !== 'blob') return false;
    const lower = item.path.toLowerCase();
    if (IGNORED_DIRECTORIES.some((d) => lower.includes(d))) return false;
    const ext = '.' + lower.split('.').pop();
    if (BINARY_EXTENSIONS.has(ext)) return false;

    // Partial scope: top-level + src/ + .github/ only (SCANNER_RULES.md §1)
    if (scope === 'partial') {
      const isTopLevel = !lower.includes('/');
      const isWorkflow = lower.startsWith('.github/');
      const isSrc = lower.startsWith('src/');
      if (!isTopLevel && !isWorkflow && !isSrc) return false;
    }

    return true;
  });

  if (candidateBlobs.length > MAX_FILES) {
    const skipped = candidateBlobs.length - MAX_FILES;
    warnings.push(`${skipped} files skipped (size bounds)`);
  }

  // Prioritize configuration, security, CI/CD, and manifest files
  const prioritized = candidateBlobs.sort((a, b) => {
    const priorityFiles = [
      'package.json',
      'requirements.txt',
      'pyproject.toml',
      'pipfile',
      'security.md',
      'contributing.md',
      'readme.md',
      'license',
      '.env.example',
    ];

    const isAPriority = priorityFiles.some((p) => a.path.toLowerCase().includes(p)) || a.path.includes('.github/workflows');
    const isBPriority = priorityFiles.some((p) => b.path.toLowerCase().includes(p)) || b.path.includes('.github/workflows');

    if (isAPriority && !isBPriority) return -1;
    if (!isAPriority && isBPriority) return 1;
    return 0;
  });

  const selectedBlobs = prioritized.slice(0, MAX_FILES);
  const boundedFiles: BoundedFile[] = [];
  let totalBytes = 0;

  for (const blob of selectedBlobs) {
    if (totalBytes >= MAX_TOTAL_BYTES) {
      const remainingSkipped = selectedBlobs.length - boundedFiles.length;
      warnings.push(`${remainingSkipped > 0 ? remainingSkipped : 1} files skipped (size bounds)`);
      break;
    }

    try {
      // Fetch raw content
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${blob.path}`;
      const res = await executeGitHubRequest(rawUrl, {
        headers: { 'User-Agent': 'ContribLens-OSS-Scanner' },
        skipAuth: true,
      });

      if (!res.ok) continue;

      const text = await res.text();
      const fileSize = Buffer.byteLength(text, 'utf-8');

      if (fileSize > MAX_FILE_SIZE_BYTES) {
        // Enforce per-file limit
        const truncated = text.slice(0, MAX_FILE_SIZE_BYTES);
        totalBytes += MAX_FILE_SIZE_BYTES;
        boundedFiles.push({ path: blob.path, size: MAX_FILE_SIZE_BYTES, content: truncated });
        warnings.push(`File "${blob.path}" exceeded 180 KB and was truncated to the bounded limit.`);
      } else {
        totalBytes += fileSize;
        boundedFiles.push({ path: blob.path, size: fileSize, content: text });
      }
    } catch (e) {
      // Non-blocking file fetch error
      continue;
    }
  }

  return {
    files: boundedFiles,
    totalFilesIndexed: candidateBlobs.length,
    totalBytes,
    warnings,
  };
}
