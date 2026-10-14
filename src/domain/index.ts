// ---------------------------------------------------------------------------
// Domain types — pure data and business concepts. No framework code.
// ---------------------------------------------------------------------------

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';

export type CustomerSegment =
  | 'new'
  | 'active'
  | 'vip'
  | 'at-risk'
  | 'churned';

export type MessageStatus = 'draft' | 'approved' | 'sent' | 'rejected';

export type CommunicationTemplate =
  | 'order_confirmation'
  | 'winback'
  | 'vip_thankyou';

export interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  username?: string;
  date_created: string; // ISO-8601
  date_modified?: string;
  bad: boolean;
  segments: CustomerSegment[];
  tags: string[];
  notes: string[];
  lifetime_value: number;
  order_count: number;
  last_order_at?: string;
  locale?: string;
  avatar_url?: string;
  billing_address?: Address;
  shipping_address?: Address;
}

export interface Address {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state?: string;
  postcode?: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface Order {
  id: string;
  parent_id?: string;
  number: number;
  order_key: string;
  created_via: string;
  currency: string;
  currency_symbol: string;
  financial_status: OrderStatus;
  fulfillment_status?: 'fulfilled' | 'unfulfilled' | 'partial';
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  cart_hash?: string;
  customer_id: string;
  customer: Customer;
  date_created: string;
  date_modified?: string;
  date_paid?: string;
  date_completed?: string;
  total: string;
  subtotal: string;
  subtotal_tax: string;
  shipping_tax: string;
  total_tax: string;
  shipping: string;
  meta_data: Record<string, unknown>[];
  tax_lines: OrderLine[];
  shipping_lines: OrderLine[];
  line_items: OrderLine[];
  status_timeline: StatusEvent[];
}

export interface OrderLine {
  id: string;
  name: string;
  product_id?: number;
  variation_id?: number;
  quantity: number;
  subtotal: string;
  total: string;
  tax?: string;
  meta_data: Record<string, unknown>[];
}

export interface StatusEvent {
  date_created: string;
  note: string;
  status: OrderStatus;
  payment_status?: 'pending' | 'paid' | 'cancelled' | 'failed' | 'refunded' | 'abandoned';
}

export interface CustomerNote {
  id: string;
  note: string;
  created_at: string;
  author?: string;
}

export interface Message {
  id: string;
  customer_id: string;
  template?: CommunicationTemplate;
  subject: string;
  body: string;
  reason?: string;
  status: MessageStatus;
  created_by: 'agent' | 'manual';
  created_at: string;
  sent_at?: string;
  agent_step?: string;
}

export type KikDashboardMetric =
  | 'customers'
  | 'orders'
  | 'revenue'
  | 'at_risk_count';

export interface DashboardMetrics {
  customers: number;
  orders: number;
  revenue: number;
  at_risk_count: number;
  segment_breakdown: Record<CustomerSegment, number>;
  recent_orders: Order[];
}

export interface AgentStep {
  id: string;
  kind: 'tool_call' | 'tool_result' | 'reasoning' | 'draft_created' | 'error';
  tool?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  note?: string;
  timestamp: string;
}

export interface AgentRun {
  run_id: string;
  status: 'running' | 'completed' | 'failed' | 'fallback';
  started_at: string;
  completed_at?: string;
  steps: AgentStep[];
  drafts_created: number;
  fallback_used: boolean;
  error?: string;
}
