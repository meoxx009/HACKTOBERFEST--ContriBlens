import { NextResponse } from 'next/server';
import { checkIntegrations } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await checkIntegrations();
  return NextResponse.json({
    success: true,
    status,
    timestamp: new Date().toISOString(),
  });
}
