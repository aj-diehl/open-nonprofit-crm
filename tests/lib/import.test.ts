import { describe, expect, it } from "vitest";
import { parseSpreadsheet } from "@/lib/import/parseSpreadsheet";
import { applyDonationMapping, applyDonorMapping, DonationsMapping, DonorsMapping } from "@/lib/import/applyMapping";
import { createSupabaseMock } from "../mocks/supabase";

describe("import helpers", () => {
  it("parses CSV spreadsheets into headers + rows", async () => {
    const csv = "Name,Amount\n Alice , $10 \n";
    const file = new File([csv], "sample.csv", { type: "text/csv" });
    const table = await parseSpreadsheet(file);
    expect(table.headers).toEqual(["Name", "Amount"]);
    expect(table.rows[0]).toEqual({ Name: "Alice", Amount: "$10" });
  });

  it("applies donation mappings and reports stats", async () => {
    const supabase = createSupabaseMock({
      responses: {
        donors: {
          select: { data: null, error: null },
          insert: { data: { id: "donor-1" }, error: null },
        },
        donations: {
          insert: { data: null, error: null },
        },
      },
    });

    const table = {
      headers: ["Email", "Amount", "Date"],
      rows: [{ Email: "donor@example.org", Amount: "$25.00", Date: "2024-01-10" }],
    };

    const mapping: DonationsMapping = {
      kind: "donations",
      donor: { email: { column: "Email" } },
      donation: { amount: { column: "Amount" }, donated_at: { column: "Date" } },
    };

    const result = await applyDonationMapping({
      supabase,
      orgId: "org-1",
      userId: "user-1",
      table,
      mapping,
      jobId: "job-1",
    });

    expect(result).toEqual({ jobId: "job-1", created: 1, updated: 0, skipped: 0 });
  });

  it("updates existing donors during donor mapping", async () => {
    const supabase = createSupabaseMock({
      responses: {
        donors: {
          select: { data: { id: "donor-1" }, error: null },
          update: { data: null, error: null },
        },
      },
    });

    const table = {
      headers: ["Email", "First"],
      rows: [{ Email: "user@example.org", First: "Alex" }],
    };

    const mapping: DonorsMapping = {
      kind: "donors",
      donor: { email: { column: "Email" }, first_name: { column: "First" }, donor_type: { default: "individual" } },
    };

    const result = await applyDonorMapping({
      supabase,
      orgId: "org-1",
      userId: "user-1",
      table,
      mapping,
      jobId: "job-2",
    });

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });
});
