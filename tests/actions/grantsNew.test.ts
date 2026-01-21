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

import { createGrantAction } from "@/app/app/grants/new/actions";

describe("grant creation actions", () => {
  it("creates a grant and redirects", async () => {
    server = createSupabaseMock({
      responses: {
        grants: { insert: { data: { id: "grant-1" }, error: null } },
      },
    });

    await createGrantAction(
      {},
      formDataFrom({
        title: "New Grant",
        funder: "Funder",
        status: "writing",
        dueDate: "2024-12-31",
        requestedAmount: "1000",
      })
    );

    expect(redirectMock).toHaveBeenCalledWith("/app/grants/grant-1");
  });
});
