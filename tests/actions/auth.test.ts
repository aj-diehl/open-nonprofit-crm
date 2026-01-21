import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { redirectMock } from "../mocks/next";

const { getProfileByUserId } = vi.hoisted(() => ({
  getProfileByUserId: vi.fn(),
}));

let server = createSupabaseMock();
let admin = createSupabaseMock();

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => server,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => admin,
}));
vi.mock("@/lib/db/profiles", () => ({ getProfileByUserId }));

import { loginAction } from "@/app/auth/login/actions";
import { registerAction } from "@/app/auth/register/actions";

describe("auth actions", () => {
  it("rejects invalid login input", async () => {
    const res = await loginAction({}, formDataFrom({ email: "bad", password: "" }));
    expect(res.error).toBeTruthy();
  });

  it("redirects pending users after login", async () => {
    server = createSupabaseMock({
      auth: {
        signInWithPassword: { error: null },
        getUser: { data: { user: { id: "user-1", email: "user@example.org" } }, error: null },
      },
    });
    getProfileByUserId.mockResolvedValueOnce({ status: "pending" });

    await loginAction({}, formDataFrom({ email: "user@example.org", password: "password123" }));
    expect(redirectMock).toHaveBeenCalledWith("/auth/pending");
  });

  it("creates a new org and redirects on successful register", async () => {
    admin = createSupabaseMock({
      auth: {
        admin: {
          createUser: { data: { user: { id: "user-2" } }, error: null },
        },
      },
      responses: {
        organizations: { insert: { data: { id: "org-1" }, error: null } },
        org_profiles: { insert: { data: null, error: null } },
        profiles: { insert: { data: null, error: null } },
      },
    });
    server = createSupabaseMock({
      auth: { signInWithPassword: { error: null } },
    });

    await registerAction(
      {},
      formDataFrom({
        orgName: "Test Org",
        inviteCode: "",
        email: "new@example.org",
        password: "password123",
        displayName: "Test User",
      })
    );

    expect(redirectMock).toHaveBeenCalledWith("/app/dashboard");
  });
});
