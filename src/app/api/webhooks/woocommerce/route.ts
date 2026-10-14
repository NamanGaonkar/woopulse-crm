import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, isValidWebhookTopic, hasProcessedWebhookId, markWebhookIdProcessed } from '../../../../lib/webhooks';
import { orderService, customerService } from '../../../../services';
import { z } from 'zod';
import type { Order } from '../../../../domain';

// ---------------------------------------------------------------------------
// WooCommerce webhook ingestion.
// Topics handled: order.created, order.updated, customer.created.
// Signature: base64 HMAC-SHA256 of the raw body using WOOCOMMERCE_WEBHOOK_SECRET.
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET ?? '';

async function getRawBody(request: NextRequest): Promise<string> {
  // NextRequest.text() gives us the raw body for signature verification.
  return request.text();
}

export async function POST(request: NextRequest) {
  // 1. Read the raw body BEFORE parsing, because the signature is over the raw bytes.
  let rawBody: string;
  try {
    rawBody = await getRawBody(request);
  } catch {
    return NextResponse.json({ ok: false, error: 'Unable to read request body.' }, { status: 400 });
  }

  // 2. Get the signature header.
  const signatureHeader =
    request.headers.get('x-wc-webhook-signature') ?? '';
  const topicHeader = request.headers.get('x-wc-webhook-topic') ?? '';

  // 3. Verify the signature.
  if (!WEBHOOK_SECRET) {
    // In mock/demo mode without a webhook secret, we still accept payloads for
    // the demo but log it clearly. In production this should be mandatory.
    console.warn('Webhook secret not configured; accepting demo payload (not verified).');
  } else if (!verifyWebhookSignature({ rawBody, signatureHeader: signatureHeader, webhookSecret: WEBHOOK_SECRET })) {
    return NextResponse.json({ ok: false, error: 'Invalid webhook signature.' }, { status: 401 });
  }

  // 4. Parse the payload.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (typeof payload !== 'object' || payload === null) {
    return NextResponse.json({ ok: false, error: 'Payload must be a JSON object.' }, { status: 400 });
  }
  const payloadObj = payload as Record<string, unknown>;

  // 5. Determine topic.
  const topic = isValidWebhookTopic(payloadObj.topic)
    ? payloadObj.topic
    : isValidWebhookTopic(topicHeader)
    ? topicHeader
    : null;

  if (!topic) {
    return NextResponse.json(
      { ok: false, error: 'Unknown or missing webhook topic. Expected order.created, order.updated, or customer.created.' },
      { status: 400 },
    );
  }

  // 6. Idempotency — avoid processing the same delivery twice.
  const payloadId = typeof payloadObj.id !== 'undefined' ? String(payloadObj.id) : null;
  if (payloadId && hasProcessedWebhookId(payloadId)) {
    return NextResponse.json({ ok: true, idempotent: true, topic, processed: false }, { status: 200 });
  }
  if (payloadId) {
    markWebhookIdProcessed(payloadId);
  }

  // 7. Route to the right handler.
  try {
    if (topic === 'customer.created') {
      return handleCustomerCreated(payloadObj);
    }
    if (topic === 'order.created' || topic === 'order.updated') {
      return handleOrderEvent(topic, payloadObj);
    }
    return NextResponse.json({ ok: false, error: `Unhandled topic: ${topic}.` }, { status: 400 });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Webhook processing failed.' },
      { status: 500 },
    );
  }
}

// WooCommerce customer payload shape (wc/v3) — we parse what we need.
const WooCustomerSchema = z.object({
  id: z.string(),
  email: z.string().nullable().default(''),
  first_name: z.string().nullable().default(''),
  last_name: z.string().nullable().default(''),
  phone: z.string().nullable().default(null),
  username: z.string().nullable().default(null),
  date_created: z.string().nullable().default(''),
  date_modified: z.string().nullable().default(null),
  bad: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  locale: z.string().nullable().default(null),
  avatar_url: z.string().nullable().default(null),
  billing: z.object({
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    address_1: z.string().nullable().optional(),
    address_2: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    postcode: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }).optional().default({}),
  shipping: z
    .object({
      first_name: z.string().nullable().optional(),
      last_name: z.string().nullable().optional(),
      company: z.string().nullable().optional(),
      address_1: z.string().nullable().optional(),
      address_2: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      postcode: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .optional()
    .default({}),
});

// WooCommerce order payload shape (wc/v3) — we parse what we need and map to our domain.
const WooOrderSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable().default(null),
  number: z.number(),
  order_key: z.string(),
  created_via: z.string().nullable().default(''),
  currency: z.string().default('INR'),
  currency_symbol: z.string().default('₹'),
  financial_status: z.string(),
  fulfillment_status: z.string().nullable().default(null),
  payment_method: z.string().nullable().default(''),
  payment_method_title: z.string().nullable().default(''),
  set_paid: z.boolean().default(false),
  cart_hash: z.string().nullable().default(null),
  customer_id: z.string(),
  customer: WooCustomerSchema,
  date_created: z.string(),
  date_modified: z.string().nullable().default(null),
  date_paid: z.string().nullable().default(null),
  date_completed: z.string().nullable().default(null),
  total: z.string(),
  subtotal: z.string(),
  subtotal_tax: z.string().default('0.00'),
  shipping: z.string(),
  shipping_tax: z.string().default('0.00'),
  total_tax: z.string().default('0.00'),
  meta_data: z.array(z.any()).default([]),
  tax_lines: z.array(z.any()).default([]),
  shipping_lines: z.array(z.any()).default([]),
  line_items: z.array(z.any()).default([]),
  status_timeline: z.array(z.any()).default([]),
});

