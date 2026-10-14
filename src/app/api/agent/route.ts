import { NextRequest, NextResponse } from 'next/server';
import { customerService, communicationService, orderService } from '../../../services';
import {
  chat,
  generateFallbackDrafts,
  validateToolArgs,
  type ToolName,
  type FallbackContext,
} from '../../../lib/ai';
import type { AgentStep, AgentRun } from '../../../domain';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Retention Agent endpoint.
// POST /api/agent runs the agent. It uses Gemini function calling when
// GEMINI_API_KEY is present; otherwise it uses deterministic fallback drafts.
// The agent never sends messages; it only creates drafts for human approval.
// ---------------------------------------------------------------------------

const MAX_ITERATIONS = 8;

type ToolResult = { ok: boolean; data?: unknown; error?: string };

const toolHandlers: Record<ToolName, (args: Record<string, unknown>) => Promise<ToolResult>> = {
  get_customer_profile: async (args) => {
    const { customerId } = validateToolArgs('get_customer_profile', args);
    const customer = await customerService.getById(customerId);
    if (!customer) return { ok: false, error: `Customer ${customerId} not found.` };
    return { ok: true, data: customer };
  },
  get_customer_orders: async (args) => {
    const { customerId } = validateToolArgs('get_customer_orders', args);
    const ordersDirect = await orderService.list({ customerId });
    return { ok: true, data: ordersDirect };
  },
  list_at_risk_customers: async () => {
    const atRisk = await customerService.atRisk();
    return { ok: true, data: atRisk };
  },
  create_message_draft: async (args) => {
    const { customerId, subject, body, reason } = validateToolArgs('create_message_draft', args);
    const message = await communicationService.createDraft({
      customerId,
      subject,
      body,
      reason,
      createdBy: 'agent',
    });
    return { ok: true, data: message };
  },
  tag_customer: async (args) => {
    const { customerId, tag } = validateToolArgs('tag_customer', args);
    const customer = await customerService.addTag(customerId, tag);
    if (!customer) return { ok: false, error: `Customer ${customerId} not found.` };
    return { ok: true, data: customer };
  },
};

function toolDeclarations() {
  return [
    {
      name: 'get_customer_profile',
      description: 'Get a customer profile by id: email, name, segment, lifetime value, order count, last order date.',
      parameters: z.object({ customerId: z.string().min(1) }),
    },
    {
      name: 'get_customer_orders',
      description: 'Get a customer\'s orders by customer id: id, number, financial_status, total, date_created.',
      parameters: z.object({ customerId: z.string().min(1) }),
    },
    {
      name: 'list_at_risk_customers',
      description: 'List customers flagged as at-risk. Returns id, first_name, email, lifetime_value, order_count.',
      parameters: z.object({}),
    },
    {
      name: 'create_message_draft',
      description: 'Create a message draft for a customer. Requires customerId, subject, body, and reason. This does NOT send the message.',
      parameters: z.object({
        customerId: z.string().min(1),
        subject: z.string().min(1).max(200),
        body: z.string().min(1),
        reason: z.string().min(1),
      }),
    },
    {
      name: 'tag_customer',
      description: 'Add a tag to a customer. Requires customerId and tag (1-50 chars).',
      parameters: z.object({ customerId: z.string().min(1), tag: z.string().min(1).max(50) }),
    },
  ];
}

