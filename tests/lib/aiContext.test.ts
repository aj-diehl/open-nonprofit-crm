import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../mocks/supabase";

const { embedText } = vi.hoisted(() => ({
  embedText: vi.fn(),
}));

embedText.mockImplementation(async () => [0.1, 0.2]);

vi.mock("@/lib/ai/embeddings", () => ({ embedText }));

let admin = createSupabaseMock({
  rpc: {
    match_document_chunks: { data: [{ chunk_id: "c1", document_id: "d1", similarity: 0.9, content: "text" }], error: null },
  },
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => admin,
}));

import { retrieveContext } from "@/lib/ai/context/retrieve";

describe("retrieveContext", () => {
  it("returns chunks from match_document_chunks", async () => {
    admin = createSupabaseMock({
      rpc: {
        match_document_chunks: {
          data: [{ chunk_id: "c1", document_id: "d1", similarity: 0.9, content: "text" }],
          error: null,
        },
      },
    });

    const res = await retrieveContext({ orgId: "org-1", query: "mission" });
    expect(res).toHaveLength(1);
    expect(res[0].chunk_id).toBe("c1");
    expect(embedText).toHaveBeenCalled();
  });

  it("returns empty array on rpc error", async () => {
    admin = createSupabaseMock({
      rpc: {
        match_document_chunks: { data: null, error: new Error("fail") },
      },
    });

    const res = await retrieveContext({ orgId: "org-1", query: "mission" });
    expect(res).toEqual([]);
  });
});
