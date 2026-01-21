import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../mocks/supabase";

const admin = createSupabaseMock({
  responses: {
    documents: {
      insert: { data: { id: "doc-1" }, error: null },
      update: [{ data: null, error: null }, { data: null, error: null }],
    },
    document_chunks: {
      insert: { data: null, error: null },
    },
  },
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => admin,
}));

vi.mock("@/lib/documents/extract", () => ({
  extractTextFromFile: vi.fn(async () => "This is a test document."),
}));

vi.mock("@/lib/documents/chunk", () => ({
  chunkText: vi.fn(() => [
    { content: "This is a test", tokenCount: 4 },
    { content: "document.", tokenCount: 2 },
  ]),
}));

vi.mock("@/lib/ai/embeddings", () => ({
  embedTexts: vi.fn(async () => [
    [0.1, 0.2],
    [0.3, 0.4],
  ]),
}));

vi.mock("@/lib/ai/openaiClient", () => ({
  generateText: vi.fn(async () => ({ text: "- summary" })),
}));

import { ingestOrgDocument } from "@/lib/documents/ingest";

describe("ingestOrgDocument", () => {
  it("stores document metadata, chunks, and returns id", async () => {
    const file = new File(["hello"], "report.txt", { type: "text/plain" });
    const result = await ingestOrgDocument({
      supabase: {},
      orgId: "org-1",
      userId: "user-1",
      file,
      tags: { kind: "org_doc" },
    });

    expect(result.id).toBe("doc-1");
    const statusUpdate = admin.__calls.find(
      (call) => call.table === "documents" && call.action === "update" && call.payload?.status === "indexed"
    );
    expect(statusUpdate).toBeTruthy();
  });
});
