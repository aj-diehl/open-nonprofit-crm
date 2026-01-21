import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../mocks/supabase";

const { runWorkflow, runAgentJson, retrieveContext, scrapeWebsite, tryWebSearch } = vi.hoisted(() => ({
  runWorkflow: vi.fn(),
  runAgentJson: vi.fn(),
  retrieveContext: vi.fn(),
  scrapeWebsite: vi.fn(),
  tryWebSearch: vi.fn(),
}));

runWorkflow.mockImplementation(async ({ fn }) => {
  const res = await fn();
  return { output: res.output, agentRunId: "run-1", traceId: res.traceId };
});
retrieveContext.mockImplementation(async () => []);
scrapeWebsite.mockImplementation(async () => ({ baseUrl: "https://example.org", pages: [] }));
tryWebSearch.mockImplementation(async () => ({ summary: "summary", sources: [] }));

let admin = createSupabaseMock({
  responses: {
    org_profiles: { select: { data: { mission: "test" }, error: null } },
  },
});

vi.mock("@/lib/ai/runs", () => ({ runWorkflow }));
vi.mock("@/lib/ai/agents/runtime", () => ({ runAgentJson }));
vi.mock("@/lib/ai/context/retrieve", () => ({ retrieveContext }));
vi.mock("@/lib/web/scrapeWebsite", () => ({ scrapeWebsite }));
vi.mock("@/lib/web/webSearch", () => ({ tryWebSearch }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => admin,
}));

import { runOrgDiscoveryWorkflow } from "@/lib/ai/workflows/orgDiscovery";
import { runCommsWorkflow } from "@/lib/ai/workflows/comms";
import { runGrantWriterWorkflow } from "@/lib/ai/workflows/grantWriter";
import { runSpreadsheetMappingAgent } from "@/lib/ai/workflows/spreadsheetMapping";

describe("AI workflows", () => {
  beforeEach(() => {
    runWorkflow.mockClear();
    runAgentJson.mockClear();
    retrieveContext.mockClear();
  });

  it("runs org discovery workflow", async () => {
    runAgentJson.mockResolvedValueOnce({
      output: { summary: "ok", proposed: { mission: "test" }, sources: ["https://example.org"] },
      traceId: "trace-1",
    });

    const res = await runOrgDiscoveryWorkflow({
      orgId: "org-1",
      userId: "user-1",
      organizationName: "Org",
      websiteUrl: "example.org",
      currentProfile: {},
    });

    expect(res.summary).toBe("ok");
    expect(res.agentRunId).toBe("run-1");
  });

  it("runs comms workflow and returns draft", async () => {
    admin = createSupabaseMock({
      responses: {
        org_profiles: { select: { data: { mission: "test" }, error: null } },
      },
    });
    retrieveContext.mockResolvedValueOnce([{ chunk_id: "c1", content: "context" }]);
    runAgentJson.mockResolvedValueOnce({
      output: { subject: "Hello", body: "Body" },
      traceId: "trace-2",
    });

    const res = await runCommsWorkflow({
      orgId: "org-1",
      userId: "user-1",
      input: { type: "email", title: "Update", goal: "Inform" },
    });

    expect(res.body).toBe("Body");
    expect(res.agentRunId).toBe("run-1");
  });

  it("runs grant writer workflow", async () => {
    admin = createSupabaseMock({
      responses: {
        org_profiles: { select: { data: { mission: "test" }, error: null } },
      },
    });
    retrieveContext.mockResolvedValue([{ chunk_id: "c1", document_id: "d1", similarity: 0.9, content: "context" }]);
    runAgentJson.mockResolvedValueOnce({
      output: { answers: [{ question_id: "q1", draft: "Draft answer" }] },
      traceId: "trace-3",
    });

    const res = await runGrantWriterWorkflow({
      orgId: "org-1",
      userId: "user-1",
      grant: { id: "g1", title: "Grant", funder: "Funder", status: "writing", due_date: null, requested_amount: null },
      questions: [{ id: "q1", question: "What is your mission?" }],
    });

    expect(res.answers[0].draft).toBe("Draft answer");
    expect(res.agentRunId).toBe("run-1");
  });

  it("runs spreadsheet mapping agent", async () => {
    runAgentJson.mockResolvedValueOnce({
      output: {
        kind: "donations",
        donor: { email: { column: "Email" } },
        donation: { amount: { column: "Amount" }, donated_at: { column: "Date" } },
      },
      traceId: "trace-4",
    });

    const res = await runSpreadsheetMappingAgent({
      orgId: "org-1",
      userId: "user-1",
      jobId: "job-1",
      importType: "donations",
      headers: ["Email", "Amount", "Date"],
      sampleRows: [{ Email: "a@b.com", Amount: "10", Date: "2024-01-01" }],
    });

    expect(res.kind).toBe("donations");
  });
});
