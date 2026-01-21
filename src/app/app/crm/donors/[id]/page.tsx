import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DonationForm, InteractionForm } from "./ui";
import { formatCurrency } from "@/lib/shared/money";
import { isReceiptEligibleForDonor } from "@/lib/receipts/donor";

export default async function DonorDetailPage({ params }: { params: { id: string } }) {
  const donorId = params.id;
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;

  const { data: donor } = await supabase.from("donors").select("*").eq("org_id", orgId).eq("id", donorId).single();
  if (!donor) return notFound();

  const { data: donations } = await supabase
    .from("donations")
    .select("id, amount, currency, donated_at, campaign, channel")
    .eq("org_id", orgId)
    .eq("donor_id", donorId)
    .order("donated_at", { ascending: false })
    .limit(50);

  const { data: interactions } = await supabase
    .from("interactions")
    .select("id, type, subject, body, occurred_at, created_at")
    .eq("org_id", orgId)
    .eq("donor_id", donorId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  const total = (donations || []).reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const displayName =
    donor.donor_type === "organization"
      ? donor.organization_name || "Organization"
      : `${donor.first_name || ""} ${donor.last_name || ""}`.trim() || "Individual";
  const canReceipt = isReceiptEligibleForDonor(donor);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Donor</div>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <div className="mt-1 text-sm text-slate-600">
            {donor.email ? <span className="mr-2">{donor.email}</span> : null}
            {donor.phone ? <span className="mr-2">{donor.phone}</span> : null}
          </div>
        </div>
        <Link href="/app/crm/donors">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-medium">Donations</div>
              <div className="mt-1 text-sm text-slate-600">Total: {formatCurrency(total, donor.currency || "USD")}</div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {(donations || []).map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">{new Date(d.donated_at).toLocaleDateString()}</td>
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
              ))}
              {(!donations || donations.length === 0) && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={5}>
                    No donations yet.
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          {donor.notes ? (
            <Card className="p-6">
              <div className="font-medium">Notes</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{donor.notes}</div>
            </Card>
          ) : null}
          <Card className="p-6">
            <div className="font-medium">Add donation</div>
            <div className="mt-4">
              <DonationForm donorId={donorId} currency={donor.currency || "USD"} />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="font-medium">Interactions</div>
          <div className="mt-4 space-y-3">
            {(interactions || []).map((i) => (
              <div key={i.id} className="rounded-lg border bg-white p-3">
                <div className="text-xs text-slate-600">{new Date(i.occurred_at).toLocaleString()}</div>
                <div className="mt-1 text-sm font-medium">{i.type}{i.subject ? ` · ${i.subject}` : ""}</div>
                {i.body ? <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{i.body}</div> : null}
              </div>
            ))}
            {(!interactions || interactions.length === 0) ? <div className="text-sm text-slate-600">No interactions yet.</div> : null}
          </div>
        </Card>

        <Card className="p-6">
          <div className="font-medium">Log interaction</div>
          <div className="mt-4">
            <InteractionForm donorId={donorId} />
          </div>
        </Card>
      </div>
    </div>
  );
}
