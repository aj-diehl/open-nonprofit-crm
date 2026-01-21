import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MODELS } from "@/lib/ai/models";
import { runWorkflow } from "@/lib/ai/runs";
import { runAgentJson } from "@/lib/ai/agents/runtime";
import { retrieveContext } from "@/lib/ai/context/retrieve";
import { z } from "zod";

const answerSchema = z.object({
  question_id: z.string(),
  draft: z.string(),
  citations: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

const outputSchema = z.object({
  answers: z.array(answerSchema),
});

export async function runGrantWriterWorkflow({
  orgId,
  userId,
  grant,
  questions,
  runId,
}: {
  orgId: string;
  userId: string;
  grant: any;
  questions: { id: string; question: string; constraints?: string | null; max_words?: number | null }[];
  runId?: string;
}): Promise<{ answers: any[]; agentRunId: string }> {
  const workflow = "grant_writer";

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("org_profiles").select("*").eq("org_id", orgId).single();

  // Retrieve context for each question (top K snippets)
  const contexts: Record<string, any> = {};
  for (const q of questions) {
    const query = [
      grant?.title ? `Grant: ${grant.title}` : "",
      grant?.funder ? `Funder: ${grant.funder}` : "",
      q.question,
    ]
      .filter(Boolean)
      .join("\n");

    const chunks = await retrieveContext({ orgId, query, limit: 10 });
    contexts[q.id] = chunks.map((c) => ({
      id: c.chunk_id,
      document_id: c.document_id,
      similarity: c.similarity,
      content: c.content,
    }));
  }

  const instructions = `
You are an expert nonprofit grant writer.

You must answer each grant question using ONLY the provided organization profile and the provided context snippets.
If a fact is not supported by the inputs, write a conservative, generic statement and mark confidence lower.

Output rules:
- Return JSON only.
- Output format:
  {
    "answers": [
      { "question_id": "...", "draft": "...", "citations": ["chunk:<id>", ...], "confidence": 0.0 }
    ]
  }
- Citations should reference the snippet ids you used, as "chunk:<id>".
- Respect max word limits: if max_words exists, keep the draft within that limit (approximate is fine).

Style:
- Specific, measurable, compelling.
- Avoid fluff. Use active voice.
- Align to the funder and the org's mission.
`.trim();

  const input = {
    grant: {
      id: grant.id,
      title: grant.title,
      funder: grant.funder,
      status: grant.status,
      due_date: grant.due_date,
      requested_amount: grant.requested_amount,
      currency: "USD",
    },
    org_profile: profile || {},
    questions,
    contexts,
  };

  const res = await runWorkflow({
    orgId,
    userId,
    workflow,
    input,
    runId,
    fn: async () => {
      const out = await runAgentJson<any>({
        name: "GrantWriterAgent",
        workflow,
        model: MODELS.deep,
        instructions,
        input,
        traceGroupId: grant.id,
        traceMetadata: { orgId, grantId: grant.id },
      });

      const parsed = outputSchema.parse(out.output);
      return { output: parsed, traceId: out.traceId };
    },
  });

  return { answers: res.output.answers, agentRunId: res.agentRunId };
}
