import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/shared/money";

export default async function GrantsPage({ searchParams }: { searchParams?: { archived?: string } }) {
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const showArchived = searchParams?.archived === "1";

  let query = supabase
    .from("grants")
    .select("id, title, funder, status, due_date, requested_amount, awarded_amount_min, awarded_amount_max, created_at, archived_at")
    .eq("org_id", orgId);

  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data: grants } = await query.order("created_at", { ascending: false }).limit(100);

  const draftCount = (grants || []).filter((g) => ["prospecting", "writing"].includes(g.status)).length;
  const submittedCount = (grants || []).filter((g) => g.status === "submitted").length;
  const verdictCount = (grants || []).filter((g) => ["awarded", "declined", "reporting", "closed"].includes(g.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Grants</h1>
          <p className="mt-1 text-sm text-slate-600">Grant writing + lifecycle tracking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={showArchived ? "/app/grants" : "/app/grants?archived=1"}>
            <Button variant="secondary">{showArchived ? "View active" : "View archived"}</Button>
          </Link>
          <Link href="/app/grants/new">
            <Button>New grant</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Draft", value: draftCount },
          { label: "Submitted", value: submittedCount },
          { label: "Verdict rendered", value: verdictCount },
        ].map((item) => (
          <Card key={item.label} className="p-5">
            <div className="text-xs uppercase tracking-wide text-slate-600">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold">{item.value.toLocaleString()}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Grant</th>
                <th className="px-4 py-3">Funder</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Request (USD)</th>
              </tr>
            </thead>
            <tbody>
              {(grants || []).map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link className="font-medium underline underline-offset-4" href={`/app/grants/${g.id}`}>
                      {g.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{g.funder || "—"}</td>
                  <td className="px-4 py-3">{formatGrantStatus(g)}</td>
                  <td className="px-4 py-3">{g.due_date ? new Date(g.due_date).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    {g.requested_amount ? formatCurrency(Number(g.requested_amount)) : "—"}
                  </td>
                </tr>
              ))}
              {(!grants || grants.length === 0) && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={5}>
                    {showArchived ? "No archived grants yet." : "No grants yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function formatGrantStatus(grant: {
  status: string;
  awarded_amount_min?: number | null;
  awarded_amount_max?: number | null;
  archived_at?: string | null;
}) {
  if (grant.archived_at) return "Archived";
  if (grant.status === "submitted") return "Submitted";
  if (grant.status === "awarded") {
    const range = formatAwardRange(grant.awarded_amount_min ?? null, grant.awarded_amount_max ?? null);
    return range !== "—" ? `Awarded (${range})` : "Awarded";
  }
  if (grant.status === "declined") return "Declined";
  if (grant.status === "reporting") return "Reporting";
  if (grant.status === "closed") return "Closed";
  return "Draft";
}

function formatAwardRange(min: number | null, max: number | null) {
  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    if (min === max) return formatCurrency(Number(min));
    return `${formatCurrency(Number(min))}–${formatCurrency(Number(max))}`;
  }
  if (min !== null && min !== undefined) return formatCurrency(Number(min));
  if (max !== null && max !== undefined) return formatCurrency(Number(max));
  return "—";
}
