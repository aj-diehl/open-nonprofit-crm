import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function CommsPage({ searchParams }: { searchParams?: { archived?: string } }) {
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const showArchived = searchParams?.archived === "1";

  let query = supabase
    .from("comms_drafts")
    .select("id, title, type, audience, created_at, updated_at, archived_at")
    .eq("org_id", orgId);

  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data: drafts } = await query.order("updated_at", { ascending: false }).limit(100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Communications</h1>
          <p className="mt-1 text-sm text-slate-600">AI-assisted drafts for emails, newsletters, articles, and more.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={showArchived ? "/app/comms" : "/app/comms?archived=1"}>
            <Button variant="secondary">{showArchived ? "View active" : "View archived"}</Button>
          </Link>
          <Link href="/app/comms/new">
            <Button>New draft</Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(drafts || []).map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link className="font-medium underline underline-offset-4" href={`/app/comms/${d.id}`}>
                      {d.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{d.type}</td>
                  <td className="px-4 py-3">{d.audience || "—"}</td>
                  <td className="px-4 py-3">{d.archived_at ? "Archived" : "Active"}</td>
                  <td className="px-4 py-3">{new Date(d.updated_at || d.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(!drafts || drafts.length === 0) && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={5}>
                    {showArchived ? "No archived drafts yet." : "No drafts yet."}
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
