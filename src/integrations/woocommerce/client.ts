import type { Customer, Order } from '../../domain';

// ---------------------------------------------------------------------------
// WooCommerceClient adapter — decouples the app from the WooCommerce transport.
// MockWooCommerceClient (default) reads fixtures so the demo runs offline.
// LiveWooCommerceClient would hit the WooCommerce REST API v3 when configured.
// ---------------------------------------------------------------------------

export type WooCommerceClientMode = 'mock' | 'live';

export interface WooCommerceClient {
  mode: WooCommerceClientMode;
  getCustomers(): Promise<Customer[]>;
  getOrders(): Promise<Order[]>;
}

// ---------------------------------------------------------------------------
// Mock client — deterministic, offline, realistic fixture data.
// ---------------------------------------------------------------------------

export class MockWooCommerceClient implements WooCommerceClient {
  mode: WooCommerceClientMode = 'mock';

  async getCustomers(): Promise<Customer[]> {
    const { MOCK_CUSTOMERS } = await import('../../../fixtures/customers');
    return [...MOCK_CUSTOMERS];
  }

  async getOrders(): Promise<Order[]> {
    const { MOCK_ORDERS } = await import('../../../fixtures/orders');
    return [...MOCK_ORDERS];
  }
}

// ---------------------------------------------------------------------------
// Live client interface — implemented when WOOCOMMERCE_URL + credentials are
// configured. Stubs here keep the app runnable without a network dependency in
// mock mode. The real HTTP implementation is wired behind the same interface.
// ---------------------------------------------------------------------------

export class LiveWooCommerceClient implements WooCommerceClient {
  mode: WooCommerceClientMode = 'live';

  private baseUrl: string;
  private consumerKey: string;
  private consumerSecret: string;

  constructor({
    baseUrl,
    consumerKey,
    consumerSecret,
  }: {
    baseUrl: string;
    consumerKey: string;
    consumerSecret: string;
  }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }

  async getCustomers(): Promise<Customer[]> {
    // Live implementation would call:
    // GET ${baseUrl}/wp-json/wc/v3/customers
    // with Basic auth (consumerKey:consumerSecret), per WooCommerce REST API v3.
    throw new Error(
      'LiveWooCommerceClient.getCustomers is not implemented in this build. ' +
        'Configure WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, and ' +
        'WOOCOMMERCE_CONSUMER_SECRET to enable live sync.',
    );
  }

  async getOrders(): Promise<Order[]> {
    // Live implementation would call:
    // GET ${baseUrl}/wp-json/wc/v3/orders
    // with Basic auth (consumerKey:consumerSecret), per WooCommerce REST API v3.
    throw new Error(
      'LiveWooCommerceClient.getOrders is not implemented in this build. ' +
        'Configure WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, and ' +
        'WOOCOMMERCE_CONSUMER_SECRET to enable live sync.',
    );
  }
}

// ---------------------------------------------------------------------------
// Factory — keep a single swap point for the client used by sync.
// ---------------------------------------------------------------------------

export function createWooCommerceClient(mode: WooCommerceClientMode = 'mock'): WooCommerceClient {
  if (mode === 'live') {
    const baseUrl = process.env.WOOCOMMERCE_URL ?? '';
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY ?? '';
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET ?? '';
    if (!baseUrl || !consumerKey || !consumerSecret) {
      throw new Error(
        'Live WooCommerce mode requested but WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, ' +
          'and WOOCOMMERCE_CONSUMER_SECRET are required.',
      );
    }
    return new LiveWooCommerceClient({ baseUrl, consumerKey, consumerSecret });
  }
  return new MockWooCommerceClient();
}
