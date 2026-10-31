import { z } from "zod";

// Error Codes per API_INTEGRATION.md
export type ContribLensErrorCode =
  | "AUTH_INVALID_INPUT"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_PROVIDER_UNAVAILABLE"
  | "GITHUB_INVALID_URL"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_PRIVATE_OR_UNAVAILABLE"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_BRANCH_NOT_FOUND"
  | "GITHUB_TREE_TRUNCATED"
  | "GITHUB_FILE_LIMIT"
  | "OSV_UNAVAILABLE"
  | "GEMINI_UNAVAILABLE"
  | "GEMINI_INVALID_OUTPUT"
  | "PREVIEW_LIMIT_REACHED"
  | "DISCLOSURE_BLOCKED"
  | "PERSISTENCE_FAILED";

export class AppApiError extends Error {
  code: ContribLensErrorCode;
  errorCode: ContribLensErrorCode;
  statusCode: number;

  constructor(code: ContribLensErrorCode, message: string, statusCode: number = 400) {
    super(message);
    this.name = "AppApiError";
    this.code = code;
    this.errorCode = code;
    this.statusCode = statusCode;
  }
}

// Category & Severity per EVIDENCE_AND_SCHEMAS.md & SCANNER_RULES.md
export type Severity = "critical" | "high" | "medium" | "low" | "info" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type Confidence = "HIGH" | "MEDIUM" | "LOW" | number;

export type FindingCategory =
  | "dependency"
  | "github-actions"
  | "secret"
  | "repository-health"
  | "actions"
  | "health"
  | "code_quality";

export type DisclosureMode =
  | "public-issue"
  | "maintainer-review"
  | "security-disclosure"
  | "PUBLIC_ISSUE_ALLOWED"
  | "MAINTAINER_REVIEW"
  | "DISCLOSURE_BLOCKED";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface LearningResource {
  title: string;
  url: string;
  provider: "MDN" | "freeCodeCamp" | "docs" | "youtube";
}

export type ReadinessLabel =
  | "maintainer-assistance"
  | "intermediate"
  | "beginner-friendly"
  | "good-first-contribution";

export interface ContributionReadiness {
  total: number; // integer 0..100
  label: ReadinessLabel;
  evidenceClarity: number; // 0..25
  scopeSimplicity: number; // 0..20
  testability: number; // 0..20
  skillAccessibility: number; // 0..20
  contextCompleteness: number; // 0..15
  documentationClarity?: number;
  testAvailability?: number;
  ciAutomation?: number;
  dependencyFreshness?: number;
  securityGovernance?: number;
  securityImpact?: number;
  evidenceConfidence?: number;
  difficultyPenalty?: number;
  reasons: string[];
  blockers: string[];
  estimatedMinutes?: number | null;
  difficulty?: Difficulty;
  calculatedBy?: "deterministic-rule-engine";
  calculatorVersion?: string;
}

export type UrgencyLabel = "critical" | "high" | "medium" | "low" | "informational";

export interface FindingTriage {
  findingId: string;
  urgencyScore: number; // 0..100
  urgencyLabel: UrgencyLabel;
  readiness: ContributionReadiness;
}

export interface EvidenceChainStep {
  step: number;
  label: string;
  verifiedBy: "scanner" | "osv" | "gemini" | "human-review";
  detail: string;
  file?: string | null;
  line?: string | null;
  ruleId?: string;
  advisoryId?: string;
  evidenceHash?: string;
  status: "verified" | "unverified" | "needs-review";
}

export interface EvidenceChain {
  findingId: string;
  steps: EvidenceChainStep[];
  source: string;
  ruleId: string;
  advisoryId?: string;
  evidenceHash: string;
  redactedEvidence: string;
  verificationStatus: "verified" | "needs-review";
}

export type FindingDiffStatus = "new" | "unchanged" | "resolved" | "changed" | "needs-review";

export interface FindingDiffItem {
  findingId: string;
  fingerprint: string;
  status: FindingDiffStatus;
  ruleId?: string;
  file?: string | null;
  title?: string;
  category?: FindingCategory;
  severity?: Severity;
  previousSeverity?: Severity;
  notes?: string;
}

