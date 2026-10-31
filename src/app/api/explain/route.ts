import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { explainFinding } from '@/lib/gemini';

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

    const explanation = await explainFinding(finding, scan as any);

    if (user) {
      db.logActivity({
        userId: user.id,
        type: 'finding_explained',
        repoName: scan.repoName,
        description: `Requested grounded explanation for finding "${finding.title}" via ${explanation.generatedBy.toUpperCase()}`,
      });
    }

    return NextResponse.json({ success: true, explanation, ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to explain finding' }, { status: 500 });
  }
}
