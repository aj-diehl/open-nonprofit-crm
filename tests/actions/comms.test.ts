import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { redirectMock, revalidatePathMock } from "../mocks/next";

const { getViewer, audit, runCommsWorkflow, createBackgroundJob, completeBackgroundJob, updateBackgroundJob, runInBackground } = vi.hoisted(() => ({
  getViewer: vi.fn(),
  audit: vi.fn(),
  runCommsWorkflow: vi.fn(),
  createBackgroundJob: vi.fn(),
  completeBackgroundJob: vi.fn(),
  updateBackgroundJob: vi.fn(),
  runInBackground: vi.fn(),
}));

let viewer = { user: { id: "user-1" }, profile: { org_id: "org-1", role: "executive" } };
getViewer.mockImplementation(async () => viewer);
runCommsWorkflow.mockImplementation(async () => ({
  subject: "Subject",
  body: "Body",
  metadata: { tone: "friendly" },
  agentRunId: "run-1",
}));
createBackgroundJob.mockImplementation(async () => ({ id: "job-1" }));
completeBackgroundJob.mockImplementation(async () => {});
updateBackgroundJob.mockImplementation(async () => {});
runInBackground.mockImplementation(() => {});

let server = createSupabaseMock();
let admin = createSupabaseMock();

vi.mock("@/lib/auth/getViewer", () => ({ getViewer }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => server }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/audit/audit", () => ({ audit }));
vi.mock("@/lib/ai/workflows/comms", () => ({ runCommsWorkflow }));
vi.mock("@/lib/jobs/background", () => ({
  createBackgroundJob,
  completeBackgroundJob,
  updateBackgroundJob,
  runInBackground,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { createDraftAction } from "@/app/app/comms/new/actions";
import { updateDraftAction, generateDraftAction, archiveDraftAction, restoreDraftAction, deleteDraftAction } from "@/app/app/comms/[id]/actions";

describe("comms actions", () => {
  it("validates draft creation", async () => {
    const res = await createDraftAction({}, formDataFrom({ type: "email", title: "", goal: "" }));
    expect(res.error).toBe("Please check the form fields.");
  });

  it("creates a draft and redirects", async () => {
    admin = createSupabaseMock({
      responses: { comms_drafts: { insert: { data: { id: "draft-1" }, error: null } } },
    });
    server = createSupabaseMock();

    await createDraftAction(
      {},
      formDataFrom({
        type: "email",
        title: "Update",
        goal: "Inform",
      })
    );

    expect(redirectMock).toHaveBeenCalledWith("/app/comms/draft-1?generate=1");
  });

  it("updates an existing draft", async () => {
    server = createSupabaseMock({
      responses: { comms_drafts: { update: { data: null, error: null } } },
    });

    await updateDraftAction(
      formDataFrom({
        id: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        title: "New title",
        subject: "Subject",
        body: "Body",
      })
    );

    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("generates a draft using the workflow", async () => {
    server = createSupabaseMock({
      responses: {
        comms_drafts: {
          select: {
            data: {
              id: "draft-1",
              type: "email",
              title: "Title",
              audience: null,
              goal: "Goal",
              tone: null,
              length: null,
              call_to_action: null,
            },
            error: null,
          },
          update: { data: null, error: null },
        },
      },
    });

    const res = await generateDraftAction("b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd");
    expect(createBackgroundJob).toHaveBeenCalled();
    expect(runInBackground).toHaveBeenCalled();
    expect(res.jobId).toBe("job-1");
  });

  it("archives and restores drafts", async () => {
    server = createSupabaseMock({
      responses: { comms_drafts: { update: { data: null, error: null } } },
    });

    await archiveDraftAction("b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd");
    await restoreDraftAction("b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd");
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("deletes drafts for executives", async () => {
    server = createSupabaseMock({
      responses: { comms_drafts: { delete: { data: null, error: null } } },
    });

    await deleteDraftAction("b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd");
    expect(revalidatePathMock).toHaveBeenCalledWith("/app/comms");
  });
});