export interface ScanComparison {
  currentScanId: string;
  previousScanId: string | null;
  repoName: string;
  branch: string;
  status: 'comparable' | 'comparison_unavailable';
  reason?: string;
  warnings?: string[];
  newCount?: number;
  resolvedCount?: number;
  unchangedCount?: number;
  changedCount?: number;
  needsReviewCount?: number;
  summary: {
    newCount: number;
    resolvedCount: number;
    unchangedCount: number;
    changedCount: number;
    needsReviewCount?: number;
    totalCurrent: number;
    totalPrevious: number;
  };
  diffs: FindingDiffItem[];
}

export interface SkillGapItem {
  id: string;
  concept: string;
  level: Difficulty;
  whyNeeded: string;
  estimatedMinutes: number;
  completed?: boolean;
}

export type ExplanationMode = 'beginner' | 'developer' | 'maintainer';

export interface ExplanationModes {
  beginner: string;
  developer: string;
  maintainer: string;
}

export interface FindingEvidence {
  id: string; // stable: rule + scan + location
  scanId: string;
  category: FindingCategory;
  ruleId: string; // maps to SCANNER_RULES.md
  title: string;
  severity: Severity; // deterministic — AI cannot change
  confidence: number | "HIGH" | "MEDIUM" | "LOW";
  sourceTool: string;
  file: string | null; // repo-relative normalized path
  lineStart?: number | null; // 1-based
  lineEnd?: number | null;
  evidence?: string; // REDACTED only — never raw secrets
  impact: string;
  fixHint: string;
  skills: string[]; // what you learn fixing this
  learningResources: LearningResource[];
  contributorLevelImpact?: number;
  disclosureMode: DisclosureMode;
  redacted: boolean;
  evidenceHash: string; // SHA-256 of normalized redacted evidence
  fingerprint: string; // stable diff key (rule + path + evidence core)
  createdAt: string;

  // Extra rich triage & UI fields
  readiness?: ContributionReadiness;
  urgencyScore?: number;
  urgencyLabel?: UrgencyLabel;
  diffStatus?: FindingDiffStatus;
  evidenceChain?: EvidenceChain;
  explanationModes?: ExplanationModes;
  line?: number;
  redactedEvidence?: string;
  routeCreated?: boolean;
  routeId?: string;
  reviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  status?: 'open' | 'resolved' | string;
}

export type Finding = FindingEvidence;

export interface TechnologySignal {
  name: string;
  confidence: number;
  sources: string[];
}

export interface ManifestSignal {
  type:
    | "package.json"
    | "package-lock.json"
    | "yarn.lock"
    | "pnpm-lock.yaml"
    | "requirements.txt"
    | "pyproject.toml"
    | "workflow"
    | "other";
  file: string;
  present: boolean;
}

export interface TechnologySnapshot {
  languages: TechnologySignal[];
  frameworks: TechnologySignal[];
  tooling: TechnologySignal[];
  manifests: ManifestSignal[];
}

export interface ManifestInfo {
  path: string;
  type: "npm" | "pip" | "poetry" | "cargo" | "go_mod" | "other";
  dependenciesCount: number;
}

export interface PackageManagerInfo {
  name: string;
  version?: string;
  lockfile?: string | null;
  status: "detected" | "inferred";
  source: string;
  confidence: number;
}

export interface DirectDependency {
  name: string;
  version?: string;
  type: "production" | "dev" | "peer";
  sourceFile: string;
}

export interface TechStack {
  languages: { name: string; percentage: number; filesCount: number; sources?: string[]; confidence?: number }[];
  frameworks: { name: string; category: string; version?: string; sources?: string[]; confidence?: number }[];
  tooling: { name: string; category: string; sources?: string[]; confidence?: number }[];
  manifests: ManifestInfo[];
  confidenceScore: number;
  packageManagers?: PackageManagerInfo[];
  dependencies?: DirectDependency[];
}

