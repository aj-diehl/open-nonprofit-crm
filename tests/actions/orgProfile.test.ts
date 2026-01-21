import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { revalidatePathMock } from "../mocks/next";

const { getViewer, audit, runOrgDiscoveryWorkflow } = vi.hoisted(() => ({
  getViewer: vi.fn(),
  audit: vi.fn(),
  runOrgDiscoveryWorkflow: vi.fn(),
}));

const viewer = {
  user: { id: "user-1" },
  profile: { org_id: "org-1", role: "executive" },
};

getViewer.mockImplementation(async () => viewer);
runOrgDiscoveryWorkflow.mockImplementation(async () => ({
  summary: "summary",
  proposed: { mission: "test" },
  sources: ["https://example.org"],
  agentRunId: "run-1",
}));

let server = createSupabaseMock();
let admin = createSupabaseMock();

vi.mock("@/lib/auth/getViewer", () => ({ getViewer }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => server }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/audit/audit", () => ({ audit }));
vi.mock("@/lib/ai/workflows/orgDiscovery", () => ({ runOrgDiscoveryWorkflow }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { updateOrgProfileAction, runOrgDiscoveryAction, decideOrgProfileUpdateAction } from "@/app/app/org-profile/actions";

describe("org profile actions", () => {
  it("updates org profile fields", async () => {
    server = createSupabaseMock({
      responses: { org_profiles: { update: { data: null, error: null } } },
    });

    await updateOrgProfileAction(
      formDataFrom({
        websiteUrl: "https://example.org",
        mission: "Mission",
        programs: "Programs",
        impact: "Impact",
      })
    );

    expect(audit).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/app/org-profile");
  });

  it("runs discovery and records a pending update", async () => {
    server = createSupabaseMock({
      responses: {
        organizations: { select: { data: { name: "Org", slug: "org" }, error: null } },
        org_profiles: { select: { data: { website_url: "https://example.org" }, error: null } },
      },
    });
    admin = createSupabaseMock({
      responses: {
        org_profile_updates: { insert: { data: null, error: null } },
        org_profiles: { update: { data: null, error: null } },
      },
    });

    await runOrgDiscoveryAction();

    expect(runOrgDiscoveryWorkflow).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/app/org-profile");
  });

  it("accepts a profile update and writes to org_profiles", async () => {
    admin = createSupabaseMock({
      responses: {
        org_profile_updates: {
          select: { data: { id: "upd-1", proposed: { mission: "test" } }, error: null },
          update: { data: null, error: null },
        },
        org_profiles: { update: { data: null, error: null } },
      },
    });
    server = createSupabaseMock({
      responses: { org_profile_updates: { update: { data: null, error: null } } },
    });

    await decideOrgProfileUpdateAction(
      formDataFrom({
        updateId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        decision: "accept",
      })
    );

    expect(revalidatePathMock).toHaveBeenCalledWith("/app/org-profile");
  });
});
