import { describe, expect, it, vi } from "vitest";
import { formDataFrom } from "../helpers/form";
import { createSupabaseMock } from "../mocks/supabase";
import { revalidatePathMock } from "../mocks/next";

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
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { createDonationForDonorAction, createInteractionAction } from "@/app/app/crm/donors/[id]/actions";

describe("CRM donor detail actions", () => {
  it("creates a donation for a donor", async () => {
    server = createSupabaseMock({
      responses: { donations: { insert: { data: { id: "donation-1" }, error: null } } },
    });

    await createDonationForDonorAction(
      formDataFrom({
        donorId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        amount: "25",
        currency: "USD",
        donatedAt: "2024-01-01",
      })
    );

    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("creates a donor interaction", async () => {
    server = createSupabaseMock({
      responses: { interactions: { insert: { data: { id: "interaction-1" }, error: null } } },
    });

    await createInteractionAction(
      formDataFrom({
        donorId: "b88d3c6f-7de9-44ba-8a72-0b4af2c3d9cd",
        type: "call",
        subject: "Follow-up",
        occurredAt: "2024-01-01",
      })
    );

    expect(revalidatePathMock).toHaveBeenCalled();
  });
});
