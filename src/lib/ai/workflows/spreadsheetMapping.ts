import { runWorkflow } from "@/lib/ai/runs";
import { runAgentJson } from "@/lib/ai/agents/runtime";
import { MODELS } from "@/lib/ai/models";
import { donationsMappingSchema, donorsMappingSchema } from "@/lib/import/applyMapping";

export async function runSpreadsheetMappingAgent({
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
  const workflow = importType === "donations" ? "spreadsheet_mapping_donations" : "spreadsheet_mapping_donors";

  const instructions = `
You are a data ingestion mapping agent for a nonprofit CRM.
Your task: Given spreadsheet headers and sample rows, output a STRICT JSON object describing how to map columns into the platform schema.

Rules:
- Output JSON only. No markdown, no commentary.
- Use column names exactly as provided if you map them.
- Try to map every donor field when there is any signal in headers or sample values.
- If there is no evidence for a field, omit it OR provide a default.
- For low-confidence mappings, include them but lower the confidence score.
- Map columns like notes/comments/referral/source/custom questions into donor.notes when relevant.
- Only map donation.external_id when it looks like a unique transaction identifier (avoid names, emails, campaigns).
- Never map donation.external_id from row-number or index columns (e.g., Row, Row #, Line, Index, No.).

Standard donor fields you may map:
- donor_type: "individual" | "organization"
- first_name
- last_name
- full_name (optional; we will split if first/last missing)
- organization_name
- email
- phone
- currency
- notes (CRM notes about the donor)

Standard donation fields (only if import kind is donations):
- donated_at (date/timestamp)
- amount
- currency
- campaign
- channel
- external_id (if present)

Mapping object format:
- For donations:
  {
    "kind": "donations",
    "donor": { "<field>": { "column": "<header>" } | { "default": "..." } },
    "donation": { "<field>": { "column": "<header>" } | { "default": "..." } },
    "notes": "...",
    "confidence": 0.0
  }
- For donors:
  {
    "kind": "donors",
    "donor": { "<field>": { "column": "<header>" } | { "default": "..." } },
    "notes": "...",
    "confidence": 0.0
  }

Top-level "notes" is optional mapping commentary; donor.notes is the CRM notes field.

You may optionally include "transform" as a hint (e.g., "number", "date"), but it is not required.

Make the best mapping possible from the sample.
`.trim();

  const input = {
    jobId,
    importType,
    headers,
    sampleRows,
  };

  const { output, agentRunId, traceId } = await runWorkflow({
    orgId,
    userId,
    workflow,
    input,
    fn: async () => {
      const res = await runAgentJson<any>({
        name: "SpreadsheetMappingAgent",
        workflow,
        model: MODELS.fast,
        instructions,
        input,
        traceGroupId: jobId,
        traceMetadata: { orgId, importType },
      });

      const mapped = importType === "donations" ? donationsMappingSchema.parse(res.output) : donorsMappingSchema.parse(res.output);
      return { output: mapped, traceId: res.traceId };
    },
  });

  // Return mapping; caller stores job stats elsewhere.
  return output;
}
