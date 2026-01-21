import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MODELS } from "@/lib/ai/models";
import { runWorkflow } from "@/lib/ai/runs";
import { runAgentJson } from "@/lib/ai/agents/runtime";
import { retrieveContext } from "@/lib/ai/context/retrieve";
import { z } from "zod";

const outputSchema = z.object({
  subject: z.string().optional(),
  body: z.string(),
  metadata: z.record(z.any()).optional(),
});

export async function runCommsWorkflow({
  orgId,
  userId,
  input,
  runId,
}: {
  orgId: string;
  userId: string;
  input: { type: "email" | "newsletter" | "article"; title: string; audience?: string; goal: string; tone?: string; length?: string; callToAction?: string };
  runId?: string;
}): Promise<{ subject?: string; body: string; metadata?: any; agentRunId: string }> {
  const workflow = "comms_draft";

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("org_profiles").select("*").eq("org_id", orgId).single();

  const query = [input.title, input.audience ? `Audience: ${input.audience}` : "", input.goal].filter(Boolean).join("\n");
  const chunks = await retrieveContext({ orgId, query, limit: 10 });

  const instructions = `
You are a communications director for a nonprofit.

Write a high-quality draft based on:
- The organization's approved profile
- The retrieved context snippets

Requirements:
- Output JSON only.
- JSON format:
  { "subject": "..." (optional), "body": "...", "metadata": {...} }
- If type is "article", subject may be omitted and the body should be in article format with headings.
- If type is "email" or "newsletter", include a subject line and use scannable formatting.
- Avoid making up facts. If unsure, use placeholders like "[insert metric]" and lower specificity.

Style:
- Match requested tone and length.
- Always include a clear call-to-action if provided.
`.trim();

  const wfInput = { ...input, org_profile: profile || {}, context_snippets: chunks.map((c) => ({ id: c.chunk_id, content: c.content })) };

  const res = await runWorkflow({
    orgId,
    userId,
    workflow,
    input: wfInput,
    runId,
    fn: async () => {
      const out = await runAgentJson<any>({
        name: "CommsDraftAgent",
        workflow,
        model: MODELS.fast,
        instructions,
        input: wfInput,
        traceGroupId: orgId,
        traceMetadata: { orgId, type: input.type },
      });

      const parsed = outputSchema.parse(out.output);
      return { output: parsed, traceId: out.traceId };
    },
  });

  return { ...res.output, agentRunId: res.agentRunId };
}
