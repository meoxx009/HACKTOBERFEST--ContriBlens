import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { createIssueDraft } from '@/lib/gemini';
import { redactSecrets } from '@/lib/redaction';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { routeId, draftId, regenerate } = body;

    let targetRouteId = routeId;
    let existingDraft: any = null;

    if (!targetRouteId && draftId) {
      existingDraft = db.getDraftById(draftId);
      if (!existingDraft) {
        return NextResponse.json(
          { error: 'Draft not found', errorCode: 'GITHUB_NOT_FOUND' },
          { status: 404 }
        );
      }
      targetRouteId = existingDraft.routeId;
    }

    if (!targetRouteId) {
      return NextResponse.json(
        { error: 'routeId or draftId is required', errorCode: 'AUTH_INVALID_INPUT' },
        { status: 400 }
      );
    }

    const route = db.getRouteById(targetRouteId);
    if (!route) {
      return NextResponse.json(
        { error: 'Contribution route not found', errorCode: 'GITHUB_NOT_FOUND' },
        { status: 404 }
      );
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', errorCode: 'AUTH_INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const scan = db.getScanById(route.scanId);
    if (!scan || (scan.userId && scan.userId !== user.id)) {
      return NextResponse.json(
        { error: 'Unauthorized access to this route', errorCode: 'AUTH_INVALID_CREDENTIALS' },
        { status: 403 }
      );
    }

    // Server-side evidence loading (do NOT trust client-supplied evidence)
    const targetFindingId = route.findingId || (route.findingIds && route.findingIds[0]) || '';
    const finding = db.getFindingById(targetFindingId);
    if (!finding) {
      return NextResponse.json(
        { error: 'Finding not found', errorCode: 'GITHUB_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Strict Security Model Rule: Secret & critical findings cannot create a public issue draft (SECURITY.md §4)
    const isDisclosureBlocked =
      finding.category === 'secret' ||
      finding.disclosureMode === 'security-disclosure' ||
      finding.disclosureMode === 'DISCLOSURE_BLOCKED' ||
      String(finding.severity).toUpperCase() === 'CRITICAL';

    if (isDisclosureBlocked) {
      return NextResponse.json(
        {
          error:
            'Public issue draft generation is strictly blocked for secrets and critical severity findings. Please follow responsible private security disclosure guidance.',
          errorCode: 'DISCLOSURE_BLOCKED',
          guidance:
            'Notify the repository maintainer privately via their SECURITY.md policy, security email, or GitHub Private Vulnerability Reporting.',
        },
        { status: 403 }
      );
    }

    const draft = await createIssueDraft(route, finding, scan as any, { bypassCache: Boolean(regenerate) });
    draft.userId = user.id;
    draft.status = 'draft';
    draft.labels = ['security', 'good-first-issue', route.difficulty];

    // Defensive re-redaction before persistence
    draft.markdownContent = redactSecrets(draft.markdownContent);
    draft.title = redactSecrets(draft.title);

    if (draftId && regenerate) {
      draft.id = draftId;
      db.updateDraft(draftId, {
        markdownContent: draft.markdownContent,
        title: draft.title,
        generatedBy: draft.generatedBy,
        fallback: draft.fallback,
        fallbackReason: draft.fallbackReason,
        updatedAt: new Date().toISOString(),
      });
    } else {
      db.saveDraft(draft);
      // Update route with draftId
      route.draftId = draft.id;
      db.saveRoute(route);
    }

    if (user) {
      db.logActivity({
        userId: user.id,
        type: 'draft_generated',
        repoName: scan.repoName,
        description: `${regenerate ? 'Regenerated' : 'Generated'} maintainer-reviewable issue draft "${draft.title}" via ${draft.generatedBy.toUpperCase()}`,
      });
    }

    return NextResponse.json({ ok: true, draft, success: true });
  } catch (error: any) {
    if (error?.errorCode === 'DISCLOSURE_BLOCKED' || error?.statusCode === 403) {
      return NextResponse.json(
        {
          error: error.message,
          errorCode: 'DISCLOSURE_BLOCKED',
          guidance:
            'Notify the repository maintainer privately via their SECURITY.md policy or GitHub Private Vulnerability Reporting.',
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to generate issue draft', errorCode: 'GEMINI_UNAVAILABLE' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get('scanId') || undefined;
  const draftId = searchParams.get('draftId') || undefined;

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required', errorCode: 'AUTH_INVALID_CREDENTIALS' },
      { status: 401 }
    );
  }

  if (draftId) {
    const draft = db.getDraftById(draftId);
    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found', errorCode: 'GITHUB_NOT_FOUND' },
        { status: 404 }
      );
    }
    if (draft.userId && draft.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to this draft', errorCode: 'AUTH_INVALID_CREDENTIALS' },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true, draft, success: true });
  }

  let drafts = db.getDrafts(scanId);
  if (scanId) {
    const scan = db.getScanById(scanId);
    if (!scan || (scan.userId && scan.userId !== user.id)) {
      return NextResponse.json({ error: 'Scan not found or unauthorized' }, { status: 404 });
    }
  } else {
    const userScanIds = db.getScans(user.id).map((s) => s.id);
    drafts = drafts.filter((d) => d.userId === user.id || userScanIds.includes(d.scanId));
  }

  return NextResponse.json({ ok: true, drafts, success: true });
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', errorCode: 'AUTH_INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { draftId, title, body: draftBody, markdownContent, labels, status } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required', errorCode: 'AUTH_INVALID_INPUT' },
        { status: 400 }
      );
    }

    const existing = db.getDraftById(draftId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Draft not found', errorCode: 'GITHUB_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (user && existing.userId && existing.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to this draft', errorCode: 'AUTH_INVALID_CREDENTIALS' },
        { status: 403 }
      );
    }

    // Defensive re-redaction before updating
    const safeTitle = title !== undefined ? redactSecrets(title) : undefined;
    const rawContent = markdownContent !== undefined ? markdownContent : draftBody;
    const safeMarkdown = rawContent !== undefined ? redactSecrets(rawContent) : undefined;

    const updated = db.updateDraft(draftId, {
      ...(safeTitle !== undefined && { title: safeTitle }),
      ...(safeMarkdown !== undefined && { markdownContent: safeMarkdown, body: safeMarkdown }),
      ...(labels !== undefined && { labels }),
      ...(status !== undefined && { status }),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, draft: updated, success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update draft', errorCode: 'PERSISTENCE_FAILED' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', errorCode: 'AUTH_INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId query parameter is required', errorCode: 'AUTH_INVALID_INPUT' },
        { status: 400 }
      );
    }

    const success = db.deleteDraft(draftId);
    if (!success) {
      return NextResponse.json(
        { error: 'Draft not found or already deleted', errorCode: 'GITHUB_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, success: true, message: 'Draft deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete draft', errorCode: 'PERSISTENCE_FAILED' },
      { status: 500 }
    );
  }
}
