 # WooPulse CRM
WooPulse is a WooCommerce-connected CRM demo for customer data, order tracking, customer segmentation, and human-approved retention messaging.

## Demo In 60 Seconds

The project works offline by default. It includes realistic customer and order fixtures in `fixtures/`, so you do not need a WooCommerce store or API credentials to present the demo.

1. Install dependencies and start the app.
2. Open `http://localhost:3000`.
3. Click **Sync from WooCommerce** in the dashboard.
4. The app imports the mock customers and orders into the in-memory repositories.
5. Open Customers, Orders, or Communications to explore the populated CRM.
6. Open Agent and run the Retention Agent. Without a Gemini key it uses the deterministic fallback and creates drafts for human approval.

The sync button is the demo's ingestion action. In mock mode it simulates pulling data from WooCommerce, runs the same idempotent upsert flow as a live sync, and reports how many records were imported or updated. The page refreshes automatically after a successful sync.

## What Is Included

- Dashboard KPIs, revenue, recent orders, and customer segment breakdown
- Searchable customers with segments, tags, notes, lifetime value, and order history
- Order list, status filters, detail pages, and status timelines
- WooCommerce sync adapter with offline mock mode and live REST API mode
- WooCommerce webhook endpoint with HMAC-SHA256 signature verification
- Communication drafts with draft -> approved -> sent human approval flow
- Retention Agent with Gemini tool calling, live activity steps, validation, an eight-round cap, and deterministic fallback behavior
- Vitest and Playwright test setup

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then click **Sync from WooCommerce**.

Useful commands:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

## Configuration

Copy `.env.example` to `.env.local` when you want to configure the optional integrations.

### Offline Demo Mode

This is the default. The sync route uses the fixture adapter and does not call an external service.

```env
NEXT_PUBLIC_SYNC_MODE=mock
```

### Gemini Retention Agent

Without `GEMINI_API_KEY`, the Agent page still works using deterministic template drafts. To enable Gemini function calling:

```env
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.8-flash
```

The agent never sends messages automatically. It can create drafts and tags, but a human must approve a draft before simulated sending.

### Live WooCommerce Mode

To use a real WooCommerce store, configure the REST API credentials and set the sync mode to live:

```env
NEXT_PUBLIC_SYNC_MODE=live
WOOCOMMERCE_URL=https://your-store.example.com
WOOCOMMERCE_CONSUMER_KEY=ck_your_key
WOOCOMMERCE_CONSUMER_SECRET=cs_your_secret
WOOCOMMERCE_WEBHOOK_SECRET=your_webhook_secret
```

The live adapter uses WooCommerce REST API v3. If live credentials are missing, the sync route falls back to mock mode so the demo remains usable.

## How Data Is Stored

The default repositories are in-memory and seeded from `fixtures/customers.ts` and `fixtures/orders.ts`. Sync is idempotent: running it repeatedly updates existing records by id instead of creating duplicates.

This is intentionally suitable for a local hackathon demo, not production persistence. Serverless instances do not share memory, so a production deployment should replace the repository implementations with Postgres or Supabase.

## API Surface

| Route | Purpose |
| --- | --- |
| `POST /api/sync` | Import mock or live WooCommerce customers and orders |
| `POST /api/webhooks/woocommerce` | Process signed order and customer webhooks |
| `GET /api/customers` | Search and filter customers |
| `GET /api/orders` | List orders and filter by status or customer |
| `GET /api/dashboard` | Return CRM KPIs and recent orders |
| `POST /api/agent` | Run the Retention Agent |
| `GET /api/communications` | List communication drafts |

## Project Structure

```text
src/
  agent/                    Agent UI and activity presentation
  app/                      App Router pages and API route handlers
  components/               Shared layout, controls, and sync action
  domain/                   Framework-independent domain types
  integrations/woocommerce/ WooCommerce adapter interface and clients
  lib/                      Validation, AI, and webhook helpers
  repositories/             In-memory repository implementations
  services/                 Customer, order, communication, and sync services
fixtures/                   Offline customers and orders used by the demo
tests/                      Unit and Playwright test locations
docs/                       Architecture, scope, operations, and video notes
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Scope and assumptions](docs/SCOPE_AND_ASSUMPTIONS.md)
- [Operations](docs/OPERATIONS.md)
- [AI usage log](docs/AI_USAGE.md)
- [Video notes](docs/VIDEO_NOTES.md)

## Deployment

Deploy the Next.js app to Vercel, add the required environment variables in the Vercel project settings, and redeploy. Use mock mode for a self-contained review demo. For a live store, configure WooCommerce webhooks to call:

```text
https://your-vercel-domain.example.com/api/webhooks/woocommerce
```

The webhook secret in WooCommerce must match `WOOCOMMERCE_WEBHOOK_SECRET`.

## Known Limitations

- In-memory data is reset when the server process or serverless instance is replaced.
- Sending is simulated and does not deliver email.
- The live WooCommerce adapter requires valid REST API credentials.
- Unit test coverage and end-to-end coverage are still being expanded.
