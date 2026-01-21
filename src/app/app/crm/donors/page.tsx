import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DonorCreateDialog } from "./ui";

export default async function DonorsPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams?.q || "").trim();
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;

  let query = supabase
    .from("donors")
    .select("id, donor_type, first_name, last_name, organization_name, email, phone, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    // Simple ilike search over name/email
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,organization_name.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  const { data: donors } = await query;

  const counts = (donors || []).reduce(
    (acc: any, d: any) => {
      acc[d.donor_type] = (acc[d.donor_type] || 0) + 1;
      return acc;
    },
    { individual: 0, organization: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Donors</h1>
          <p className="mt-1 text-sm text-slate-600">Your donor CRM (multi-tenant, secure).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/crm/import">
            <Button variant="secondary">Import</Button>
          </Link>
          <DonorCreateDialog />
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-medium">Donor directory</div>
            <div className="mt-1 text-sm text-slate-600">
              {counts.individual.toLocaleString()} individuals / {counts.organization.toLocaleString()} organizations
            </div>
          </div>
          <form action="/app/crm/donors" method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name or email…"
              className="w-64 rounded-lg border bg-white px-3 py-2 text-sm"
            />
            <button className="rounded-lg border bg-white px-3 py-2 text-sm font-medium">Search</button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Donor</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
              </tr>
            </thead>
            <tbody>
              {(donors || []).map((d: any) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link className="font-medium underline underline-offset-4" href={`/app/crm/donors/${d.id}`}>
                      {d.donor_type === "organization"
                        ? d.organization_name || "Organization"
                        : `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Individual"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{d.donor_type}</td>
                  <td className="px-4 py-3">{d.email || "—"}</td>
                  <td className="px-4 py-3">{d.phone || "—"}</td>
                </tr>
              ))}
              {(!donors || donors.length === 0) && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={4}>
                    No donors found.
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
