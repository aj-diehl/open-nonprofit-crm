import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { redirectMock } from "../mocks/next";

const {
  getViewer,
  createDocumentRecord,
  uploadDocumentFile,
  processDocumentContent,
  createBackgroundJob,
  completeBackgroundJob,
  runInBackground,
  audit,
} = vi.hoisted(() => ({
  getViewer: vi.fn(),
  createDocumentRecord: vi.fn(),
  uploadDocumentFile: vi.fn(),
  processDocumentContent: vi.fn(),
  createBackgroundJob: vi.fn(),
  completeBackgroundJob: vi.fn(),
  runInBackground: vi.fn(),
  audit: vi.fn(),
}));

const viewer = { user: { id: "user-1" }, profile: { org_id: "org-1" } };
getViewer.mockImplementation(async () => viewer);
createDocumentRecord.mockImplementation(async () => ({ id: "doc-1" }));
uploadDocumentFile.mockImplementation(async () => ({ path: "org-1/doc-1/notes.txt" }));
processDocumentContent.mockImplementation(async () => {});
createBackgroundJob.mockImplementation(async () => ({ id: "job-1" }));
completeBackgroundJob.mockImplementation(async () => {});
runInBackground.mockImplementation(() => {});

let server = createSupabaseMock();

vi.mock("@/lib/auth/getViewer", () => ({ getViewer }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => server }));
vi.mock("@/lib/documents/ingest", () => ({ createDocumentRecord, uploadDocumentFile, processDocumentContent }));
vi.mock("@/lib/jobs/background", () => ({ createBackgroundJob, completeBackgroundJob, runInBackground }));
vi.mock("@/lib/audit/audit", () => ({ audit }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { uploadDocAction, updateDocumentTagsAction } from "@/app/app/knowledge/actions";

describe("knowledge actions", () => {
  it("rejects uploads without a file", async () => {
    const res = await uploadDocAction({}, formDataFrom({ tags: "tag1" }));
    expect(res.error).toBe("Please choose a file.");
  });

  it("ingests documents and redirects", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await uploadDocAction({}, formDataFrom({ file, tags: "tag1, tag2" }));
    expect(createDocumentRecord).toHaveBeenCalled();
    expect(uploadDocumentFile).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/app/knowledge");
  });

  it("updates document tags and redirects", async () => {
    server = createSupabaseMock({
      responses: {
        documents: {
          select: { data: { tags: { labels: ["old"] } }, error: null },
          update: { data: null, error: null },
        },
      },
    });

    await updateDocumentTagsAction(
      formDataFrom({
        id: "doc-1",
        tags: "NewTag",
        redirectTo: "/app/knowledge",
      })
    );

    expect(audit).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/app/knowledge");
  });
});
