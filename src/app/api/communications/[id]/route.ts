import { NextRequest, NextResponse } from 'next/server';
import { communicationService } from '../../../../services';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Message id is required.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const action = (body as Record<string, unknown>).action;
  if (action === 'approve') {
    const message = await communicationService.approve(id);
    if (!message) {
      return NextResponse.json({ ok: false, error: 'Message not found or not a draft.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, communication: message }, { status: 200 });
  }

  if (action === 'send') {
    const message = await communicationService.send(id);
    if (!message) {
      return NextResponse.json({ ok: false, error: 'Message not found or not approved.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, communication: message, sent: true }, { status: 200 });
  }

  if (action === 'reject') {
    const message = await communicationService.reject(id);
    if (!message) {
      return NextResponse.json({ ok: false, error: 'Message not found or not a draft.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, communication: message }, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: 'Invalid action. Use approve, send, or reject.' }, { status: 400 });
}
