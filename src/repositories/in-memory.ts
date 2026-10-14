import type { Customer, Order, Message } from '../domain';
import { MOCK_CUSTOMERS } from '../../fixtures/customers';
import { MOCK_ORDERS } from '../../fixtures/orders';

// ---------------------------------------------------------------------------
// In-memory repositories.
// Limitation: serverless instances do not share memory. This is intentional for
// the demo. A Postgres/Supabase implementation can be swapped behind the same
// interfaces later — see docs/ARCHITECTURE.md.
// ---------------------------------------------------------------------------

let customers: Customer[] = [...MOCK_CUSTOMERS];
let orders: Order[] = [...MOCK_ORDERS];
let messages: Message[] = [];

// Reset helper used by tests to get a clean store without affecting other tests.
export function resetInMemoryStore(): void {
  customers = [...MOCK_CUSTOMERS];
  orders = [...MOCK_ORDERS];
  messages = [];
}

export function getInMemoryCustomers(): Customer[] {
  return customers;
}

export function getInMemoryOrders(): Order[] {
  return orders;
}

export function getInMemoryMessages(): Message[] {
  return messages;
}

// ---------------------------------------------------------------------------
// Customer repository
// ---------------------------------------------------------------------------

export const customerRepository = {
  async findAll(): Promise<Customer[]> {
    return [...customers];
  },

  async findById(id: string): Promise<Customer | undefined> {
    return customers.find((c) => c.id === id);
  },

  async findByEmail(email: string): Promise<Customer | undefined> {
    const lower = email.toLowerCase();
    return customers.find((c) => c.email.toLowerCase() === lower);
  },

  async upsert(customer: Customer): Promise<Customer> {
    const existingIndex = customers.findIndex((c) => c.id === customer.id);
    if (existingIndex >= 0) {
      customers = [
        ...customers.slice(0, existingIndex),
        customer,
        ...customers.slice(existingIndex + 1),
      ];
      return customer;
    }
    customers = [...customers, customer];
    return customer;
  },

  async addTag(customerId: string, tag: string): Promise<Customer | undefined> {
    const customer = await customerRepository.findById(customerId);
    if (!customer) return undefined;
    if (!customer.tags.includes(tag)) {
      customer.tags = [...customer.tags, tag];
    }
    return customerRepository.upsert(customer);
  },

  async search(query: string): Promise<Customer[]> {
    if (!query.trim()) return [...customers];
    const q = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  },

  async bySegment(segment: string): Promise<Customer[]> {
    return customers.filter((c) => c.segments.includes(segment as Customer['segments'][number]));
  },
};

// ---------------------------------------------------------------------------
// Order repository
// ---------------------------------------------------------------------------

export const orderRepository = {
  async findAll(): Promise<Order[]> {
    return [...orders];
  },

  async findById(id: string): Promise<Order | undefined> {
    return orders.find((o) => o.id === id);
  },

  async findByCustomerId(customerId: string): Promise<Order[]> {
    return orders.filter((o) => o.customer_id === customerId);
  },

  async upsert(order: Order): Promise<Order> {
    const existingIndex = orders.findIndex((o) => o.id === order.id);
    if (existingIndex >= 0) {
      orders = [
        ...orders.slice(0, existingIndex),
        order,
        ...orders.slice(existingIndex + 1),
      ];
      return order;
    }
    orders = [order, ...orders];
    return order;
  },

  async updateStatus(orderId: string, status: Order['financial_status'], note?: string): Promise<Order | undefined> {
    const order = await orderRepository.findById(orderId);
    if (!order) return undefined;
    order.financial_status = status;
    order.date_modified = new Date().toISOString();
    const event: Order['status_timeline'][number] = {
      date_created: new Date().toISOString(),
      note: note ?? `Status changed to ${status}.`,
      status,
      payment_status: status === 'completed' ? 'paid' : status === 'cancelled' ? 'cancelled' : status === 'refunded' ? 'refunded' : 'pending',
    };
    order.status_timeline = [...order.status_timeline, event];
    return orderRepository.upsert(order);
  },

  async byStatus(status: Order['financial_status']): Promise<Order[]> {
    return orders.filter((o) => o.financial_status === status);
  },

  async recent(limit: number): Promise<Order[]> {
    return [...orders]
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
      .slice(0, limit);
  },
};

// ---------------------------------------------------------------------------
// Message repository
// ---------------------------------------------------------------------------

export const messageRepository = {
  async findAll(): Promise<Message[]> {
    return [...messages];
  },

  async findById(id: string): Promise<Message | undefined> {
    return messages.find((m) => m.id === id);
  },

  async findByCustomerId(customerId: string): Promise<Message[]> {
    return messages.filter((m) => m.customer_id === customerId);
  },

  async findByStatus(status: Message['status']): Promise<Message[]> {
    return messages.filter((m) => m.status === status);
  },

  async create(message: Message): Promise<Message> {
    messages = [message, ...messages];
    return message;
  },

  async update(message: Message): Promise<Message> {
    const index = messages.findIndex((m) => m.id === message.id);
    if (index < 0) throw new Error(`Message ${message.id} not found.`);
    messages = [
      ...messages.slice(0, index),
      message,
      ...messages.slice(index + 1),
    ];
    return message;
  },

  async recent(limit: number): Promise<Message[]> {
    return [...messages].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ).slice(0, limit);
  },
};
