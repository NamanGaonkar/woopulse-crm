import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sync request
// ---------------------------------------------------------------------------
export const SyncRequestSchema = z.object({
  mode: z.enum(['mock', 'live']).optional(),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

// ---------------------------------------------------------------------------
// Message creation (human-in-the-loop)
// ---------------------------------------------------------------------------
export const MessageCreateSchema = z.object({
  customer_id: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  template: z.enum(['order_confirmation', 'winback', 'vip_thankyou']).optional(),
  reason: z.string().optional(),
});

export type MessageCreate = z.infer<typeof MessageCreateSchema>;

// ---------------------------------------------------------------------------
// Agent tool arguments (validated with zod in the agent loop)
// ---------------------------------------------------------------------------
export const GetCustomerProfileArgsSchema = z.object({
  customerId: z.string().min(1),
});

export const GetCustomerOrdersArgsSchema = z.object({
  customerId: z.string().min(1),
});

export const ListAtRiskCustomersArgsSchema = z.object({});

export const CreateMessageDraftArgsSchema = z.object({
  customerId: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  reason: z.string().min(1),
});

export const TagCustomerArgsSchema = z.object({
  customerId: z.string().min(1),
  tag: z.string().min(1).max(50),
});

// ---------------------------------------------------------------------------
// Webhook signature verification (internal, not user input)
// ---------------------------------------------------------------------------
export const WebhookSignatureHeaderSchema = z.object({
  'x-wc-webhook-signature': z.string().min(1),
});

// ---------------------------------------------------------------------------
// Order status update (from webhook or UI)
// ---------------------------------------------------------------------------
export const OrderStatusUpdateSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled', 'refunded']),
  note: z.string().optional(),
});
