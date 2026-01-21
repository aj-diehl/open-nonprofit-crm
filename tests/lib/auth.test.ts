import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../mocks/supabase";

let supabase = createSupabaseMock({
  auth: {
    getUser: { data: { user: { id: "user-1", email: "user@example.org" } }, error: null },
  },
  responses: {
    profiles: { select: { data: { id: "user-1", org_id: "org-1", status: "active" }, error: null } },
    organizations: {
      select: { data: { id: "org-1", name: "Org", slug: "org", invite_code: "INV123" }, error: null },
    },
  },
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => supabase,
}));

import { getViewerUncached } from "@/lib/auth/getViewer";
import { getProfileByUserId } from "@/lib/db/profiles";

describe("auth helpers", () => {
  it("loads viewer context", async () => {
    supabase = createSupabaseMock({
      auth: {
        getUser: { data: { user: { id: "user-1", email: "user@example.org" } }, error: null },
      },
      responses: {
        profiles: { select: { data: { id: "user-1", org_id: "org-1", status: "active" }, error: null } },
        organizations: {
          select: { data: { id: "org-1", name: "Org", slug: "org", invite_code: "INV123" }, error: null },
        },
      },
    });

    const viewer = await getViewerUncached();
    expect(viewer?.user?.id).toBe("user-1");
    expect(viewer?.organization?.id).toBe("org-1");
  });

  it("returns null when no user is signed in", async () => {
    supabase = createSupabaseMock({
      auth: {
        getUser: { data: { user: null }, error: null },
      },
    });

    const viewer = await getViewerUncached();
    expect(viewer).toBeNull();
  });

  it("fetches profile by user id", async () => {
    const db = createSupabaseMock({
      responses: {
        profiles: { select: { data: { id: "user-2" }, error: null } },
      },
    });

    const profile = await getProfileByUserId(db, "user-2");
    expect(profile?.id).toBe("user-2");
  });

  it("dedupes viewer lookups within a request", async () => {
    supabase = createSupabaseMock({
      auth: {
        getUser: { data: { user: { id: "user-1", email: "user@example.org" } }, error: null },
      },
      responses: {
        profiles: { select: { data: { id: "user-1", org_id: "org-1", status: "active" }, error: null } },
        organizations: {
          select: { data: { id: "org-1", name: "Org", slug: "org", invite_code: "INV123" }, error: null },
        },
      },
    });

    vi.resetModules();
    const { getViewer, viewerCacheEnabled } = await import("@/lib/auth/getViewer");

    if (!viewerCacheEnabled) return;

    await getViewer();
    await getViewer();

    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    const profileCalls = supabase.__calls.filter((call) => call.table === "profiles");
    expect(profileCalls.length).toBe(1);
  });
});
