import { describe, expect, it } from "vitest";
import { audit } from "@/lib/audit/audit";

describe("audit", () => {
  it("swallows insert errors", async () => {
    const supabase = {
      from: () => ({
        insert: () => {
          throw new Error("fail");
        },
      }),
    };

    await expect(
      audit(supabase, {
        orgId: "org-1",
        actorId: "user-1",
        action: "test",
      })
    ).resolves.toBeUndefined();
  });
});