function toDomainCustomer(raw: z.infer<typeof WooCustomerSchema>): Parameters<typeof customerService.upsertFromWoo>[0] {
  return {
    id: raw.id,
    email: raw.email ?? '',
    first_name: raw.first_name ?? '',
    last_name: raw.last_name ?? '',
    phone: raw.phone ?? undefined,
    username: raw.username ?? undefined,
    date_created: raw.date_created ?? new Date().toISOString(),
    date_modified: raw.date_modified ?? undefined,
    bad: raw.bad,
    segments: [],
    tags: raw.tags,
    notes: [],
    lifetime_value: 0,
    order_count: 0,
    last_order_at: undefined,
    locale: raw.locale ?? undefined,
    avatar_url: raw.avatar_url ?? undefined,
    billing_address: raw.billing
      ? {
          first_name: raw.billing.first_name ?? '',
          last_name: raw.billing.last_name ?? '',
          company: raw.billing.company ?? undefined,
          address_1: raw.billing.address_1 ?? '',
          address_2: raw.billing.address_2 ?? undefined,
          city: raw.billing.city ?? '',
          state: raw.billing.state ?? undefined,
          postcode: raw.billing.postcode ?? undefined,
          country: raw.billing.country ?? '',
          email: raw.billing.email ?? undefined,
          phone: raw.billing.phone ?? undefined,
        }
      : undefined,
    shipping_address: raw.shipping
      ? {
          first_name: raw.shipping.first_name ?? '',
          last_name: raw.shipping.last_name ?? '',
          company: raw.shipping.company ?? undefined,
          address_1: raw.shipping.address_1 ?? '',
          address_2: raw.shipping.address_2 ?? undefined,
          city: raw.shipping.city ?? '',
          state: raw.shipping.state ?? undefined,
          postcode: raw.shipping.postcode ?? undefined,
          country: raw.shipping.country ?? '',
          email: raw.shipping.email ?? undefined,
          phone: raw.shipping.phone ?? undefined,
        }
      : undefined,
  };
}

function toDomainOrder(raw: z.infer<typeof WooOrderSchema>): Parameters<typeof orderService.upsertFromWoo>[0] {
  return {
    id: raw.id,
    parent_id: raw.parent_id ?? undefined,
    number: raw.number,
    order_key: raw.order_key,
    created_via: raw.created_via ?? 'storefront',
    currency: raw.currency ?? 'INR',
    currency_symbol: raw.currency_symbol ?? '₹',
    financial_status: (raw.financial_status as Order['financial_status']) ?? 'pending',
    fulfillment_status: raw.fulfillment_status === 'fulfilled' ? 'fulfilled' : raw.fulfillment_status === 'unfulfilled' ? 'unfulfilled' : raw.fulfillment_status === 'partial' ? 'partial' : undefined,
    payment_method: raw.payment_method ?? '',
    payment_method_title: raw.payment_method_title ?? '',
    set_paid: raw.set_paid,
    cart_hash: raw.cart_hash ?? undefined,
    customer_id: raw.customer_id,
    customer: toDomainCustomer(raw.customer),
    date_created: raw.date_created,
    date_modified: raw.date_modified ?? undefined,
    date_paid: raw.date_paid ?? undefined,
    date_completed: raw.date_completed ?? undefined,
    total: raw.total,
    subtotal: raw.subtotal,
    subtotal_tax: raw.subtotal_tax ?? '0.00',
    shipping: raw.shipping,
    shipping_tax: raw.shipping_tax ?? '0.00',
    total_tax: raw.total_tax ?? '0.00',
    meta_data: raw.meta_data ?? [],
    tax_lines: raw.tax_lines ?? [],
    shipping_lines: raw.shipping_lines ?? [],
    line_items: raw.line_items ?? [],
    status_timeline: raw.status_timeline ?? [],
  };
}