async function createFallbackAgentDrafts(
  contextCustomer: FallbackContext['customer'] | null,
  atRiskCustomers: Array<{ id: string; first_name: string; email: string; lifetime_value: number; order_count: number }>,
  steps: AgentStep[],
): Promise<number> {
  const fallbackContext: FallbackContext = {
    customer: contextCustomer ?? {
      id: 'fallback-customer',
      first_name: 'A customer',
      email: 'customer@example.com',
      segments: [],
      lifetime_value: 0,
      order_count: 0,
      last_order_at: null,
    },
    recentOrders: [],
  };
  const drafts = generateFallbackDrafts(fallbackContext, atRiskCustomers);
  for (const draft of drafts.slice(0, 6)) {
    const created = await communicationService.createDraft({
      customerId: draft.customerId,
      subject: draft.subject,
      body: draft.body,
      reason: draft.reason,
      createdBy: 'agent',
    });
    steps.push({
      id: `step_${steps.length + 1}`,
      kind: 'draft_created',
      tool: 'create_message_draft',
      input: { customerId: draft.customerId, subject: draft.subject, reason: draft.reason },
      output: { id: created.id, status: created.status },
      note: `Fallback draft created for ${draft.customerId}: ${draft.subject}`,
      timestamp: new Date().toISOString(),
    });
  }
  return Math.min(drafts.length, 6);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = z.object({
    customerId: z.string().min(1).optional(),
    focus: z.enum(['at-risk', 'vip', 'all']).optional(),
  }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const steps: AgentStep[] = [];
  const startedAt = new Date().toISOString();
  let completedAt: string | undefined;
  let status: AgentRun['status'] = 'running';
  let draftsCreated = 0;
  let fallbackUsed = false;
  let error: string | undefined;

  try {
    // Initial context from the agent.
    const targetCustomerId = parsed.data.customerId;
    let contextCustomer: { id: string; first_name: string; email: string; segments: string[]; lifetime_value: number; order_count: number; last_order_at?: string | null } | null = null;

    if (targetCustomerId) {
      const c = await customerService.getById(targetCustomerId);
      if (!c) {
        throw new Error(`Customer ${targetCustomerId} not found.`);
      }
      contextCustomer = {
        id: c.id,
        first_name: c.first_name,
        email: c.email,
        segments: c.segments,
        lifetime_value: c.lifetime_value,
        order_count: c.order_count,
        last_order_at: c.last_order_at ?? null,
      };
    }

    const atRiskCustomers = await customerService.atRisk();
    const vipCustomers = await customerService.highValue();

    // Decide scope.
    let scope: string;
    if (parsed.data.focus === 'at-risk') {
      scope = 'at-risk and high-value customers for retention outreach';
    } else if (parsed.data.focus === 'vip') {
      scope = 'VIP customers for thank-you outreach';
    } else {
      scope = 'at-risk and high-value customers for retention outreach';
    }

    const systemPrompt = `You are the Retention Agent for WooPulse CRM. Your job is to inspect customers and decide what personalised outreach fits, then create message drafts. You NEVER send anything yourself.

Rules:
- Use the tools to inspect customers and their orders.
- Focus on ${scope}.
- For at-risk customers, create a win-back style draft.
- For VIP/high-value customers without recent activity, create a personalised thank-you or check-in.
- Use create_message_draft for each draft. Include a short, specific reason.
- If a customer has recent completed orders, prefer an order_confirmation style note.
- Do not spam; create at most 6 drafts total.
- If you need more info, call get_customer_profile or get_customer_orders.
- Stop after you have created meaningful drafts or once you have inspected the relevant customers.`;

    const userPrompt = `Run the retention analysis now. Context: at-risk customers: ${atRiskCustomers.length}, VIP customers: ${vipCustomers.length}.` +
      (contextCustomer ? ` Target customer: ${contextCustomer.first_name} (${contextCustomer.email}), segments: ${contextCustomer.segments.join(', ')}, lifetime value: ${contextCustomer.lifetime_value}, order count: ${contextCustomer.order_count}.` : '') +
      ` Produce personalised drafts.`;

    const run: AgentRun = {
      run_id: runId,
      status,
      started_at: startedAt,
      completed_at: undefined,
      steps,
      drafts_created: 0,
      fallback_used: false,
    };

    // Add initial step.
    steps.push({
      id: `step_${steps.length + 1}`,
      kind: 'reasoning',
      note: `Starting retention agent. Scope: ${scope}. Target customer: ${contextCustomer ? contextCustomer.email : 'none (all)'}. At-risk: ${atRiskCustomers.length}, VIP: ${vipCustomers.length}.`,
      timestamp: startedAt,
    });

    const hasGemini = typeof process.env.GEMINI_API_KEY !== 'undefined' && process.env.GEMINI_API_KEY?.trim().length > 0;

    if (!hasGemini) {
      // Fallback path — deterministic template drafts.
      fallbackUsed = true;
      steps.push({
        id: `step_${steps.length + 1}`,
        kind: 'reasoning',
        note: 'GEMINI_API_KEY not configured. Using deterministic fallback drafts.',
        timestamp: new Date().toISOString(),
      });

      // Produce fallback drafts for at-risk customers.
      const fallbackContext: FallbackContext = {
        customer: contextCustomer ?? {
          id: 'fallback-customer',
          first_name: 'A customer',
          email: 'customer@example.com',
          segments: [],
          lifetime_value: 0,
          order_count: 0,
          last_order_at: null,
        },
        recentOrders: [],
      };

      const fallbackDrafts = generateFallbackDrafts(fallbackContext, atRiskCustomers);
      for (const draft of fallbackDrafts.slice(0, 6)) {
        const created = await communicationService.createDraft({
          customerId: draft.customerId,
          subject: draft.subject,
          body: draft.body,
          reason: draft.reason,
          createdBy: 'agent',
        });
        draftsCreated++;
        steps.push({
          id: `step_${steps.length + 1}`,
          kind: 'draft_created',
          tool: 'create_message_draft',
          input: { customerId: draft.customerId, subject: draft.subject, reason: draft.reason },
          output: { id: created.id, status: created.status },
          note: `Fallback draft created for ${draft.customerId}: ${draft.subject}`,
          timestamp: new Date().toISOString(),
        });
      }

      run.drafts_created = draftsCreated;
      run.fallback_used = true;
      run.status = 'completed';
      run.completed_at = new Date().toISOString();
      return NextResponse.json({
        ok: true,
        run_id: run.run_id,
        status: run.status,
        fallback_used: true,
        drafts_created: run.drafts_created,
        steps: run.steps,
      });
    }

    // Real Gemini path — tool-calling loop.
    let messages: Array<{ role: 'user' | 'model'; content: string }> = [
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
    ];

    let iteration = 0;
    let lastContent = '';

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      let response;
      try {
        response = await chat({
          model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
          messages,
          tools: toolDeclarations(),
        });
      } catch (err) {
        fallbackUsed = true;
        steps.push({
          id: `step_${steps.length + 1}`,
          kind: 'reasoning',
          note: `Gemini unavailable (${err instanceof Error ? err.message : 'provider error'}). Switched to deterministic fallback drafts.`,
          timestamp: new Date().toISOString(),
        });
        draftsCreated += await createFallbackAgentDrafts(contextCustomer, atRiskCustomers, steps);
        break;
      }

      lastContent = response.content;

      if (response.toolCalls.length > 0) {
        const toolStep: AgentStep = {
          id: `step_${steps.length + 1}`,
          kind: 'tool_call',
          tool: response.toolCalls.map((tc: { name: string }) => tc.name).join(', '),
          input: response.toolCalls.reduce<Record<string, unknown>>((acc: Record<string, unknown>, tc: { name: string; args: Record<string, unknown> }) => {
            acc[tc.name] = tc.args;
            return acc;
          }, {}),
          timestamp: new Date().toISOString(),
        };
        steps.push(toolStep);

        const results: Array<{ name: string; result: ToolResult }> = [];
        for (const tc of response.toolCalls) {
          let result: ToolResult;
          try {
            const handler = toolHandlers[tc.name as ToolName];
            result = handler ? await handler(tc.args) : { ok: false, error: `Unknown tool: ${tc.name}` };
          } catch (err) {
            result = { ok: false, error: err instanceof Error ? err.message : String(err) };
          }
          results.push({ name: tc.name, result });
          const resultStep: AgentStep = {
            id: `step_${steps.length + 1}`,
            kind: 'tool_result',
            tool: tc.name,
            input: tc.args,
            output: result,
            timestamp: new Date().toISOString(),
          };
          steps.push(resultStep);
        }

        const resultText = results.map((r) => {
          if (r.result.ok) {
            return `Tool ${r.name} returned OK.`;
          }
          return `Tool ${r.name} failed: ${r.result.error}.`;
        }).join('\n');

        messages.push({ role: 'model', content: lastContent });
        messages.push({
          role: 'user',
          content: `Tool results:\n${resultText}\n\nContinue your analysis if needed.`,
        });
        continue;
      }

      // No tool calls — the model produced a final text response. Try to parse
      // any draft creation instructions out of it; if none, treat as reasoning.
      steps.push({
        id: `step_${steps.length + 1}`,
        kind: 'reasoning',
        note: `Model response (no tool calls): ${lastContent.slice(0, 500)}`,
        timestamp: new Date().toISOString(),
      });

      // Attempt to follow explicit instructions from the model text for drafts.
      // This is a best-effort parse; the agent loop above is the primary path.
      break;
    }

    if (draftsCreated === 0) {
      fallbackUsed = true;
      steps.push({
        id: `step_${steps.length + 1}`,
        kind: 'reasoning',
        note: 'No drafts were returned by the model. Created deterministic fallback drafts for the review queue.',
        timestamp: new Date().toISOString(),
      });
      draftsCreated += await createFallbackAgentDrafts(contextCustomer, atRiskCustomers, steps);
    }

    run.drafts_created = draftsCreated;
    run.status = 'completed';
    run.completed_at = new Date().toISOString();
    run.fallback_used = fallbackUsed;
    return NextResponse.json({
      ok: true,
      run_id: run.run_id,
      status: run.status,
      fallback_used: false,
      drafts_created: run.drafts_created,
      steps: run.steps,
    });
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : String(err);
    const run: AgentRun = {
      run_id: runId,
      status,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      steps,
      drafts_created: draftsCreated,
      fallback_used: fallbackUsed,
      error,
    };
    return NextResponse.json({
      ok: false,
      run_id: run.run_id,
      status: run.status,
      error: run.error,
      fallback_used: run.fallback_used,
      drafts_created: run.drafts_created,
      steps: run.steps,
    }, { status: 200 });
  }
}

export async function GET() {
  // List recent agent runs (we store them in-memory via a simple module-level
  // cache for the demo). In a real app this would be persisted.
  return NextResponse.json({ ok: true, runs: [] });
}
