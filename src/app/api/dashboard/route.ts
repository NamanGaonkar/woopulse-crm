import { NextRequest, NextResponse } from 'next/server';
import { dashboardService } from '../../../services';

export async function GET(request: NextRequest) {
  try {
    const metrics = await dashboardService.metrics();
    return NextResponse.json({ ok: true, ...metrics });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Dashboard failed.' },
      { status: 500 },
    );
  }
}
