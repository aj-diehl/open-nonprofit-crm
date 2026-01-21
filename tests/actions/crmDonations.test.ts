import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { redirectMock } from "../mocks/next";

const { getViewer, audit } = vi.hoisted(() => ({
  getViewer: vi.fn(),
  audit: vi.fn(),
}));

const viewer = { user: { id: "user-1" }, profile: { org_id: "org-1" } };
getViewer.mockImplementation(async () => viewer);

let server = createSupabaseMock();

vi.mock("@/lib/auth/getViewer", () => ({ getViewer }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => server }));
vi.mock("@/lib/audit/audit", () => ({ audit }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { createDonationAction } from "@/app/app/crm/donations/new/actions";

describe("CRM donation actions", () => {
  it("creates a donor and donation, then redirects", async () => {
    server = createSupabaseMock({
      responses: {
        donors: {
          select: { data: null, error: null },
          insert: { data: { id: "donor-1" }, error: null },
        },
        donations: {
          insert: { data: { id: "donation-1" }, error: null },
        },
      },
    });

    await createDonationAction(
      {},
      formDataFrom({
        donorEmail: "donor@example.org",
        donorFirstName: "Alex",
        donorLastName: "Doe",
        donorType: "individual",
        amount: "50",
        currency: "USD",
        donatedAt: "2024-01-01",
      })
    );

    expect(redirectMock).toHaveBeenCalledWith("/app/crm/donations");
  });
});
