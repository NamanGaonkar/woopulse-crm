import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '../../../services';
import { z } from 'zod';

const ListQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => {
      const allowed = ['pending', 'processing', 'completed', 'cancelled', 'refunded'] as const;
      return allowed.includes(v as any) ? (v as any) : undefined;
    }),
  customerId: z.string().optional(),
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

  const { status, customerId, limit } = parsed.data;
  let orders = await orderService.list({
    status: status ?? undefined,
    customerId: customerId ?? undefined,
  });
  if (limit) {
    orders = orders.slice(0, limit);
  }
  return NextResponse.json({ ok: true, orders });
}
