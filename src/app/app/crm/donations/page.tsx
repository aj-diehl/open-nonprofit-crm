import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/shared/money";
import { getDonorDisplayName, isReceiptEligibleForDonor } from "@/lib/receipts/donor";

export default async function DonationsPage() {
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;

  const { data: donations } = await supabase
    .from("donations")
    .select(
      "id, amount, currency, donated_at, campaign, channel, donor:donor_id(id, donor_type, first_name, last_name, organization_name, email)"
    )
    .eq("org_id", orgId)
    .order("donated_at", { ascending: false })
    .limit(100);

  const total = (donations || []).reduce((sum, d: any) => sum + Number(d.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Donations</h1>
          <p className="mt-1 text-sm text-slate-600">Recent donations across your org.</p>
        </div>
        <Link href="/app/crm/import">
          <Button>Import</Button>
        </Link>
      </div>

      <Card className="p-5">
        <div className="text-xs uppercase tracking-wide text-slate-600">Total (last 100)</div>
        <div className="mt-2 text-2xl font-semibold">{formatCurrency(total, "USD")}</div>
        <div className="mt-1 text-xs text-slate-500">Currency total is shown in USD for display; donations may have mixed currencies.</div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Donor</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {(donations || []).map((d: any) => {
                const donor = d.donor;
                const name =
                  getDonorDisplayName(donor) ||
                  (donor ? (donor.donor_type === "organization" ? "Organization" : "Individual") : "Unknown");
                const canReceipt = isReceiptEligibleForDonor(donor);
                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-3">{new Date(d.donated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {donor?.id ? (
                        <Link className="underline underline-offset-4" href={`/app/crm/donors/${donor.id}`}>
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(Number(d.amount), d.currency || "USD")}</td>
                    <td className="px-4 py-3">{d.campaign || "—"}</td>
                    <td className="px-4 py-3">{d.channel || "—"}</td>
                    <td className="px-4 py-3">
                      {canReceipt ? (
                        <a className="btn btn-secondary text-xs" href={`/api/receipts/donations/${d.id}`}>
                          Receipt
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Missing donor info</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!donations || donations.length === 0) && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={6}>
                    No donations yet.
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
