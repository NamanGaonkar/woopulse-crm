import type {
  Customer,
  CustomerSegment,
  Order,
  Message,
  CommunicationTemplate,
  DashboardMetrics,
  OrderStatus,
} from '../domain';
import {
  customerRepository,
  orderRepository,
  messageRepository,
} from '../repositories/in-memory';
import { createWooCommerceClient } from '../integrations/woocommerce/client';

// ---------------------------------------------------------------------------
// Segmentation — configurable thresholds.
// Segments: new, active, vip, at-risk, churned.
// ---------------------------------------------------------------------------

export const SEGMENT_THRESHOLDS = {
  vip: {
    minOrders: 5,
    minLifetimeValue: 20000,
  },
  active: {
    maxDaysSinceLastOrder: 90,
    minOrders: 2,
  },
  atRisk: {
    maxDaysSinceLastOrder: 180,
    minOrders: 1,
    // At-risk excludes VIP and active by construction order below.
  },
  churned: {
    maxDaysSinceLastOrder: 270,
    minOrders: 1,
  },
} as const;

export type SegmentationResult = {
  segments: CustomerSegment[];
};

export function computeSegments(customer: {
  order_count: number;
  lifetime_value: number;
  last_order_at?: string | null;
}): CustomerSegment[] {
  const daysSinceLastOrder = computeDaysSinceLastOrder(customer.last_order_at);
  const segments: CustomerSegment[] = [];

  // VIP takes precedence.
  if (
    customer.order_count >= SEGMENT_THRESHOLDS.vip.minOrders &&
    customer.lifetime_value >= SEGMENT_THRESHOLDS.vip.minLifetimeValue
  ) {
    segments.push('vip');
  }

  // Active: ordered recently with some history.
  if (
    customer.order_count >= SEGMENT_THRESHOLDS.active.minOrders &&
    daysSinceLastOrder <= SEGMENT_THRESHOLDS.active.maxDaysSinceLastOrder
  ) {
    segments.push('active');
  }

  // At-risk: hasn't ordered recently but has ordered before, and isn't VIP/active.
  if (
    customer.order_count >= SEGMENT_THRESHOLDS.atRisk.minOrders &&
    daysSinceLastOrder > SEGMENT_THRESHOLDS.active.maxDaysSinceLastOrder &&
    daysSinceLastOrder <= SEGMENT_THRESHOLDS.churned.maxDaysSinceLastOrder
  ) {
    segments.push('at-risk');
  }

  // Churned: long gap.
  if (
    customer.order_count >= SEGMENT_THRESHOLDS.churned.minOrders &&
    daysSinceLastOrder > SEGMENT_THRESHOLDS.churned.maxDaysSinceLastOrder
  ) {
    segments.push('churned');
  }

  // New: placed an order but too recent/light to be elsewhere yet.
  if (
    customer.order_count >= 1 &&
    segments.length === 0 &&
    daysSinceLastOrder <= SEGMENT_THRESHOLDS.active.maxDaysSinceLastOrder
  ) {
    segments.push('new');
  }

  if (segments.length === 0) {
    // Fallback for customers with no meaningful activity yet.
    segments.push('new');
  }

  return segments;
}