async function handleCustomerCreated(payload: Record<string, unknown>): Promise<NextResponse> {
  const parsed = WooCustomerSchema.safeParse(payload);
  if (!parsed.success) {
    // In a demo, if the payload doesn't match WooCommerce's expected shape,
    // still try to ingest whatever we can from a lighter parse.
    const fallbackId = payload?.id;
    if (!fallbackId || typeof fallbackId !== 'string') {
      return NextResponse.json({ ok: false, error: 'Customer payload missing id.' }, { status: 400 });
    }
    const customer = {
      id: fallbackId as string,
      email: (payload?.email as string) ?? '',
      first_name: (payload?.first_name as string) ?? '',
      last_name: (payload?.last_name as string) ?? '',
      phone: (payload?.phone as string) ?? undefined,
      username: (payload?.username as string) ?? undefined,
      date_created: (payload?.date_created as string) ?? new Date().toISOString(),
      date_modified: (payload?.date_modified as string) ?? undefined,
      bad: Boolean(payload?.bad),
      segments: [],
      tags: Array.isArray(payload?.tags) ? (payload.tags as string[]) : [],
      notes: [],
      lifetime_value: 0,
      order_count: 0,
      last_order_at: undefined,
      locale: (payload?.locale as string) ?? undefined,
      avatar_url: (payload?.avatar_url as string) ?? undefined,
      billing_address: (payload?.billing as Record<string, unknown>) as any ?? undefined,
      shipping_address: (payload?.shipping as Record<string, unknown>) as any ?? undefined,
    };
    await customerService.upsertFromWoo(customer);
    return NextResponse.json({ ok: true, topic: 'customer.created', action: 'customer_upserted', id: customer.id }, { status: 200 });
  }
  const customer = toDomainCustomer(parsed.data);
  await customerService.upsertFromWoo(customer);
  return NextResponse.json({ ok: true, topic: 'customer.created', action: 'customer_upserted', id: customer.id }, { status: 200 });
}

async function handleOrderEvent(topic: 'order.created' | 'order.updated', payload: Record<string, unknown>): Promise<NextResponse> {
  const parsed = WooOrderSchema.safeParse(payload);
  if (!parsed.success) {
    const fallbackId = payload?.id;
    if (!fallbackId || typeof fallbackId !== 'string') {
      return NextResponse.json({ ok: false, error: 'Order payload missing id.' }, { status: 400 });
    }
    const customerId = (payload?.customer_id as string) ?? fallbackId;
    const customer = await customerService.getById(customerId);
    const order = {
      id: fallbackId as string,
      parent_id: (payload?.parent_id as string) ?? undefined,
      number: (payload?.number as number) ?? 0,
      order_key: (payload?.order_key as string) ?? '',
      created_via: (payload?.created_via as string) ?? 'storefront',
      currency: (payload?.currency as string) ?? 'INR',
      currency_symbol: (payload?.currency_symbol as string) ?? '₹',
      financial_status: (payload?.financial_status as Order['financial_status']) ?? 'pending',
      fulfillment_status: undefined,
      payment_method: (payload?.payment_method as string) ?? '',
      payment_method_title: (payload?.payment_method_title as string) ?? '',
      set_paid: Boolean(payload?.set_paid),
      cart_hash: (payload?.cart_hash as string) ?? undefined,
      customer_id: customerId,
      customer: customer ?? {
        id: customerId,
        email: '',
        first_name: '',
        last_name: '',
        phone: undefined,
        username: undefined,
        date_created: new Date().toISOString(),
        date_modified: undefined,
        bad: false,
        segments: [],
        tags: [],
        notes: [],
        lifetime_value: 0,
        order_count: 0,
        last_order_at: undefined,
        locale: undefined,
        avatar_url: undefined,
        billing_address: undefined,
        shipping_address: undefined,
      },
      date_created: (payload?.date_created as string) ?? new Date().toISOString(),
      date_modified: (payload?.date_modified as string) ?? undefined,
      date_paid: (payload?.date_paid as string) ?? undefined,
      date_completed: (payload?.date_completed as string) ?? undefined,
      total: (payload?.total as string) ?? '0.00',
      subtotal: (payload?.subtotal as string) ?? '0.00',
      subtotal_tax: (payload?.subtotal_tax as string) ?? '0.00',
      shipping: (payload?.shipping as string) ?? '0.00',
      shipping_tax: (payload?.shipping_tax as string) ?? '0.00',
      total_tax: (payload?.total_tax as string) ?? '0.00',
      meta_data: Array.isArray(payload?.meta_data) ? (payload.meta_data as any[]) : [],
      tax_lines: Array.isArray(payload?.tax_lines) ? (payload.tax_lines as any[]) : [],
      shipping_lines: Array.isArray(payload?.shipping_lines) ? (payload.shipping_lines as any[]) : [],
      line_items: Array.isArray(payload?.line_items) ? (payload.line_items as any[]) : [],
      status_timeline: Array.isArray(payload?.status_timeline) ? (payload.status_timeline as any[]) : [],
    };
    await orderService.upsertFromWoo(order);
    if (topic === 'order.updated') {
      const status = order.financial_status;
      await orderService.updateStatus(order.id, status, `Webhook ${topic} updated status to ${status}.`);
    }
    return NextResponse.json({ ok: true, topic, action: topic === 'order.updated' ? 'order_updated' : 'order_upserted', id: order.id }, { status: 200 });
  }
  const order = toDomainOrder(parsed.data);
  await orderService.upsertFromWoo(order);
  if (topic === 'order.updated') {
    const status = order.financial_status;
    await orderService.updateStatus(order.id, status, `Webhook ${topic} updated status to ${status}.`);
  }
  return NextResponse.json({ ok: true, topic, action: topic === 'order.updated' ? 'order_updated' : 'order_upserted', id: order.id }, { status: 200 });
}
