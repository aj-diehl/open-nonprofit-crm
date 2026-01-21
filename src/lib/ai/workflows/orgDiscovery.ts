import { MODELS } from "@/lib/ai/models";
import { runWorkflow } from "@/lib/ai/runs";
import { runAgentJson } from "@/lib/ai/agents/runtime";
import { retrieveContext } from "@/lib/ai/context/retrieve";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scrapeWebsite } from "@/lib/web/scrapeWebsite";
import { tryWebSearch } from "@/lib/web/webSearch";
import { z } from "zod";

const outputSchema = z.object({
  summary: z.string(),
  proposed: z.record(z.any()),
  sources: z.array(z.string()).optional(),
});

export async function runOrgDiscoveryWorkflow({
  orgId,
  userId,
  organizationName,
  websiteUrl,
  currentProfile,
  runId,
}: {
  orgId: string;
  userId: string;
  organizationName: string;
  websiteUrl?: string;
  currentProfile: any;
  runId?: string;
}): Promise<{ summary: string; proposed: any; sources?: string[]; agentRunId: string }> {
  const workflow = "org_discovery";

  const admin = createSupabaseAdminClient();
  const { data: docs } = await admin
    .from("documents")
    .select("id, file_name, summary, tags")
    .eq("org_id", orgId)
    .eq("status", "indexed")
    .eq("tags->>kind", "org_doc");

  const knowledgeBaseDocuments = (docs || []).map((doc) => ({
    id: doc.id,
    file_name: doc.file_name,
    summary: doc.summary,
    tags: doc.tags,
  }));

  const knowledgeDocIds = new Set(knowledgeBaseDocuments.map((doc) => doc.id));
  const knowledgeQuery = [
    organizationName,
    "organization profile",
    "mission",
    "programs",
    "impact",
    "leadership",
    "service area",
    "beneficiaries",
    "key metrics",
  ]
    .filter(Boolean)
    .join("\n");
  const knowledgeChunks = knowledgeDocIds.size
    ? await retrieveContext({ orgId, query: knowledgeQuery, limit: 30 })
    : [];
  const knowledgeBaseSnippets = knowledgeChunks
    .filter((chunk) => knowledgeDocIds.has(chunk.document_id))
    .map((chunk) => ({
      id: chunk.chunk_id,
      document_id: chunk.document_id,
      content: chunk.content,
    }));

  const scraped = websiteUrl ? await scrapeWebsite(websiteUrl) : { baseUrl: websiteUrl || "", pages: [] };
  const web = await tryWebSearch(`${organizationName} nonprofit mission programs impact`);

  const instructions = `
You are an organization discovery agent for a nonprofit operations platform.

Inputs:
- organization name
- current approved org profile (may be incomplete)
- knowledge base documents (summaries + snippets)
- scraped website pages (text)
- optional web-search summary + sources

Task:
- Propose updates to the org profile fields that are likely true and useful for grant writing and communications.
- Be conservative; do NOT invent facts.
- Incorporate relevant facts from the knowledge base documents.
- Prefer knowledge base documents and the website as primary sources.
- If you can't confirm a detail, omit it.

Output:
- JSON only.
- Format:
  {
    "summary": "1-3 sentence summary of what you found and what you propose to update",
    "proposed": {
      "website_url": "...",
      "mission": "...",
      "programs": "...",
      "impact": "...",
      "leadership": "...",
      "service_area": "...",
      "beneficiaries": "...",
      "key_metrics": {...}
    },
    "sources": ["doc:<id or file_name>", "https://...", ...]
  }

Keep text concise and ready to be reviewed by a human.
`.trim();

  const input = {
    orgId,
    organizationName,
    websiteUrl: websiteUrl || null,
    currentProfile,
    knowledgeBaseDocuments,
    knowledgeBaseSnippets,
    scrapedWebsite: scraped,
    webSearch: web,
  };

  const res = await runWorkflow({
    orgId,
    userId,
    workflow,
    input,
    runId,
    fn: async () => {
      const out = await runAgentJson<any>({
        name: "OrgDiscoveryAgent",
        workflow,
        model: MODELS.fast,
        instructions,
        input,
        traceGroupId: orgId,
        traceMetadata: { orgId, workflow },
      });

      const parsed = outputSchema.parse(out.output);
      return { output: parsed, traceId: out.traceId };
    },
  });

  return { ...res.output, agentRunId: res.agentRunId };
}