function computeDaysSinceLastOrder(lastOrderAt: string | undefined | null): number {
  if (!lastOrderAt) return Number.MAX_SAFE_INTEGER;
  const then = new Date(lastOrderAt).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function recomputeCustomerSegments(customer: Customer): Customer {
  const next = computeSegments({
    order_count: customer.order_count,
    lifetime_value: customer.lifetime_value,
    last_order_at: customer.last_order_at ?? undefined,
  });
  return {
    ...customer,
    segments: next,
  };
}

// ---------------------------------------------------------------------------
// Customer service
// ---------------------------------------------------------------------------

export const customerService = {
  async list(options?: {
    query?: string;
    segment?: string;
  }): Promise<Customer[]> {
    let customers = await customerRepository.findAll();
    if (options?.query) {
      customers = await customerRepository.search(options.query);
    }
    if (options?.segment) {
      customers = customers.filter((c) =>
        c.segments.includes(options.segment as Customer['segments'][number]),
      );
    }
    return customers;
  },

  async getById(id: string): Promise<Customer | undefined> {
    const customer = await customerRepository.findById(id);
    if (!customer) return undefined;
    return recomputeCustomerSegments(customer);
  },

  async getByEmail(email: string): Promise<Customer | undefined> {
    const customer = await customerRepository.findByEmail(email);
    if (!customer) return undefined;
    return recomputeCustomerSegments(customer);
  },

  async upsertFromWoo(customer: Customer): Promise<Customer> {
    // Recompute segments from fresh order data before storing.
    const next = recomputeCustomerSegments(customer);
    return customerRepository.upsert(next);
  },

  async addTag(customerId: string, tag: string): Promise<Customer | undefined> {
    const updated = await customerRepository.addTag(customerId, tag);
    if (!updated) return undefined;
    return recomputeCustomerSegments(updated);
  },

  async atRisk(): Promise<Customer[]> {
    const all = await customerRepository.findAll();
    return all.filter((c) => c.segments.includes('at-risk'));
  },

  async highValue(): Promise<Customer[]> {
    const all = await customerRepository.findAll();
    return all.filter((c) => c.segments.includes('vip'));
  },

  async atRiskOrHighValue(): Promise<Customer[]> {
    const all = await customerRepository.findAll();
    return all.filter((c) =>
      c.segments.includes('at-risk') || c.segments.includes('vip'),
    );
  },
};

// ---------------------------------------------------------------------------
// Order service
// ---------------------------------------------------------------------------

export const orderService = {
  async list(options?: {
    status?: OrderStatus;
    customerId?: string;
  }): Promise<Order[]> {
    let orders = await orderRepository.findAll();
    if (options?.status) {
      orders = orders.filter((o) => o.financial_status === options.status);
    }
    if (options?.customerId) {
      orders = orders.filter((o) => o.customer_id === options.customerId);
    }
    return orders;
  },

  async getById(id: string): Promise<Order | undefined> {
    const order = await orderRepository.findById(id);
    if (!order) return undefined;
    // Attach a fresh copy of the customer snapshot stored on the order.
    const customer = await customerRepository.findById(order.customer_id);
    if (customer) {
      // Do not mutate the stored order's embedded customer in-place for the
      // returned shape; spread a fresh object so the caller gets recomputed
      // segments without affecting the stored snapshot.
      return {
        ...order,
        customer: recomputeCustomerSegments(customer),
      };
    }
    return order;
  },

  async upsertFromWoo(order: Order): Promise<Order> {
    // Ensure the embedded customer snapshot is also upserted so later detail
    // views have a current customer snapshot without an extra round-trip.
    const customer = await customerRepository.upsert(order.customer);
    const next = {
      ...order,
      customer,
    };
    return orderRepository.upsert(next);
  },

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    note?: string,
  ): Promise<Order | undefined> {
    return orderRepository.updateStatus(orderId, status, note);
  },

  async byStatus(status: OrderStatus): Promise<Order[]> {
    return orderRepository.byStatus(status);
  },

  async recent(limit = 10): Promise<Order[]> {
    const recentOrders = await orderRepository.recent(limit);
    // Attach recomputed customer snapshot for each.
    return Promise.all(
      recentOrders.map(async (order) => {
        const customer = await customerRepository.findById(order.customer_id);
        if (customer) {
          return {
            ...order,
            customer: recomputeCustomerSegments(customer),
          };
        }
        return order;
      }),
    );
  },
};

// ---------------------------------------------------------------------------
// Communication service — message templates, queue, simulated sending.
// ---------------------------------------------------------------------------

