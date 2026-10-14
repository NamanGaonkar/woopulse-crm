import { NextRequest, NextResponse } from 'next/server';
import { syncService } from '../../../services';
import { SyncRequestSchema } from '../../../lib/schemas';
import { createWooCommerceClient } from '../../../integrations/woocommerce/client';

export async function GET(request: NextRequest) {
  return syncHandler(request);
}

export async function POST(request: NextRequest) {
  return syncHandler(request);
}

async function syncHandler(request?: NextRequest) {
  try {
    const mode = (process.env.NEXT_PUBLIC_SYNC_MODE ?? 'mock') as 'mock' | 'live';

    let parsed: { mode?: 'mock' | 'live' } | null = null;
    try {
      const body = request ? await request.json().catch(() => null) : null;
      if (body && typeof body === 'object') {
        parsed = SyncRequestSchema.parse(body);
      }
    } catch {
      // If the body is not valid JSON or fails validation, default to mock.
    }

    const effectiveMode: 'mock' | 'live' =
      parsed?.mode ??
      (mode === 'live' ? 'live' : 'mock');

    // If live mode is requested but not configured, fall back to mock with a
    // clear message rather than failing the demo.
    let finalMode: 'mock' | 'live' = effectiveMode;
    if (finalMode === 'live') {
      try {
        createWooCommerceClient('live');
      } catch {
        finalMode = 'mock';
      }
    }

    const result = await syncService.run(finalMode);

    return NextResponse.json(
      {
        ok: true,
        mode: finalMode,
        ...result,
        note: finalMode === 'live'
          ? 'Synced from live WooCommerce store.'
          : 'Synced from mock fixtures (offline demo).',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Sync failed.',
      },
      { status: 500 },
    );
  }
}
