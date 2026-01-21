import { getOpenAIClient } from "@/lib/ai/openaiClient";
import { MODELS } from "@/lib/ai/models";

export type WebSearchResult = { summary: string; sources: { url: string; title?: string; snippet?: string }[] };

// Best-effort web search via OpenAI built-in tools.
// If the project or model does not support web search tools, this returns null.
export async function tryWebSearch(query: string): Promise<WebSearchResult | null> {
  const client = getOpenAIClient();

  try {
    // @ts-ignore - tool types differ across SDK versions
    const resp = await client.responses.create({
      model: MODELS.fast,
      input: `Search the web for: ${query}. Return JSON with {summary, sources:[{url,title,snippet}]}.`,
      // @ts-ignore
      tools: [{ type: "web_search_preview" }],
      temperature: 0.2,
    });

    // @ts-ignore
    const text = resp.output_text || "";
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    const json = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    return JSON.parse(json) as WebSearchResult;
  } catch {
    return null;
  }
}
