import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { revalidatePathMock } from "../mocks/next";

const {
  getViewer,
  audit,
  runGrantWriterWorkflow,
  createDocumentRecord,
  uploadDocumentFile,
  processDocumentContent,
  createBackgroundJob,
  completeBackgroundJob,
  updateBackgroundJob,
  runInBackground,
} = vi.hoisted(() => ({
  getViewer: vi.fn(),
  audit: vi.fn(),
  runGrantWriterWorkflow: vi.fn(),
  createDocumentRecord: vi.fn(),
  uploadDocumentFile: vi.fn(),
  processDocumentContent: vi.fn(),
  createBackgroundJob: vi.fn(),
  completeBackgroundJob: vi.fn(),
  updateBackgroundJob: vi.fn(),
  runInBackground: vi.fn(),
}));

let viewer = { user: { id: "user-1" }, profile: { org_id: "org-1", role: "executive" } };
getViewer.mockImplementation(async () => viewer);
runGrantWriterWorkflow.mockImplementation(async () => ({
  answers: [{ question_id: "q1", draft: "Draft", citations: [] }],
  agentRunId: "run-1",
}));
createDocumentRecord.mockImplementation(async () => ({ id: "doc-1" }));
uploadDocumentFile.mockImplementation(async () => ({ path: "org-1/doc-1/guidelines.pdf" }));
processDocumentContent.mockImplementation(async () => {});
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
vi.mock("@/lib/ai/workflows/grantWriter", () => ({ runGrantWriterWorkflow }));
vi.mock("@/lib/documents/ingest", () => ({ createDocumentRecord, uploadDocumentFile, processDocumentContent }));
vi.mock("@/lib/jobs/background", () => ({
  createBackgroundJob,
  completeBackgroundJob,
  updateBackgroundJob,
  runInBackground,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import {
  addGrantQuestionAction,
  generateGrantDraftsAction,
  saveFinalGrantAnswerAction,
  uploadGrantGuidelinesAction,
  updateGrantProcessAction,
  deleteGrantAction,
} from "@/app/app/grants/[id]/actions";

describe("grant detail actions", () => {
  it("adds a grant question", async () => {
    server = createSupabaseMock({
      responses: { grant_questions: { insert: { data: { id: "q1" }, error: null } } },
    });

    await addGrantQuestionAction(
      formDataFrom({
        grantId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        question: "Describe the program",
      })
    );

    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("generates grant drafts and upserts answers", async () => {
    server = createSupabaseMock({
      responses: {
        grants: { select: { data: { id: "g1", title: "Grant", funder: "Funder", status: "writing" }, error: null } },
        grant_questions: { select: { data: [{ id: "q1", question: "Q1" }], error: null } },
      },
    });
    admin = createSupabaseMock({
      responses: { grant_answers: { upsert: { data: null, error: null } } },
    });

    await generateGrantDraftsAction(
      formDataFrom({
        grantId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
      })
    );

    expect(createBackgroundJob).toHaveBeenCalled();
    expect(runInBackground).toHaveBeenCalled();
  });

  it("saves final answers", async () => {
    server = createSupabaseMock({
      responses: { grant_answers: { update: { data: null, error: null } } },
    });

    await saveFinalGrantAnswerAction(
      formDataFrom({
        answerId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        grantId: "c88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        finalText: "Final response",
      })
    );

    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("uploads grant guidelines and links document", async () => {
    server = createSupabaseMock();
    admin = createSupabaseMock({
      responses: { grant_documents: { insert: { data: null, error: null } } },
    });

    const file = new File(["guidelines"], "guidelines.pdf", { type: "application/pdf" });
    await uploadGrantGuidelinesAction(
      formDataFrom({
        grantId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        file,
      })
    );

    expect(createDocumentRecord).toHaveBeenCalled();
    expect(uploadDocumentFile).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("validates awarded amount ranges", async () => {
    await expect(
      updateGrantProcessAction(
        formDataFrom({
          grantId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
          stage: "verdict",
          outcome: "awarded",
          awardedAmountMin: "200",
          awardedAmountMax: "100",
        })
      )
    ).rejects.toThrow("Awarded amount min cannot exceed max");
  });

  it("rejects deletions from non-executives", async () => {
    viewer = { user: { id: "user-1" }, profile: { org_id: "org-1", role: "member" } };

    await expect(
      deleteGrantAction(
        formDataFrom({
          grantId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        })
      )
    ).rejects.toThrow("Not authorized");
  });
});
