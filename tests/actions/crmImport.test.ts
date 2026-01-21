import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { revalidatePathMock } from "../mocks/next";

const {
  getViewer,
  parseSpreadsheet,
  runSpreadsheetMappingAgent,
  applyDonationMapping,
  applyDonorMapping,
  createBackgroundJob,
  completeBackgroundJob,
  runInBackground,
  audit,
} = vi.hoisted(() => ({
  getViewer: vi.fn(),
  parseSpreadsheet: vi.fn(),
  runSpreadsheetMappingAgent: vi.fn(),
  applyDonationMapping: vi.fn(),
  applyDonorMapping: vi.fn(),
  createBackgroundJob: vi.fn(),
  completeBackgroundJob: vi.fn(),
  runInBackground: vi.fn(),
  audit: vi.fn(),
}));

const viewer = { user: { id: "user-1" }, profile: { org_id: "org-1" } };
getViewer.mockImplementation(async () => viewer);
parseSpreadsheet.mockImplementation(async () => ({
  headers: ["Email", "Amount", "Date"],
  rows: [{ Email: "a@b.com", Amount: "10", Date: "2024-01-01" }],
}));
runSpreadsheetMappingAgent.mockImplementation(async () => ({
  kind: "donations",
  donor: { email: { column: "Email" } },
  donation: { amount: { column: "Amount" }, donated_at: { column: "Date" } },
}));
applyDonationMapping.mockImplementation(async () => ({ jobId: "job-1", created: 1, updated: 0, skipped: 0 }));
applyDonorMapping.mockImplementation(async () => ({ jobId: "job-1", created: 1, updated: 0, skipped: 0 }));
createBackgroundJob.mockImplementation(async () => ({ id: "bg-1" }));
completeBackgroundJob.mockImplementation(async () => {});
runInBackground.mockImplementation(() => {});

let server = createSupabaseMock();
let admin = createSupabaseMock();

vi.mock("@/lib/auth/getViewer", () => ({ getViewer }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => server }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/import/parseSpreadsheet", () => ({ parseSpreadsheet }));
vi.mock("@/lib/ai/workflows/spreadsheetMapping", () => ({ runSpreadsheetMappingAgent }));
vi.mock("@/lib/import/applyMapping", () => ({ applyDonationMapping, applyDonorMapping }));
vi.mock("@/lib/audit/audit", () => ({ audit }));
vi.mock("@/lib/jobs/background", () => ({ createBackgroundJob, completeBackgroundJob, runInBackground }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { importSpreadsheetAction } from "@/app/app/crm/import/actions";

describe("CRM import actions", () => {
  it("rejects missing files", async () => {
    const res = await importSpreadsheetAction({}, formDataFrom({ importType: "donations" }));
    expect(res.error).toBe("Please choose a file.");
  });

  it("runs import and returns job info", async () => {
    admin = createSupabaseMock({
      responses: {
        ingestion_jobs: {
          insert: { data: { id: "job-1" }, error: null },
          update: { data: null, error: null },
        },
      },
    });
    server = createSupabaseMock();

    const file = new File(["Email,Amount,Date\na@b.com,10,2024-01-01"], "donations.csv", { type: "text/csv" });
    const res = await importSpreadsheetAction({}, formDataFrom({ importType: "donations", file }));
    expect(res.jobId).toBe("job-1");
    expect(res.message).toContain("Import started");
    expect(createBackgroundJob).toHaveBeenCalled();
  });
});
