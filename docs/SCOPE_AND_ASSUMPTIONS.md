# Scope and Assumptions — WooPulse CRM

## What this is
WooPulse CRM is a customer-relationship system that sits on top of a WooCommerce store. It ingests customers and orders, surfaces a dashboard and per-customer view, tracks order status, and includes an AI "Retention Agent" that drafts personalised customer communications for human approval.

## In scope (for this hackathon build)
- Sync from WooCommerce (button + API route) using a WooCommerce client adapter.
- Webhook endpoint `POST /api/webhooks/woocommerce` for `order.created`, `order.updated`, `customer.created`, with HMAC-SHA256 signature verification and idempotent handling.
- Customer management: searchable/filterable table by segment, customer detail with profile, lifetime value, order history, notes, tags.
- Order tracking: orders list with status filter, order detail with status timeline, webhook-driven status updates reflected in the UI.
- Dashboard: KPI cards (customers, orders, revenue, at-risk count), segment breakdown chart, recent orders.
- Communication workflows: message templates (order confirmation, win-back, VIP thank-you), a queue of drafts with status `draft -> approved -> sent`, human-in-the-loop approval before "send", simulated sending logged for demo.
- Retention Agent: tool-calling agent loop using Gemini function calling with tools `get_customer_profile`, `get_customer_orders`, `list_at_risk_customers`, `create_message_draft`, `tag_customer`. Human approval required; agent never sends.
- Tests: unit tests via Vitest for signature verification, idempotency, segmentation, sync upsert, agent dispatch, zod schemas; 1–2 Playwright e2e tests.
- Documentation: README, ARCHITECTURE, SCOPE_AND_ASSUMPTIONS, OPERATIONS, AI_USAGE, VIDEO_NOTES.

## Out of scope (explicit)
- Real email sending. Sending is simulated and logged.
- Persistent storage beyond an in-memory store seeded from fixtures. Postgres/Supabase swap is documented but not implemented here.
- Production WooCommerce setup. Live mode is wired but not required; mock mode is the default demo path.
- Multi-store support.
- CSV export, per-customer activity timeline, and Supabase repository implementation are stretch items only if time remains.

## Assumptions
1. Single WooCommerce store; no multi-site.
2. Mock mode is the default so the demo works offline with ~25 customers and ~80 orders in fixtures.
3. Live mode uses WooCommerce REST API v3 with consumer key/secret from env; webhook secret from env.
4. Email sending is simulated and logged; human approves drafts before "send".
5. Default persistence is an in-memory store on `globalThis`, seeded from fixtures. Documented limitation: serverless instances do not share memory. A clear swap point is kept for a Postgres/Supabase repository later.
6. If `GEMINI_API_KEY` is absent, the Retention Agent runs in a deterministic template fallback so the app never breaks in the demo. If present, the agent uses Gemini function calling.
7. `GEMINI_MODEL` defaults to `gemini-3.8-flash` if unset.
8. Webhook signature uses base64-encoded HMAC-SHA256 of the raw body, compared with a timing-safe function.
9. Segment thresholds (New, Active, VIP, At-risk, Churned) are configurable constants in the SegmentationService.
10. Order financial status maps to our internal `OrderStatus` set: `pending`, `processing`, `completed`, `cancelled`, `refunded`.
11. This is a single-repo Next.js App Router app; UI and API route handlers live together.
12. The 2-minute video is handled separately; this repo keeps `VIDEO_NOTES.md` with talking points.

## Known limitations
- In-memory persistence is lost on redeploy/Serverless cold start; not suitable for multi-instance production.
- Mock fixtures are static; they are not refreshed from a live store unless sync is run in live mode.
- Simulated sending does not integrate with a real ESP.
- Retention Agent output is constrained by the tool set and prompt; it is assistive, not authoritative.

## Future work
- Swap in-memory repo for a Postgres/Supabase repository implementation behind the same repository interfaces.
- Real email sending via an ESP with template rendering and delivery logging.
- Webhook replay / delivery-failure handling and retry.
- Customer activity timeline and CSV export.
- Agent observability: persisted agent runs, step logs, and rollback of drafts.
- Role-based access, audit log, and rate limiting on the webhook endpoint.
