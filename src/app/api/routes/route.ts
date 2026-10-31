import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { buildContributionRoute } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { findingId } = await req.json();
    if (!findingId) {
      return NextResponse.json({ error: 'findingId is required' }, { status: 400 });
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const finding = db.getFindingById(findingId);
    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    const scan = db.getScanById(finding.scanId);
    if (!scan || (scan.userId && scan.userId !== user.id)) {
      return NextResponse.json({ error: 'Unauthorized access to scan' }, { status: 403 });
    }

    const route = await buildContributionRoute(finding, scan as any);
    db.saveRoute(route);

    // Update finding
    finding.routeCreated = true;
    finding.routeId = route.id;
    db.updateFinding(finding);

    if (user) {
      db.logActivity({
        userId: user.id,
        type: 'route_created',
        repoName: scan.repoName,
        description: `Created contribution route for "${finding.title}" (${route.difficulty}, ${route.estimatedEffort})`,
      });
    }

    return NextResponse.json({ success: true, route, ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create contribution route' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get('scanId') || undefined;

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let routes = db.getRoutes(scanId);
  if (scanId) {
    const scan = db.getScanById(scanId);
    if (!scan || (scan.userId && scan.userId !== user.id)) {
      return NextResponse.json({ error: 'Scan not found or unauthorized' }, { status: 404 });
    }
  } else {
    const userScanIds = db.getScans(user.id).map((s) => s.id);
    routes = routes.filter((r) => userScanIds.includes(r.scanId));
  }

  return NextResponse.json({ routes, ok: true, success: true });
}

export async function PATCH(req: Request) {
  try {
    const { routeId, status, learningChecklist, skillId, completed } = await req.json();
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

    if (learningChecklist && Array.isArray(learningChecklist)) {
      route.learningChecklist = learningChecklist;
    }

    if (skillId && completed !== undefined && route.learningChecklist) {
      route.learningChecklist = route.learningChecklist.map((item) =>
        item.id === skillId ? { ...item, completed: Boolean(completed) } : item
      );
    }

    db.saveRoute(route);

    if (user && scan) {
      db.logActivity({
        userId: user.id,
        type: 'route_updated',
        repoName: scan.repoName,
        description: `Updated contribution route "${route.title}" status to ${status || route.status}`,
      });
    }

    return NextResponse.json({ success: true, route, ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update route' }, { status: 500 });
  }
}
