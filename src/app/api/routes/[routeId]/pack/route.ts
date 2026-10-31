import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateContributionPackMarkdown } from '@/lib/scanner/learning';
import { calculateContributionReadiness } from '@/lib/scanner/readiness';
import { buildEvidenceChain } from '@/lib/scanner/evidence-chain';
import { generateSkillChecklist } from '@/lib/scanner/learning';

export async function GET(
  req: Request,
  props: { params: Promise<{ routeId: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { routeId } = await props.params;
    if (!routeId) {
      return NextResponse.json({ error: 'routeId is required' }, { status: 400 });
    }

    const route = db.getRouteById(routeId);
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const scan = db.getScanById(route.scanId);
    if (!scan || scan.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to route' }, { status: 403 });
    }

    const fId = route.findingId || (route.findingIds && route.findingIds[0]);
    const finding = fId ? db.getFindingById(fId) : null;
    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    // Strict disclosure guard: secrets and critical findings cannot produce contribution packs for public disclosure
    if (
      finding.disclosureMode === 'security-disclosure' ||
      finding.disclosureMode === 'DISCLOSURE_BLOCKED' ||
      finding.category === 'secret' ||
      String(finding.severity).toUpperCase() === 'CRITICAL'
    ) {
      return NextResponse.json(
        {
          error: 'Public contribution pack export is strictly blocked for secrets and critical security findings.',
          errorCode: 'DISCLOSURE_BLOCKED',
          guidance: 'Notify the repository maintainer privately via their SECURITY.md policy.',
        },
        { status: 403 }
      );
    }

    const readiness = route.contributionReadiness || calculateContributionReadiness(finding);
    const chain = route.evidenceChain || buildEvidenceChain(finding, { repoName: scan.repoName });
    const checklist = route.learningChecklist || generateSkillChecklist(finding, route);

    const draft = route.draftId ? db.getDraftById(route.draftId) : undefined;

    const packMarkdown = generateContributionPackMarkdown(
      route,
      finding,
      scan,
      readiness,
      chain,
      checklist,
      draft?.markdownContent
    );

    const filename = `contribution-pack-${scan.repoName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${finding.id}.md`;

    return NextResponse.json({
      ok: true,
      success: true,
      filename,
      markdown: packMarkdown,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate contribution pack' },
      { status: 500 }
    );
  }
}
