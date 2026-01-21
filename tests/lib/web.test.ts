import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const responsesCreate = vi.fn();
vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => ({
    responses: { create: responsesCreate },
  }),
}));

import { scrapeWebsite } from "@/lib/web/scrapeWebsite";
import { tryWebSearch } from "@/lib/web/webSearch";

describe("web helpers", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const longText = "Hello ".repeat(100);
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => `<html><body><h1>${longText}</h1><script>ignore()</script></body></html>`,
    })) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("scrapes basic text from website pages", async () => {
    const res = await scrapeWebsite("example.org", { maxPages: 1, timeoutMs: 1000 });
    expect(res.baseUrl).toBe("https://example.org");
    expect(res.pages.length).toBe(1);
    expect(res.pages[0].text).toContain("Hello");
  });

  it("runs best-effort web search", async () => {
    responsesCreate.mockResolvedValueOnce({
      output_text: '{"summary":"ok","sources":[{"url":"https://example.org","title":"Example"}]}',
    });

    const res = await tryWebSearch("test query");
    expect(res?.summary).toBe("ok");
    expect(res?.sources[0].url).toBe("https://example.org");
  });
});