const TEMPLATES: Record<CommunicationTemplate, { subject: string; body: string }> = {
  order_confirmation: {
    subject: 'Your order has been confirmed',
    body: "Hi {{first_name}},\n\nGreat news — your order #{{order_number}} has been confirmed and is being prepared.\n\nWe'll keep you updated on its progress. If you have any questions, just reply to this message.\n\nThanks for shopping with us,\nThe WooPulse Team",
  },
  winback: {
    subject: 'We miss you — here’s something special',
    body: "Hi {{first_name}},\n\nIt’s been a while since we last saw you, and we’d love to welcome you back.\n\nAs a thank-you, here’s a little something to make your next order extra special.\n\nHope to see you soon,\nThe WooPulse Team",
  },
  vip_thankyou: {
    subject: 'A quick thank you from the team',
    body: "Hi {{first_name}},\n\nThank you for being such a valued customer. We genuinely appreciate your continued support and wanted to say a quick thank you.\n\nIf there’s anything we can do for you, just let us know.\n\nWarm regards,\nThe WooPulse Team",
  },
};

export type DraftMessage = Omit<Message, 'id' | 'created_at' | 'sent_at'> & {
  id?: string;
  created_at?: string;
  sent_at?: string;
};

export const communicationService = {
  async getById(id: string): Promise<Message | undefined> {
    return messageRepository.findById(id);
  },

  async applyTemplate(
    template: CommunicationTemplate,
    customer: Customer,
    orderNumber?: string,
  ): Promise<{ subject: string; body: string }> {
    const tpl = TEMPLATES[template];
    const subject = tpl.subject.replace('{{first_name}}', customer.first_name);
    let body = tpl.body
      .replace('{{first_name}}', customer.first_name)
      .replace('{{order_number}}', orderNumber ?? 'your order');
    return { subject, body };
  },

  async createDraft(params: {
    customerId: string;
    subject: string;
    body: string;
    template?: CommunicationTemplate;
    reason?: string;
    createdBy?: 'agent' | 'manual';
  }): Promise<Message> {
    const now = new Date().toISOString();
    const message: Message = {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      customer_id: params.customerId,
      template: params.template,
      subject: params.subject,
      body: params.body,
      reason: params.reason,
      status: 'draft',
      created_by: params.createdBy ?? 'manual',
      created_at: now,
      agent_step: params.createdBy === 'agent' ? 'agent_draft_created' : undefined,
    };
    return messageRepository.create(message);
  },

  async approve(messageId: string): Promise<Message | undefined> {
    const message = await messageRepository.findById(messageId);
    if (!message || message.status !== 'draft') return undefined;
    message.status = 'approved';
    return messageRepository.update(message);
  },

  async send(messageId: string): Promise<Message | undefined> {
    const message = await messageRepository.findById(messageId);
    if (!message || message.status !== 'approved') return undefined;
    message.status = 'sent';
    message.sent_at = new Date().toISOString();
    return messageRepository.update(message);
  },

  async reject(messageId: string): Promise<Message | undefined> {
    const message = await messageRepository.findById(messageId);
    if (!message || message.status !== 'draft') return undefined;
    message.status = 'rejected';
    return messageRepository.update(message);
  },

  async list(options?: { status?: Message['status'] }): Promise<Message[]> {
    if (options?.status) {
      return messageRepository.findByStatus(options.status);
    }
    return messageRepository.findAll();
  },

  async forCustomer(customerId: string): Promise<Message[]> {
    return messageRepository.findByCustomerId(customerId);
  },

  async recentDrafts(limit = 10): Promise<Message[]> {
    const all = await messageRepository.recent(limit);
    return all.filter((m) => m.status === 'draft' || m.status === 'approved');
  },
};

// ---------------------------------------------------------------------------
// Sync service — pulls from WooCommerce and upserts idempotently.
// ---------------------------------------------------------------------------

