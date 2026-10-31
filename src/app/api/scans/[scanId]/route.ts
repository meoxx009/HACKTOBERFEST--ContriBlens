import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  req: Request,
  props: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await props.params;
    if (!scanId) {
      return NextResponse.json({ error: 'scanId is required', errorCode: 'AUTH_INVALID_INPUT', ok: false }, { status: 400 });
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', errorCode: 'AUTH_INVALID_CREDENTIALS', ok: false },
        { status: 401 }
      );
    }

    const scan = db.getScanById(scanId);
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found', errorCode: 'GITHUB_NOT_FOUND', ok: false }, { status: 404 });
    }

    // Verify scan ownership or access
    if (scan.userId && scan.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to this scan', errorCode: 'AUTH_INVALID_CREDENTIALS', ok: false }, { status: 403 });
    }

    const findings = db.getFindings(scanId);
    const routes = db.getRoutes(scanId);
    const drafts = db.getDrafts(scanId);

    return NextResponse.json({
      ok: true,
      scanId: scan.id,
      repository: {
        fullName: scan.fullName || scan.repoName,
        ref: scan.ref || scan.branch,
      },
      summary: scan,
      technologies: scan.technologies || scan.techStack,
      health: {
        score: scan.readinessScore,
      },
      findings,
      routes,
      drafts,
      scan,
    });
  } catch (error: any) {
    console.error('Error in GET /api/scans/[scanId]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve scan', errorCode: 'PERSISTENCE_FAILED', ok: false },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await props.params;
    if (!scanId) {
      return NextResponse.json(
        { error: 'scanId is required', errorCode: 'AUTH_INVALID_INPUT', ok: false },
        { status: 400 }
      );
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', errorCode: 'AUTH_INVALID_CREDENTIALS', ok: false },
        { status: 401 }
      );
    }

    const scan = db.getScanById(scanId);
    if (!scan) {
      return NextResponse.json(
        { error: 'Scan not found', errorCode: 'GITHUB_NOT_FOUND', ok: false },
        { status: 404 }
      );
    }

    if (scan.userId && scan.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this scan', errorCode: 'AUTH_INVALID_CREDENTIALS', ok: false },
        { status: 403 }
      );
    }

    const deleted = db.deleteScan(scanId, user.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete scan', errorCode: 'PERSISTENCE_FAILED', ok: false },
        { status: 500 }
      );
    }

    db.logActivity({
      userId: user.id,
      type: 'scan',
      repoName: scan.repoName,
      description: `Removed repository scan ${scan.repoName} and all associated findings, routes, and drafts.`,
    });

    return NextResponse.json({
      ok: true,
      success: true,
      deleted: true,
      scanId,
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/scans/[scanId]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete scan', errorCode: 'PERSISTENCE_FAILED', ok: false },
      { status: 500 }
    );
  }
}
