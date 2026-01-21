import { describe, expect, it, vi } from "vitest";

const embeddingsCreate = vi.fn();

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClient: () => ({
    embeddings: { create: embeddingsCreate },
  }),
}));

import { embedText, embedTexts } from "@/lib/ai/embeddings";

describe("embeddings helpers", () => {
  it("returns a single embedding", async () => {
    embeddingsCreate.mockResolvedValueOnce({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    const embedding = await embedText("hello");
    expect(embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("returns multiple embeddings", async () => {
    embeddingsCreate.mockResolvedValueOnce({ data: [{ embedding: [1] }, { embedding: [2] }] });
    const embeddings = await embedTexts(["a", "b"]);
    expect(embeddings).toEqual([[1], [2]]);
  });
});
