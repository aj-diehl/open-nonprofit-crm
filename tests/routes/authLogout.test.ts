import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../mocks/supabase";
import { redirectMock } from "../mocks/next";

let server = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => server,
}));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import LogoutPage from "@/app/auth/logout/page";

describe("logout page", () => {
  it("signs out and redirects to home", async () => {
    server = createSupabaseMock();
    await LogoutPage();
    expect(server.auth.signOut).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
