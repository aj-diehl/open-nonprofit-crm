import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { redirectMock, revalidatePathMock } from "../mocks/next";

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
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { createDonorAction as createDonorActionNew } from "@/app/app/crm/donors/new/actions";
import { createDonorAction as createDonorActionInline } from "@/app/app/crm/donors/actions";

describe("CRM donor actions", () => {
  it("creates a donor and redirects from new donor flow", async () => {
    server = createSupabaseMock({
      responses: { donors: { insert: { data: { id: "donor-1" }, error: null } } },
    });

    await createDonorActionNew(
      {},
      formDataFrom({
        donorType: "individual",
        firstName: "Alex",
        lastName: "Doe",
        email: "alex@example.org",
      })
    );

    expect(redirectMock).toHaveBeenCalledWith("/app/crm/donors/donor-1");
  });

  it("creates a donor and revalidates list", async () => {
    server = createSupabaseMock({
      responses: { donors: { insert: { data: { id: "donor-2" }, error: null } } },
    });

    await createDonorActionInline(
      formDataFrom({
        donorType: "organization",
        organizationName: "Org",
        email: "org@example.org",
      })
    );

    expect(revalidatePathMock).toHaveBeenCalledWith("/app/crm/donors");
  });
});
