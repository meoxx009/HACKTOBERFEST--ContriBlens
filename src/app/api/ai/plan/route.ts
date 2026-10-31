import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  generateGroundedPlan,
  buildGeminiPlanRequest,
  explainFinding,
  buildContributionRoute,
  createIssueDraft,
  generateRepositorySummary,
  checkUserAIDailyLimit,
  recordUserAICall,
  PROMPT_VERSION,
  MAX_AI_REQUEST_BYTES,
} from '@/lib/gemini';
import type { Finding } from '@/types';

export async function POST(req: Request) {
  try {
    // 1. Request size limit guard
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_AI_REQUEST_BYTES) {
      return NextResponse.json(
        {
          error: `Request body exceeds maximum size of ${MAX_AI_REQUEST_BYTES} bytes.`,
          errorCode: 'AUTH_INVALID_INPUT',
          ok: false,
        },
        { status: 400 }
      );
    }

    // 2. Authenticate user
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to generate AI plans.', errorCode: 'AUTH_INVALID_CREDENTIALS', ok: false },
        { status: 401 }
      );
    }

    // 3. Per-user daily quota verification
    const dailyQuota = checkUserAIDailyLimit(user.id);

    const body = await req.json();
    const rawOperation = (body.operation || 'all').toLowerCase();
    const validOperations = ['explain', 'route', 'issue', 'summary', 'all'];

    if (!validOperations.includes(rawOperation)) {
      return NextResponse.json(
        {
          error: `Invalid operation "${rawOperation}". Supported operations: explain, route, issue, summary.`,
          errorCode: 'AUTH_INVALID_INPUT',
          ok: false,
        },
        { status: 400 }
      );
    }

    const operation = rawOperation as 'explain' | 'route' | 'issue' | 'summary' | 'all';
    const scanId = body.scanId;

    if (!scanId || typeof scanId !== 'string') {
      return NextResponse.json(
        { error: 'scanId is required.', errorCode: 'AUTH_INVALID_INPUT', ok: false },
        { status: 400 }
      );
    }

    // 4. Verify scan ownership in database
    const scan = db.getScanById(scanId);
    if (!scan) {
      return NextResponse.json(
        { error: 'Scan record not found.', errorCode: 'GITHUB_NOT_FOUND', ok: false },
        { status: 404 }
      );
    }

    if (scan.userId && scan.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to scan.', errorCode: 'AUTH_INVALID_CREDENTIALS', ok: false },
        { status: 403 }
      );
    }

    // Track user call quota
    recordUserAICall(user.id);

    // Operation: Summary
    if (operation === 'summary') {
      const summary = await generateRepositorySummary(scan);
      return NextResponse.json({
        ok: true,
        operation: 'summary',
        summary,
        promptVersion: PROMPT_VERSION,
        fallback: summary.fallback ?? summary.generatedBy === 'deterministic',
        fallbackReason: summary.fallbackReason,
        dailyRemaining: dailyQuota.remaining,
        engineUsed: summary.generatedBy,
        modelUsed: summary.generatedBy,
      });
    }

    // For explain, route, issue, or all: resolve verified findings strictly from DB
    const rawFindingIds = body.findingIds || (body.findingId ? [body.findingId] : []);
    const findingIds: string[] = Array.isArray(rawFindingIds) ? rawFindingIds : [];

    if (findingIds.length === 0) {
      return NextResponse.json(
        { error: 'findingIds or findingId is required for this operation.', errorCode: 'AUTH_INVALID_INPUT', ok: false },
        { status: 400 }
      );
    }

    const targetFindings: Finding[] = [];
    for (const fId of findingIds) {
      const found = db.getFindingById(fId);
      if (!found || found.scanId !== scan.id) {
        return NextResponse.json(
          { error: `Unknown finding ID: "${fId}".`, errorCode: 'GITHUB_NOT_FOUND', ok: false },
          { status: 404 }
        );
      }
      targetFindings.push(found);
    }

    const primaryFinding = targetFindings[0];

    // Security Guard: Secrets and security-disclosure findings cannot produce public issue drafts
    if (operation === 'issue') {
      const hasRestrictedFinding = targetFindings.some(
        (f) => f.disclosureMode === 'security-disclosure' || f.category === 'secret'
      );
      if (hasRestrictedFinding) {
        return NextResponse.json(
          {
            error:
              'Public issue draft generation is strictly blocked for secrets and sensitive security findings. Please follow responsible private security disclosure guidance.',
            errorCode: 'DISCLOSURE_BLOCKED',
            guidance:
              'Notify the repository maintainer privately via their SECURITY.md policy, security email, or GitHub Private Vulnerability Reporting.',
            ok: false,
          },
          { status: 403 }
        );
      }
    }

    // Build minimal defensive evidence bundle
    const planRequest = buildGeminiPlanRequest(
      scan.id,
      targetFindings.map((f) => f.id),
      targetFindings,
      scan.technologies || (scan.techStack as any),
      operation === 'all' ? 'route' : operation
    );

    // Execute grounded plan generation with timeout and safety validation
    const plan = await generateGroundedPlan(planRequest, {
      expectedSeverity: primaryFinding.severity,
    });

    // Operation: Explain
    if (operation === 'explain') {
      const explanation = await explainFinding(primaryFinding, scan);
      return NextResponse.json({
        ok: true,
        operation: 'explain',
        plan,
        explanation,
        promptVersion: PROMPT_VERSION,
        fallback: plan.fallback ?? plan.generatedBy === 'deterministic',
        fallbackReason: plan.fallbackReason,
        dailyRemaining: dailyQuota.remaining,
        engineUsed: plan.modelUsed || plan.generatedBy,
        modelUsed: plan.modelUsed || plan.generatedBy,
      });
    }

    // Operation: Route
    if (operation === 'route') {
      const route = await buildContributionRoute(primaryFinding, scan);
      db.saveRoute(route);
      return NextResponse.json({
        ok: true,
        operation: 'route',
        plan,
        route,
        promptVersion: PROMPT_VERSION,
        fallback: plan.fallback ?? plan.generatedBy === 'deterministic',
        fallbackReason: plan.fallbackReason,
        dailyRemaining: dailyQuota.remaining,
        engineUsed: plan.modelUsed || plan.generatedBy,
        modelUsed: plan.modelUsed || plan.generatedBy,
      });
    }

    // Operation: Issue
    if (operation === 'issue') {
      const route = await buildContributionRoute(primaryFinding, scan);
      const draft = await createIssueDraft(route, primaryFinding, scan);
      db.saveDraft(draft);

      db.logActivity({
        userId: user.id,
        type: 'draft_generated',
        repoName: scan.repoName,
        description: `Generated maintainer-reviewable issue draft "${draft.title}" via ${draft.generatedBy.toUpperCase()}`,
      });

      return NextResponse.json({
        ok: true,
        operation: 'issue',
        plan,
        draft,
        promptVersion: PROMPT_VERSION,
        fallback: draft.fallback ?? draft.generatedBy === 'deterministic',
        fallbackReason: draft.fallbackReason,
        dailyRemaining: dailyQuota.remaining,
        engineUsed: plan.modelUsed || plan.generatedBy,
        modelUsed: plan.modelUsed || plan.generatedBy,
      });
    }

    // Operation: All (End-to-end contribution pipeline)
    const explanation = await explainFinding(primaryFinding, scan);
    const route = await buildContributionRoute(primaryFinding, scan);
    db.saveRoute(route);

    let draft = null;
    if (primaryFinding.disclosureMode !== 'security-disclosure' && primaryFinding.category !== 'secret') {
      draft = await createIssueDraft(route, primaryFinding, scan);
      route.draftId = draft.id;
      db.saveDraft(draft);
      db.saveRoute(route);
      db.logActivity({
        userId: user.id,
        type: 'draft_generated',
        repoName: scan.repoName,
        description: `Generated maintainer-reviewable issue draft "${draft.title}" via ${draft.generatedBy.toUpperCase()}`,
      });
    }

    db.logActivity({
      userId: user.id,
      type: 'route_created',
      repoName: scan.repoName,
      description: `Generated AI contribution plan for "${primaryFinding.title}" (${plan.generatedBy.toUpperCase()})`,
    });

    return NextResponse.json({
      ok: true,
      operation: 'all',
      plan,
      explanation,
      route,
      draft,
      promptVersion: PROMPT_VERSION,
      fallback: plan.fallback ?? plan.generatedBy === 'deterministic',
      fallbackReason: plan.fallbackReason,
      dailyRemaining: dailyQuota.remaining,
      engineUsed: plan.modelUsed || plan.generatedBy,
      modelUsed: plan.modelUsed || plan.generatedBy,
    });
  } catch (error: any) {
    console.error('AI plan endpoint error:', error);
    const isDisclosureBlocked = error.code === 'DISCLOSURE_BLOCKED' || error.message?.includes('DISCLOSURE_BLOCKED');
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate AI plan',
        errorCode: isDisclosureBlocked ? 'DISCLOSURE_BLOCKED' : 'GEMINI_UNAVAILABLE',
        ok: false,
      },
      { status: isDisclosureBlocked ? 403 : 500 }
    );
  }
}
