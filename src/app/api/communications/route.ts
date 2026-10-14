import { NextRequest, NextResponse } from 'next/server';
import { communicationService } from '../../../services';
import { z } from 'zod';

const ListQuerySchema = z.object({
  status: z
    .enum(['draft', 'approved', 'sent', 'rejected'])
    .optional(),
});

const CreateDraftSchema = z.object({
  customer_id: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  template: z.enum(['order_confirmation', 'winback', 'vip_thankyou']).optional(),
  reason: z.string().optional(),
  created_by: z.enum(['agent', 'manual']).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.' }, { status: 400 });
  }
  const communications = await communicationService.list({
    status: parsed.data.status,
  });
  return NextResponse.json({ ok: true, communications });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = CreateDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const draft = await communicationService.createDraft({
    customerId: parsed.data.customer_id,
    subject: parsed.data.subject,
    body: parsed.data.body,
    template: parsed.data.template,
    reason: parsed.data.reason,
    createdBy: parsed.data.created_by ?? 'manual',
  });
  return NextResponse.json({ ok: true, communication: draft }, { status: 201 });
}
