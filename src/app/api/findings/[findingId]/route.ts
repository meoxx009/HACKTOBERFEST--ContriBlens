import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { calculateContributionReadiness, calculateUrgency } from '@/lib/scanner/readiness';
import { buildEvidenceChain } from '@/lib/scanner/evidence-chain';
import type { Finding } from '@/types';

export async function GET(
  req: Request,
  props: { params: Promise<{ findingId: string }> }
) {
  try {
    const { findingId } = await props.params;
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
      return NextResponse.json({ error: 'Unauthorized access to finding' }, { status: 403 });
    }

    // Ensure finding has readiness, urgency, and evidence chain
    if (!finding.readiness) {
      finding.readiness = calculateContributionReadiness(finding);
    }
    if (finding.urgencyScore === undefined) {
      const u = calculateUrgency(finding);
      finding.urgencyScore = u.urgencyScore;
      finding.urgencyLabel = u.urgencyLabel;
    }
    if (!finding.evidenceChain) {
      finding.evidenceChain = buildEvidenceChain(finding, { repoName: scan.repoName });
    }

    // Look up route if exists
    const route = db.getRoutes(scan.id).find((r) => r.findingId === finding.id || (r.findingIds && r.findingIds.includes(finding.id)));

    return NextResponse.json({
      ok: true,
      success: true,
      finding,
      route,
      scan: {
        id: scan.id,
        repoName: scan.repoName,
        branch: scan.branch,
        scannedAt: scan.scannedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve finding' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ findingId: string }> }
) {
  try {
    const { findingId } = await props.params;
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
      return NextResponse.json({ error: 'Unauthorized access to finding' }, { status: 403 });
    }

    const body = await req.json();
    const isReviewed = Boolean(body.reviewed);

    const updatedFinding: Finding = {
      ...finding,
      reviewed: isReviewed,
      reviewedBy: isReviewed ? user.id : undefined,
      reviewedAt: isReviewed ? new Date().toISOString() : undefined,
    };

    db.updateFinding(updatedFinding);

    // Record activity
    if (user) {
      db.logActivity({
        userId: user.id,
        repoName: scan.repoName,
        type: 'finding_reviewed',
        description: isReviewed
          ? `Reviewed finding: ${finding.title}`
          : `Unmarked review on finding: ${finding.title}`,
      });
    }

    return NextResponse.json({
      ok: true,
      success: true,
      finding: updatedFinding,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update finding review status' },
      { status: 500 }
    );
  }
}
