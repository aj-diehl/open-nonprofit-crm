import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../mocks/supabase";
import { loadDonationSeries } from "@/lib/dashboard/series";

describe("dashboard donation series", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 2, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses RPC aggregation and fills missing months", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        dashboard_donation_series: {
          data: [
            { month: "2024-01-01", total: 100 },
            { month: "2024-03-01", total: 50 },
          ],
          error: null,
        },
      },
    });

    const series = await loadDonationSeries(supabase as any, "org-1", "3m");

    expect(series).toEqual([
      { month: "2024-01", total: 100 },
      { month: "2024-02", total: 0 },
      { month: "2024-03", total: 50 },
    ]);

    const rpcCall = supabase.__calls.find((call) => call.action === "rpc");
    expect(rpcCall?.payload?.fn).toBe("dashboard_donation_series");
    expect(rpcCall?.payload?.args?.p_org_id).toBe("org-1");
  });
});
