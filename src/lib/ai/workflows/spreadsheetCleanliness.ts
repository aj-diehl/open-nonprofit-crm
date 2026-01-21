import { z } from "zod";
import { runWorkflow } from "@/lib/ai/runs";
import { runAgentJson } from "@/lib/ai/agents/runtime";
import { MODELS } from "@/lib/ai/models";

const cleanlinessSchema = z.object({
  consistent: z.boolean(),
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

export type CleanlinessReport = z.infer<typeof cleanlinessSchema>;

export async function runSpreadsheetCleanlinessAgent({
  orgId,
  userId,
  jobId,
  importType,
  headers,
  sampleRows,
}: {
  orgId: string;
  userId: string;
  jobId: string;
  importType: "donations" | "donors";
  headers: string[];
  sampleRows: Record<string, any>[];
}) {
  const instructions = `
You are a spreadsheet data quality evaluator for a nonprofit CRM.
Given headers and sample rows, decide if the sheet is consistent enough to auto-import without review.

Output JSON only. No markdown.

Return:
{
  "consistent": true|false,
  "confidence": 0.0-1.0,
  "notes": "short human summary",
  "warnings": ["short bullet", ...]
}

Mark inconsistent if:
- columns appear to mix multiple schemas or data types
- key fields are ambiguous or sparsely populated
- identifiers are non-unique (row numbers, sequential ids)
`.trim();

  const input = {
    importType,
    headers,
    sampleRows,
  };

  const { output } = await runWorkflow({
    orgId,
    userId,
    workflow: "spreadsheet_cleanliness",
    input,
    fn: async () => {
      const res = await runAgentJson<CleanlinessReport>({
        name: "SpreadsheetCleanlinessAgent",
        workflow: "spreadsheet_cleanliness",
        model: MODELS.fast,
        instructions,
        input,
        traceGroupId: jobId,
        traceMetadata: { orgId, importType },
      });

      const report = cleanlinessSchema.parse(res.output);
      return { output: report, traceId: res.traceId };
    },
  });

  return output;
}