export interface ContributionRoute {
  id: string;
  scanId: string;
  findingIds: string[];
  findingId?: string; // Backward compatibility
  title: string;
  summary: string;
  category?: FindingCategory;
  difficulty: Difficulty;
  estimatedMinutes: number;
  estimatedEffort?: string;
  skills: string[];
  learningResources?: LearningResource[];
  contributorLevelImpact?: number;
  files: string[];
  suggestedChange: string;
  testPlan: string[];
  acceptanceCriteria: string[];
  readiness: {
    documentationClarity?: number;
    testAvailability?: number;
    ciAutomation?: number;
    dependencyFreshness?: number;
    securityGovernance?: number;
    securityImpact?: number;
    evidenceConfidence?: number;
    difficultyPenalty?: number;
    total: number;
  } | ContributionReadiness;
  contributionReadiness?: ContributionReadiness;
  readinessLabel?: ReadinessLabel;
  urgencyScore?: number;
  urgencyLabel?: UrgencyLabel;
  readinessScore?: number;
  status: "not-started" | "in-progress" | "needs-review" | "completed" | "open" | "in_progress";
  draftId?: string;
  generatedBy?: "gemma" | "gemini" | "deterministic";
  fallback?: boolean;
  fallbackReason?: string;
  whatHappened?: string;
  whyItMatters?: string;
  howToFix?: string;
  learningChecklist?: SkillGapItem[];
  evidenceChain?: EvidenceChain;
  explanationModes?: ExplanationModes;
  createdAt?: string;
}

export interface IssueDraft {
  id: string;
  userId?: string;
  routeId?: string;
  findingId?: string;
  scanId: string;
  repoUrl?: string;
  repoName: string;
  title: string;
  body?: string;
  markdownContent: string;
  labels?: string[];
  status?: "draft" | "reviewed" | "exported";
  generatedBy: "gemma" | "gemini" | "deterministic";
  fallback?: boolean;
  fallbackReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TechnologyRecord {
  id: string;
  scanId: string;
  name: string;
  category: string;
  version?: string;
  confidence: number;
  sourceFile?: string;
  createdAt: string;
}

export interface IntegrationStatus {
  supabase: "configured" | "not configured" | "connection failed";
  github: "token configured" | "public-only mode";
  osv: "reachable" | "unavailable";
  gemini: "configured" | "fallback mode";
  database: "reachable" | "unavailable";
}

export interface ScanSummary {
  id: string;
  userId?: string;
  repositoryId?: string;
  repoUrl: string;
  repositoryUrl?: string;
  repoName: string;
  name?: string;
  owner: string;
  fullName?: string;
  branch: string;
  ref?: string;
  commitSha?: string | null;
  scope?: "partial" | "deep";
  scannedAt: string;
  createdAt?: string;
  totalFiles: number;
  filesScanned?: number;
  totalBytes: number;
  bytesScanned?: number;
  filesSkipped?: number;
  status: "scanning" | "running" | "completed" | "complete" | "complete_with_warnings" | "failed";
  errorCode?: ContribLensErrorCode | null;
  readinessScore: number;
  techStack: TechStack;
  technologies?: TechnologySnapshot;
  health?: {
    hasLicense: boolean;
    hasSecurityPolicy: boolean;
    hasContributing: boolean;
    hasReadme: boolean;
    hasTests: boolean;
  };
  warnings?: string[];
  findings?: FindingEvidence[];
  findingsCount: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  goodFirstCount?: number;
  maintainerLevelCount?: number;
  resolvedCount?: number;
  comparison?: ScanComparison;
  learningResources?: LearningResource[];
  contributorLevelImpact?: number;
}

export interface ScanResult extends ScanSummary {
  findings: FindingEvidence[];
  warnings: string[];
  fullName: string;
  ref: string;
  filesScanned: number;
  filesSkipped: number;
}

export interface UserSettings {
  theme: "dark" | "light" | "system" | "black-hole" | "linen";
  fontSize?: "compact" | "normal" | "comfortable" | "small" | "medium" | "large";
  fontFamily?: "sans" | "mono" | "system" | "inter" | "manrope" | "grotesk";
  reducedMotion?: boolean;
  reduceMotion?: boolean;
  strictRedaction?: boolean;
  geminiGroundingPolicy?: boolean;
  aiExplanations?: boolean;
  saveScanHistory?: boolean;
}

export type UserPreferences = UserSettings;

export interface User {
  id: string;
  email: string;
  phone?: string;
  name: string;
  displayName?: string;
  role?: "contributor" | "maintainer";
  passwordHash?: string;
  githubId?: string | null;
  githubUsername?: string | null;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  createdAt: string;
  settings?: UserSettings;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  githubId: string | null;
  githubUsername: string | null;
  bio: string | null;
  experienceLevel: Difficulty;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  type:
    | "scan"
    | "finding_explained"
    | "route_created"
    | "draft_generated"
    | "route_completed"
    | "route_updated"
    | "finding_reviewed";
  repoName: string;
  description: string;
  timestamp: string;
}

export interface AIPlanRequest {
  operation: "explain" | "route" | "issue" | "summary";
  scanId: string;
  findingIds: string[];
  evidence: FindingEvidence[];
  technologies: TechnologySnapshot;
  outputLanguage: "en";
  model: "gemma-4-31b-it" | "gemini-2.5-flash";
}

export type GeminiPlanRequest = AIPlanRequest;

export interface AIPlanResponse {
  findingIds: string[];
  explanation: string;
  whatHappened?: string;
  whyItMatters?: string;
  howToFix?: string;
  priorityReason: string;
  taskTitle: string;
  taskSummary: string;
  difficulty: Difficulty;
  skills: string[];
  files: string[];
  testPlan: string[];
  acceptanceCriteria: string[];
  unsupportedClaims: string[];
  issueMarkdown: string | null;
  modelUsed: "gemma-4-31b-it" | "gemini-2.5-flash" | "deterministic";
}

export type GeminiPlanResponse = AIPlanResponse;

export interface RepositoryTechContext {
  primaryLanguage?: string;
  languages: string[];
  frameworks: string[];
  packageManager?: string;
  manifests: string[];
  tooling: string[];
}

export interface GroundedExplanation {
  findingId: string;
  explanation: string;
  whatHappened?: string;
  whyItMatters?: string;
  howToFix?: string;
  riskContext: string;
  recommendedFix: string;
  skillsNeeded: string[];
  estimatedEffort: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  generatedBy: "gemma" | "gemini" | "deterministic";
  fallback?: boolean;
  fallbackReason?: string;
  repositoryContext?: RepositoryTechContext;
}

// Zod Schemas
export const LearningResourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  provider: z.enum(["MDN", "freeCodeCamp", "docs", "youtube"]),
});

