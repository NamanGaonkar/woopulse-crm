import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// AI wrapper — thin boundary around the Gemini SDK.
// When GEMINI_API_KEY is absent, we do NOT call the model; instead the agent
// uses a deterministic template fallback so the demo never breaks.
// ---------------------------------------------------------------------------

const ai = new GoogleGenAI();

export type GeminiConfig = {
  apiKey: string;
  model: string;
};

export function getGeminiConfig(): GeminiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
  if (!apiKey.trim()) {
    return null;
  }
  return { apiKey, model };
}

export type ChatRequest = {
  model: string;
  messages: Array<{ role: 'user' | 'model'; content: string }>;
  tools?: Array<{
    name: string;
    description: string;
    parameters: z.ZodSchema;
  }>;
};

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type ChatResponse = {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string;
};

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const config = getGeminiConfig();
  if (!config) {
    // No API key — return a deterministic fallback response with no tool calls.
    return {
      content: 'FALLBACK_NO_KEY',
      toolCalls: [],
      finishReason: 'fallback',
    };
  }

  const requestPromise = ai.models.generateContent({
      model: config.model,
      contents: request.messages.map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      config: {
        tools: request.tools?.map((t) => ({
          functionDeclarations: [
            {
              name: t.name,
              description: t.description,
              parameters: {
                type: Type.OBJECT,
                properties: t.parameters instanceof z.ZodObject
                  ? Object.fromEntries(
                    Object.keys(t.parameters.shape).map((k) => [k, { type: Type.STRING }]),
                  )
                  : {},
              },
            },
          ],
        })),
        maxOutputTokens: 2048,
      },
    });
  const result = await Promise.race([
    requestPromise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini request timed out after 12 seconds.')), 12_000);
    }),
  ]);

  const textPart = result?.text ?? '';
  const toolCalls: ToolCall[] = [];

  // Gemini SDK function-calling shape varies by version; we parse the
  // tool-call structure defensively. If the SDK does not surface tool calls
  // in the shape we expect, treat the whole response as text and let the
  // agent loop handle it as a text turn (it will re-issue with tool schema
  // next, or fall back).
  try {
    const functionCalls = result?.functionCalls;
    if (Array.isArray(functionCalls)) {
      for (const call of functionCalls) {
        toolCalls.push({
          name: call.name ?? '',
          args: (call.args ?? {}) as Record<string, unknown>,
        });
      }
    }
  } catch {
    // Parsing failed defensively; proceed with text-only response.
  }

  return {
    content: textPart,
    toolCalls,
    finishReason: result?.candidates?.[0]?.finishReason ?? 'unknown',
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback generator — used when the model is unavailable or
// when GEMINI_API_KEY is missing. Produces sensible, personalised-feeling
// drafts using simple heuristics and the provided customer/order data.
// ---------------------------------------------------------------------------

export type FallbackContext = {
  customer: {
    id: string;
    first_name: string;
    email: string;
    segments: string[];
    lifetime_value: number;
    order_count: number;
    last_order_at?: string | null;
  };
  recentOrders: Array<{
    id: string;
    number: number;
    financial_status: string;
    total: string;
    date_created: string;
  }>;
};

export function generateFallbackDrafts(
  context: FallbackContext,
  atRiskCustomers: Array<{ id: string; first_name: string; email: string; lifetime_value: number; order_count: number }>,
): Array<{ customerId: string; subject: string; body: string; reason: string }> {
  const drafts: Array<{ customerId: string; subject: string; body: string; reason: string }> = [];

  // At-risk customers get a win-back draft.
  for (const customer of atRiskCustomers) {
    if (drafts.length >= 5) break;
    const reason = `Customer ${customer.first_name} (${customer.email}) is flagged at-risk with ${customer.order_count} order(s) and lifetime value ${customer.lifetime_value}. A win-back message may help re-engage them.`;
    const subject = `We miss you, ${customer.first_name} — here’s a little something`;
    const body = `Hi ${customer.first_name},\n\nIt’s been a while since we last saw you, and we’d love to welcome you back.\n\nYou’ve placed ${customer.order_count} order(s) with us, and your lifetime value with us is ${customer.lifetime_value}. We’d love to help you get back on track.\n\nHope to see you soon,\nThe WooPulse Team`;
    drafts.push({ customerId: customer.id, subject, body, reason });
  }

  // High-value customers get a VIP thank-you draft.
  const highValue = context.customer.segments.includes('vip');
  if (highValue && drafts.length < 6) {
    const reason = `Customer ${context.customer.first_name} (${context.customer.email}) is a VIP with lifetime value ${context.customer.lifetime_value} across ${context.customer.order_count} orders. A personalised thank-you is appropriate.`;
    const subject = `A quick thank you from the team, ${context.customer.first_name}`;
    const body = `Hi ${context.customer.first_name},\n\nThank you for being such a valued customer. We genuinely appreciate your continued support — your lifetime value with us is ${context.customer.lifetime_value} across ${context.customer.order_count} orders.\n\nIf there’s anything we can do for you, just let us know.\n\nWarm regards,\nThe WooPulse Team`;
    drafts.push({ customerId: context.customer.id, subject, body, reason });
  }

  // If nothing matched, produce a generic follow-up for the given customer.
  if (drafts.length === 0) {
    const reason = `No specific segment matched for ${context.customer.first_name} (${context.customer.email}); producing a generic personalised follow-up based on their ${context.customer.order_count} order(s).`;
    const subject = `Checking in, ${context.customer.first_name}`;
    const body = `Hi ${context.customer.first_name},\n\nJust checking in — we hope you’re doing well. You’ve placed ${context.customer.order_count} order(s) with us, and we’d love to hear how we can help.\n\nWarm regards,\nThe WooPulse Team`;
    drafts.push({ customerId: context.customer.id, subject, body, reason });
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Tool argument validation — all agent tool args are validated with zod before
// execution, so the agent can never call a tool with invalid data.
// ---------------------------------------------------------------------------

export type ToolName =
  | 'get_customer_profile'
  | 'get_customer_orders'
  | 'list_at_risk_customers'
  | 'create_message_draft'
  | 'tag_customer';

export const TOOL_SCHEMAS = {
  get_customer_profile: z.object({ customerId: z.string().min(1) }),
  get_customer_orders: z.object({ customerId: z.string().min(1) }),
  list_at_risk_customers: z.object({}),
  create_message_draft: z.object({
    customerId: z.string().min(1),
    subject: z.string().min(1).max(200),
    body: z.string().min(1),
    reason: z.string().min(1),
  }),
  tag_customer: z.object({ customerId: z.string().min(1), tag: z.string().min(1).max(50) }),
} satisfies Record<ToolName, z.ZodSchema>;

type ToolArgs = {
  [T in ToolName]: z.infer<(typeof TOOL_SCHEMAS)[T]>;
};

export function validateToolArgs<T extends ToolName>(
  toolName: T,
  args: Record<string, unknown>,
): ToolArgs[T] {
  const parsed = TOOL_SCHEMAS[toolName].safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid args for tool ${toolName}: ${parsed.error.message}`);
  }
  return parsed.data as ToolArgs[T];
}
