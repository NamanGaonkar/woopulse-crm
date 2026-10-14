# Video Notes — WooPulse CRM

This file keeps talking points for the 2-minute video. The video itself is handled separately; these notes should fit about 2 minutes when spoken naturally.

## Planning-phase script (what to say up front)

Hook (about 15s):
- "This is WooPulse CRM — a lightweight customer relationship system that sits on top of a WooCommerce store and helps a small team track customers, orders, and follow-up communications without leaving their dashboard."

Problem and chosen scope (about 25s):
- "The challenge was to build a CRM that integrates with WooCommerce, covers customer data management, order tracking, and communication workflows, and uses AI well. In four hours I scoped to the highest-value core: sync from WooCommerce, webhook ingestion with signature verification, a searchable customer view, order tracking with a status timeline, a dashboard with KPIs and segment breakdown, a human-in-the-loop message queue with templates, and a Retention Agent that drafts personalised outreach for at-risk and high-value customers."
- "I left out real email sending, persistent storage beyond an in-memory store, and nice-to-haves like CSV export — because a working demo beats an unfinished ambitious one."

Architecture and assumptions (about 40s):
- "Under the hood it's a single Next.js App Router repo. There's a thin API layer, a service layer for business rules, repository interfaces with an in-memory default seeded from fixtures, and a WooCommerce client adapter with a mock implementation so the demo works offline. There's also a live path to the WooCommerce REST API if keys are provided."
- "Key assumptions: single store, mock mode default, email sending simulated and logged, in-memory persistence with a documented swap point for Postgres/Supabase later, and if the Gemini API key is missing the Retention Agent falls back to deterministic template drafts so the app never breaks."

Plan (about 20s):
- "The build order was fixtures and domain types first, then the adapter and repositories, then services, then sync and webhook routes with tests, then the UI pages, then the agent and its tests, then e2e tests, and finally polish and docs. I kept commits small and the app runnable at every step."

## Execution-phase script (what to show in the demo)

What was built (about 25s):
- "What you're seeing is the dashboard: customer count, order count, revenue, at-risk count, a segment breakdown, and recent orders. From here you can open customers and orders, filter by segment or status, and drill into a customer's lifetime value, order history, notes, and tags."

Demo flow (about 40s):
- "Hit 'Sync from WooCommerce' to pull customers and orders through the client adapter — in mock mode that's the fixture data, and in live mode it would hit the WooCommerce REST API. The sync upserts idempotently, so running it twice doesn't duplicate records."
- "Webhooks arrive at `POST /api/webhooks/woocommerce`. The endpoint verifies the `X-WC-Webhook-Signature` header with a base64 HMAC-SHA256 of the raw body and a timing-safe compare, rejects invalid signatures with 401, and handles duplicate deliveries idempotently. Order status changes from webhooks show up in the status timeline on the order detail page."
- "In communications, there are templates for order confirmation, win-back, and VIP thank-you. The agent can draft messages into a queue with status draft, approved, or sent. Nothing is sent without human approval — you approve a draft in the UI and the send is simulated and logged."

AI usage and tests (about 35s):
- "The Retention Agent is the AI centrepiece. When you click 'Run Retention Agent', it uses Gemini function calling with tools to get a customer's profile, their orders, list at-risk customers, create a message draft, and tag customers. It inspects at-risk and high-value customers, decides which outreach fits, and creates personalised drafts with a short reason for each. Every tool argument is validated with zod, iteration count is capped, and errors are handled gracefully."
- "If the Gemini API key is missing, the agent falls back to template-based drafts so the demo still works. The agent's steps — tool calls and results — are shown live in the Agent activity panel."
- "On the quality side, there are unit tests for webhook signature verification, order ingestion idempotency, segmentation strategies and edge cases, sync upsert with the mock client, agent tool-dispatch with a mocked LLM, and zod schemas. There are also end-to-end tests that load the dashboard, sync, open a customer, run the agent in fallback mode, and approve a draft."

Trade-offs (about 20s):
- "The main trade-off is speed against completeness: I chose an in-memory store and mock-first mode so the demo is reliable and fast, and I kept the agent tool set small and safe so it never sends without a human. The clear swap points — the WooCommerce adapter and the repository interfaces — mean this can grow into a real integration later without rewriting the business logic."

That should land around two minutes when spoken at a normal pace. Adjust pacing to the actual demo, and keep the focus on: sync, webhook verification, customer/order views, the message queue with approval, and the Retention Agent's live steps and fallback."
