import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { calculateContributionReadiness, calculateUrgency } from '@/lib/scanner/readiness';
import { buildEvidenceChain } from '@/lib/scanner/evidence-chain';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get('scanId') || undefined;

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const severity = searchParams.get('severity')?.toUpperCase();
  const category = searchParams.get('category')?.toLowerCase();
  const search = searchParams.get('search')?.toLowerCase();
  const readinessLabel = searchParams.get('readinessLabel')?.toLowerCase();
  const diffStatus = searchParams.get('diffStatus')?.toLowerCase();

  let findings = db.getFindings(scanId);

  if (scanId) {
    const scan = db.getScanById(scanId);
    if (!scan || (scan.userId && scan.userId !== user.id)) {
      return NextResponse.json({ error: 'Scan not found or unauthorized' }, { status: 404 });
    }
  } else {
    const userScanIds = db.getScans(user.id).map((s) => s.id);
    findings = findings.filter((f) => userScanIds.includes(f.scanId));
  }

  // Ensure all returned findings are populated with readiness, urgency, and evidenceChain
  findings = findings.map((f) => {
    const r = f.readiness || calculateContributionReadiness(f);
    const u = f.urgencyScore !== undefined ? { urgencyScore: f.urgencyScore, urgencyLabel: f.urgencyLabel || 'medium' } : calculateUrgency(f);
    const chain = f.evidenceChain || buildEvidenceChain(f);
    return {
      ...f,
      readiness: r,
      urgencyScore: u.urgencyScore,
      urgencyLabel: u.urgencyLabel,
      evidenceChain: chain,
      diffStatus: f.diffStatus || 'new',
    };
  });

  if (severity && severity !== 'ALL') {
    findings = findings.filter((f) => f.severity.toUpperCase() === severity);
  }

  if (category && category !== 'all') {
    findings = findings.filter((f) => {
      const cat = f.category.toLowerCase();
      if (category === 'actions' || category === 'github-actions') {
        return cat === 'github-actions' || cat === 'actions';
      }
      if (category === 'health' || category === 'repository-health') {
        return cat === 'repository-health' || cat === 'health';
      }
      return cat === category;
    });
  }

  if (readinessLabel && readinessLabel !== 'all') {
    findings = findings.filter((f) => f.readiness?.label === readinessLabel);
  }

  if (diffStatus && diffStatus !== 'all') {
    findings = findings.filter((f) => f.diffStatus === diffStatus);
  }

  if (search) {
    findings = findings.filter(
      (f) =>
        f.title.toLowerCase().includes(search) ||
        (f.file && f.file.toLowerCase().includes(search)) ||
        f.ruleId.toLowerCase().includes(search) ||
        f.impact.toLowerCase().includes(search) ||
        (f.evidence && f.evidence.toLowerCase().includes(search))
    );
  }

  const SEVERITY_RANK: Record<string, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFO: 1,
  };

  findings.sort((a, b) => {
    const sA = SEVERITY_RANK[a.severity?.toUpperCase()] || 0;
    const sB = SEVERITY_RANK[b.severity?.toUpperCase()] || 0;
    if (sB !== sA) return sB - sA;
    const cA = typeof a.confidence === 'number' ? a.confidence : (a.confidence === 'HIGH' ? 0.85 : a.confidence === 'MEDIUM' ? 0.7 : 0.5);
    const cB = typeof b.confidence === 'number' ? b.confidence : (b.confidence === 'HIGH' ? 0.85 : b.confidence === 'MEDIUM' ? 0.7 : 0.5);
    return cB - cA;
  });

  return NextResponse.json({ findings, ok: true, success: true });
}

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { findingId, action } = body;

    if (!findingId) {
      return NextResponse.json({ error: 'findingId is required' }, { status: 400 });
    }

    if (action === 'review' || action === 'mark_reviewed') {
      const updated = db.markFindingReviewed(findingId, user.id);
      if (!updated) {
        return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, finding: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process request' }, { status: 500 });
  }
}