export const FindingEvidenceSchema = z.object({
  id: z.string(),
  scanId: z.string(),
  category: z.enum(["dependency", "github-actions", "secret", "repository-health", "actions", "health", "code_quality"]),
  ruleId: z.string(),
  title: z.string(),
  severity: z.enum(["critical", "high", "medium", "low", "info", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
  confidence: z.union([z.number(), z.enum(["HIGH", "MEDIUM", "LOW"])]),
  sourceTool: z.string(),
  file: z.string().nullable(),
  lineStart: z.number().nullable().optional(),
  lineEnd: z.number().nullable().optional(),
  evidence: z.string().optional(),
  impact: z.string(),
  fixHint: z.string(),
  skills: z.array(z.string()),
  learningResources: z.array(LearningResourceSchema),
  contributorLevelImpact: z.number().optional(),
  disclosureMode: z.enum([
    "public-issue",
    "maintainer-review",
    "security-disclosure",
    "PUBLIC_ISSUE_ALLOWED",
    "MAINTAINER_REVIEW",
    "DISCLOSURE_BLOCKED",
  ]),
  redacted: z.boolean(),
  evidenceHash: z.string(),
  fingerprint: z.string(),
  createdAt: z.string(),
});

export const AIPlanResponseSchema = z.object({
  findingIds: z.array(z.string()),
  explanation: z.string(),
  whatHappened: z.string().optional(),
  whyItMatters: z.string().optional(),
  howToFix: z.string().optional(),
  priorityReason: z.string(),
  taskTitle: z.string(),
  taskSummary: z.string(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  skills: z.array(z.string()),
  files: z.array(z.string()),
  testPlan: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  unsupportedClaims: z.array(z.string()),
  issueMarkdown: z.string().nullable(),
  modelUsed: z.enum(["gemma-4-31b-it", "gemini-2.5-flash", "deterministic"]),
});

export const ScanRequestSchema = z.object({
  repositoryUrl: z.string().url(),
  ref: z.string().optional().default("main"),
  scope: z.enum(["partial", "deep"]).optional().default("partial"),
});