export const syncService = {
  async run(mode: 'mock' | 'live' = 'mock'): Promise<{
    customersImported: number;
    ordersImported: number;
    customersUpdated: number;
    ordersUpdated: number;
  }> {
    const client = createWooCommerceClient(mode);
    const [remoteCustomers, remoteOrders] = await Promise.all([
      client.getCustomers(),
      client.getOrders(),
    ]);

    let customersImported = 0;
    let ordersImported = 0;
    let customersUpdated = 0;
    let ordersUpdated = 0;

    for (const customer of remoteCustomers) {
      const existing = await customerRepository.findById(customer.id);
      if (existing) {
        const updated = recomputeCustomerSegments(customer);
        await customerRepository.upsert(updated);
        customersUpdated++;
      } else {
        const inserted = recomputeCustomerSegments(customer);
        await customerRepository.upsert(inserted);
        customersImported++;
      }
    }

    for (const order of remoteOrders) {
      const existing = await orderRepository.findById(order.id);
      if (existing) {
        await orderRepository.upsert(order);
        ordersUpdated++;
      } else {
        await orderRepository.upsert(order);
        ordersImported++;
      }
      // Keep the customer snapshot consistent.
      await customerRepository.upsert(order.customer);
    }

    // Seed a small review queue for the offline demo. These are real draft
    // records tied to synced customers, so Communications is useful before
    // the optional Gemini agent is run. The guard keeps repeated syncs idempotent.
    const existingMessages = await messageRepository.findAll();
    if (existingMessages.length === 0 && remoteCustomers.length > 0) {
      const segmentedCustomers = remoteCustomers
        .filter((customer) => customer.segments.includes('at-risk') || customer.segments.includes('vip'))
        .slice(0, 3);
      const demoCustomers = segmentedCustomers.length > 0
        ? segmentedCustomers
        : remoteCustomers.slice(0, 3);

      for (const customer of demoCustomers) {
        const isVip = customer.segments.includes('vip');
        await communicationService.createDraft({
          customerId: customer.id,
          template: isVip ? 'vip_thankyou' : 'winback',
          subject: isVip
            ? `A thank-you for being with us, ${customer.first_name}`
            : `We would love to welcome you back, ${customer.first_name}`,
          body: isVip
            ? `Hi ${customer.first_name},\n\nThank you for being one of our valued customers. We appreciate your continued support and would love to help with your next order.\n\nWarm regards,\nThe WooPulse Team`
            : `Hi ${customer.first_name},\n\nWe noticed it has been a while since your last order. We would love to welcome you back and help you find something you will enjoy.\n\nWarm regards,\nThe WooPulse Team`,
          reason: isVip
            ? 'VIP customer identified during sync; queued for a personalised thank-you review.'
            : 'At-risk customer identified during sync; queued for a win-back review.',
          createdBy: 'agent',
        });
      }
    }

    return { customersImported, ordersImported, customersUpdated, ordersUpdated };
  },
};

// ---------------------------------------------------------------------------
// Dashboard service — aggregates KPIs and segment breakdown.
// ---------------------------------------------------------------------------

export const dashboardService = {
  async metrics(): Promise<DashboardMetrics> {
    const customers = await customerRepository.findAll();
    const orders = await orderRepository.findAll();
    const messages = await messageRepository.findAll();

    const atRiskCount = customers.filter(
      (c) => c.segments.includes('at-risk'),
    ).length;

    const segmentBreakdown = {
      new: 0,
      active: 0,
      vip: 0,
      'at-risk': 0,
      churned: 0,
    } satisfies Record<CustomerSegment, number>;

    for (const customer of customers) {
      for (const segment of customer.segments) {
        segmentBreakdown[segment]++;
      }
    }

    const revenue = orders
      .filter((o) => o.financial_status === 'completed' || o.financial_status === 'processing')
      .reduce((sum, o) => sum + safeParseCurrency(o.total), 0);

    const recentOrders = await orderService.recent(8);

    return {
      customers: customers.length,
      orders: orders.length,
      revenue,
      at_risk_count: atRiskCount,
      segment_breakdown: {
        new: segmentBreakdown.new,
        active: segmentBreakdown.active,
        vip: segmentBreakdown.vip,
        'at-risk': segmentBreakdown['at-risk'],
        churned: segmentBreakdown.churned,
      },
      recent_orders: await Promise.all(
        recentOrders.map(async (order) => {
          const customer = await customerRepository.findById(order.customer_id);
          if (customer) {
            return { ...order, customer: recomputeCustomerSegments(customer) };
          }
          return order;
        }),
      ),
    };
  },
};

function safeParseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}
