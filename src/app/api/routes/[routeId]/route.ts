import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { calculateContributionReadiness, calculateUrgency } from '@/lib/scanner/readiness';
import { buildEvidenceChain } from '@/lib/scanner/evidence-chain';
import { generateSkillChecklist, generateExplanationModes } from '@/lib/scanner/learning';

export async function GET(
  req: Request,
  props: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await props.params;
    if (!routeId) {
      return NextResponse.json({ error: 'routeId is required' }, { status: 400 });
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const route = db.getRouteById(routeId);
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const scan = db.getScanById(route.scanId);
    if (!scan || (scan.userId && scan.userId !== user.id)) {
      return NextResponse.json({ error: 'Unauthorized access to route' }, { status: 403 });
    }

    const fId = route.findingId || (route.findingIds && route.findingIds[0]);
    const finding = fId ? db.getFindingById(fId) : null;

    // Ensure readiness, evidence chain, and learning checklist are populated
    if (finding) {
      if (!route.contributionReadiness) {
        route.contributionReadiness = calculateContributionReadiness(finding);
        route.readinessScore = route.contributionReadiness.total;
      }
      if (!route.urgencyScore) {
        const u = calculateUrgency(finding);
        route.urgencyScore = u.urgencyScore;
        route.urgencyLabel = u.urgencyLabel;
      }
      if (!route.evidenceChain) {
        route.evidenceChain = buildEvidenceChain(finding, { repoName: scan.repoName });
      }
      if (!route.learningChecklist) {
        route.learningChecklist = generateSkillChecklist(finding, route);
      }
      if (!route.explanationModes) {
        route.explanationModes = generateExplanationModes(finding, route);
      }
      db.saveRoute(route);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      route,
      finding,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve route' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await props.params;
    const body = await req.json();
    const { status, learningChecklist, skillId, completed } = body;

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const route = db.getRouteById(routeId);
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const scan = db.getScanById(route.scanId);
    if (!scan || (scan.userId && scan.userId !== user.id)) {
      return NextResponse.json({ error: 'Unauthorized access to route' }, { status: 403 });
    }

    if (status) {
      const validStatuses = ['not-started', 'in-progress', 'needs-review', 'completed'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status value "${status}". Valid statuses: ${validStatuses.join(', ')}.`, errorCode: 'AUTH_INVALID_INPUT' }, { status: 400 });
      }

      const currentStatus = route.status || 'not-started';
      const allowedTransitions: Record<string, string[]> = {
        'not-started': ['not-started', 'in-progress'],
        'in-progress': ['in-progress', 'needs-review', 'not-started'],
        'needs-review': ['needs-review', 'completed', 'in-progress'],
        'completed': ['completed', 'needs-review', 'in-progress'],
      };

      if (!allowedTransitions[currentStatus]?.includes(status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from "${currentStatus}" to "${status}". Allowed transitions: ${allowedTransitions[currentStatus]?.filter((s) => s !== currentStatus).join(', ')}.`,
            errorCode: 'AUTH_INVALID_INPUT',
          },
          { status: 400 }
        );
      }
      route.status = status;
    }

    if (Array.isArray(learningChecklist)) {
      route.learningChecklist = learningChecklist;
    } else if (skillId && typeof completed === 'boolean') {
      if (route.learningChecklist) {
        route.learningChecklist = route.learningChecklist.map((item) =>
          item.id === skillId ? { ...item, completed } : item
        );
      }
    }

    db.saveRoute(route);

    return NextResponse.json({ ok: true, success: true, route });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update route' },
      { status: 500 }
    );
  }
}
