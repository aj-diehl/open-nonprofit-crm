import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../mocks/supabase";

let admin = createSupabaseMock({
  responses: {
    agent_runs: {
      insert: { data: { id: "run-1" }, error: null },
      update: [{ data: null, error: null }, { data: null, error: null }],
    },
  },
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => admin,
}));

import { runWorkflow } from "@/lib/ai/runs";

describe("runWorkflow", () => {
  it("creates and completes a run on success", async () => {
    admin = createSupabaseMock({
      responses: {
        agent_runs: {
          insert: { data: { id: "run-1" }, error: null },
          update: [{ data: null, error: null }],
        },
      },
    });

    const result = await runWorkflow({
      orgId: "org-1",
      userId: "user-1",
      workflow: "workflow-1",
      input: { foo: "bar" },
      fn: async () => ({ output: { ok: true }, traceId: "trace-1", usage: { tokens: 1 } }),
    });

    expect(result.agentRunId).toBe("run-1");
    expect(result.output).toEqual({ ok: true });
  });

  it("marks run failed on errors", async () => {
    admin = createSupabaseMock({
      responses: {
        agent_runs: {
          insert: { data: { id: "run-1" }, error: null },
          update: [{ data: null, error: null }],
        },
      },
    });

    await expect(
      runWorkflow({
        orgId: "org-1",
        userId: "user-1",
        workflow: "workflow-2",
        input: { foo: "bar" },
        fn: async () => {
          throw new Error("boom");
        },
      })
    ).rejects.toThrow("boom");

    const failedUpdate = admin.__calls.find(
      (call) => call.table === "agent_runs" && call.action === "update" && call.payload?.status === "failed"
    );
    expect(failedUpdate).toBeTruthy();
  });
});
