import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/shared/money";
import { DonationsChart } from "./ui";
import { loadDonationSeries, toCumulative, type RangeOption } from "@/lib/dashboard/series";

type ViewOption = "monthly" | "cumulative";

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "24m", label: "Last 24 months" },
  { value: "ytd", label: "Year to date" },
];

const VIEW_OPTIONS: { value: ViewOption; label: string }[] = [
  { value: "monthly", label: "Monthly totals" },
  { value: "cumulative", label: "Cumulative total" },
];

const RANGE_VALUES = new Set(RANGE_OPTIONS.map((option) => option.value));
const VIEW_VALUES = new Set(VIEW_OPTIONS.map((option) => option.value));

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { range?: string; view?: string };
}) {
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const range = resolveRange(searchParams?.range);
  const view = resolveView(searchParams?.view);

  if (!orgId) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="font-medium">No organization found.</div>
      </div>
    );
  }

  const [{ data: metrics }, donationSeries] = await Promise.all([
    supabase.rpc("dashboard_metrics", { p_org_id: orgId }),
    loadDonationSeries(supabase, orgId, range),
  ]);

  const chartSeries = view === "cumulative" ? toCumulative(donationSeries) : donationSeries;
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "Last 12 months";
  const viewLabel = VIEW_OPTIONS.find((option) => option.value === view)?.label ?? "Monthly totals";
  const hasFilters = range !== "12m" || view !== "monthly";

  const donors = Number(metrics?.donors ?? 0);
  const donations = Number(metrics?.donations ?? 0);
  const donationTotal = Number(metrics?.donation_total ?? 0);
  const openGrants = Number(metrics?.open_grants ?? 0);
  const pendingUsers = Number(metrics?.pending_users ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Organization reporting, activity, and key operational metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Donors" value={donors.toLocaleString()} />
        <MetricCard title="Donations" value={donations.toLocaleString()} />
        <MetricCard title="Total raised" value={formatCurrency(donationTotal)} />
        <MetricCard title="Open grants" value={openGrants.toLocaleString()} />
      </div>

      {pendingUsers > 0 ? (
        <Card className="p-4">
          <div className="text-sm">
            <span className="font-medium">{pendingUsers}</span> user(s) are pending approval.
            {viewer?.profile?.role === "executive" ? (
              <span className="ml-2 text-slate-600">Go to Admin → Users to review.</span>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6">
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold">Donations</div>
                <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {rangeLabel}
                </span>
                <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {viewLabel}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-600">Based on recorded gifts.</div>
            </div>
            <form action="/app/dashboard" method="get" className="flex flex-wrap items-end gap-3">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Range
                <Select
                  name="range"
                  defaultValue={range}
                  options={RANGE_OPTIONS}
                  className="mt-1 min-w-[160px]"
                />
              </label>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                View
                <Select
                  name="view"
                  defaultValue={view}
                  options={VIEW_OPTIONS}
                  className="mt-1 min-w-[180px]"
                />
              </label>
              <div className="flex items-center gap-2">
                <Button type="submit" variant="secondary">
                  Apply
                </Button>
                {hasFilters ? (
                  <Link className="text-xs text-slate-600 underline underline-offset-4" href="/app/dashboard">
                    Reset
                  </Link>
                ) : null}
              </div>
            </form>
          </div>
          <div className="mt-4">
            <DonationsChart data={chartSeries} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-slate-600">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function resolveRange(value?: string): RangeOption {
  return RANGE_VALUES.has(value as RangeOption) ? (value as RangeOption) : "12m";
}

function resolveView(value?: string): ViewOption {
  return VIEW_VALUES.has(value as ViewOption) ? (value as ViewOption) : "monthly";
}
