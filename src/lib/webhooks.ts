import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Webhook signature verification.
// WooCommerce signs webhook payloads as:
//   Base64( HMAC-SHA256( raw_body_bytes, webhook_secret ) )
// The signature arrives in the X-WC-Webhook-Signature header.
// ---------------------------------------------------------------------------

export type WebhookPayload = {
  id: string;
  webhook_id: number;
  webhook: { id: number; name: string; secret: string };
  topic: string;
  date_created: string;
  date_created_gmt: string;
  // The rest of the payload is opaque to the verifier; consumers read what
  // they need from the parsed body. We keep the raw body for verification.
  readonly [key: string]: unknown;
};

export type WebhookTopic = 'order.created' | 'order.updated' | 'customer.created';

export function isValidWebhookTopic(topic: unknown): topic is WebhookTopic {
  return (
    typeof topic === 'string' &&
    (topic === 'order.created' || topic === 'order.updated' || topic === 'customer.created')
  );
}

export function verifyWebhookSignature({
  rawBody,
  signatureHeader,
  webhookSecret,
}: {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
}): boolean {
  if (!webhookSecret || !signatureHeader) {
    return false;
  }

  const expected = createHmacSignature(rawBody, webhookSecret);
  if (expected === null) {
    return false;
  }

  // Timing-safe comparison of two base64 strings.
  const expectedBytes = Buffer.from(expected, 'base64');
  const actualBytes = Buffer.from(signatureHeader, 'base64');

  if (expectedBytes.length !== actualBytes.length) {
    // Length mismatch — still do a constant-time comparison of the shorter
    // length to avoid leaking that the length differed.
    const minLength = Math.min(expectedBytes.length, actualBytes.length);
    const trimmedExpected = expectedBytes.subarray(0, minLength);
    const trimmedActual = actualBytes.subarray(0, minLength);
    try {
      timingSafeEqual(trimmedExpected, trimmedActual);
    } catch {
      // Different lengths will throw; treat as mismatch.
    }
    return false;
  }

  try {
    return timingSafeEqual(expectedBytes, actualBytes);
  } catch {
    return false;
  }
}

function createHmacSignature(body: string, secret: string): string | null {
  try {
    return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Idempotency helpers — keyed by resource id for the resources we ingest.
// ---------------------------------------------------------------------------

const processedWebhookIds = new Set<string>();

export function hasProcessedWebhookId(id: string): boolean {
  return processedWebhookIds.has(id);
}

export function markWebhookIdProcessed(id: string): void {
  processedWebhookIds.add(id);
}

export function clearProcessedWebhookIds(): void {
  processedWebhookIds.clear();
}
