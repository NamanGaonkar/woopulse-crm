import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '../../../../services';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Order id is required.' }, { status: 400 });
  }
  const order = await orderService.getById(id);
  if (!order) {
    return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order });
}

const UpdateStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'cancelled', 'refunded']),
  note: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Order id is required.' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const order = await orderService.updateStatus(id, parsed.data.status, parsed.data.note);
  if (!order) {
    return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order });
}
