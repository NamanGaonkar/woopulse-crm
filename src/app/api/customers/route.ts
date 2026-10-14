import { NextRequest, NextResponse } from 'next/server';
import { customerService } from '../../../services';
import { z } from 'zod';

const ListQuerySchema = z.object({
  q: z.string().optional(),
  segment: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.' }, { status: 400 });
  }

  const { q, segment, limit } = parsed.data;
  let customers = await customerService.list({ query: q ?? undefined, segment: segment ?? undefined });
  if (limit) {
    customers = customers.slice(0, limit);
  }
  return NextResponse.json({ ok: true, customers });
}

export async function POST(request: NextRequest) {
  // In this demo, creating a customer through the API isn't a required flow;
  // we accept a payload and reupsert it so the demo can seed customers if needed.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ ok: false, error: 'Body must be a JSON object.' }, { status: 400 });
  }

  const id = (body as Record<string, unknown>).id;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ ok: false, error: 'Customer id is required.' }, { status: 400 });
  }

  const existing = await customerService.getById(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Customer not found.' }, { status: 404 });
  }

  // Reupsert with the incoming fields merged.
  const merged = {
    ...existing,
    ...(body as Partial<typeof existing>),
  };
  const updated = await customerService.upsertFromWoo(merged);
  return NextResponse.json({ ok: true, customer: updated }, { status: 200 });
}
