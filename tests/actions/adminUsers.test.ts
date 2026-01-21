import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { revalidatePathMock } from "../mocks/next";

const { getViewer, audit } = vi.hoisted(() => ({
  getViewer: vi.fn(),
  audit: vi.fn(),
}));

let viewer = { user: { id: "user-1" }, profile: { org_id: "org-1", role: "executive" } };
getViewer.mockImplementation(async () => viewer);
let admin = createSupabaseMock();
let server = createSupabaseMock();

vi.mock("@/lib/auth/getViewer", () => ({ getViewer }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => server }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/audit/audit", () => ({ audit }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { decideUserAction } from "@/app/app/admin/users/actions";

describe("admin user actions", () => {
  it("rejects non-executives", async () => {
    viewer = { user: { id: "user-1" }, profile: { org_id: "org-1", role: "member" } };

    await expect(
      decideUserAction(
        formDataFrom({
          profileId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
          decision: "approve",
        })
      )
    ).rejects.toThrow("Not authorized");
  });

  it("updates user status and revalidates list", async () => {
    viewer = { user: { id: "user-1" }, profile: { org_id: "org-1", role: "executive" } };
    admin = createSupabaseMock({
      responses: { profiles: { update: { data: null, error: null } } },
    });

    await decideUserAction(
      formDataFrom({
        profileId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        decision: "approve",
      })
    );

    expect(audit).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/app/admin/users");
  });
});
