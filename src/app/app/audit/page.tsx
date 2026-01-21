import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";

export default async function AuditPage() {
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;

  const { data: events } = await supabase
    .from("audit_events")
    .select("id, action, entity_type, entity_id, actor_id, created_at, metadata")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="mt-1 text-sm text-slate-600">High-signal events for governance and security.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {(events || []).map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-3">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{e.action}</td>
                  <td className="px-4 py-3">
                    {e.entity_type} · {String(e.entity_id).slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(e.metadata || {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {(!events || events.length === 0) && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={4}>
                    No events yet.
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
