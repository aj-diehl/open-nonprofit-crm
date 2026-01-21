import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { ImportForm } from "./ui";

export default async function ImportPage() {
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;

  const { data: jobs } = await supabase
    .from("ingestion_jobs")
    .select("id, type, status, created_at, completed_at, file_name, stats, error")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a spreadsheet (CSV/XLSX). We use an LLM to map columns into a standardized CRM schema.
        </p>
      </div>

      <Card className="p-6">
        <ImportForm />
      </Card>

      <Card className="p-6">
        <div className="font-medium">Recent import jobs</div>
        <div className="mt-4 space-y-2">
          {(jobs || []).map((j) => (
            <div key={j.id} className="rounded-lg border bg-white px-3 py-2">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-medium">
                  {j.type} · <span className="text-slate-600">{j.file_name}</span>
                </div>
                <div className="text-xs text-slate-600">{new Date(j.created_at).toLocaleString()}</div>
              </div>
              <div className="mt-1 text-xs">
                <span
                  className={
                    "font-medium " +
                    (j.status === "succeeded"
                      ? "text-success"
                      : j.status === "failed"
                        ? "text-danger"
                        : "text-slate-700")
                  }
                >
                  {j.status}
                </span>
                {j.stats ? (
                  <span className="ml-2 text-slate-600">
                    created: {j.stats.created ?? 0}, updated: {j.stats.updated ?? 0}, skipped: {j.stats.skipped ?? 0}
                  </span>
                ) : null}
              </div>
              {j.stats?.reviewRequired ? (
                <div className="mt-1 text-xs text-amber-700">
                  Review required{Array.isArray(j.stats.reviewReasons) && j.stats.reviewReasons.length > 0 ? `: ${j.stats.reviewReasons.join(", ")}` : ""}
                </div>
              ) : null}
              {j.stats?.cleanliness?.notes ? (
                <div className="mt-1 text-xs text-slate-600">Cleanliness: {j.stats.cleanliness.notes}</div>
              ) : null}
              {j.stats?.missingRequired ? (
                <div className="mt-1 text-xs text-slate-600">missing required fields: {j.stats.missingRequired}</div>
              ) : null}
              {j.stats?.errorCount ? (
                <div className="mt-1 text-xs text-danger">
                  errors: {j.stats.errorCount}
                  {Array.isArray(j.stats.errorSamples) && j.stats.errorSamples[0] ? ` — ${j.stats.errorSamples[0]}` : ""}
                </div>
              ) : null}
              {j.error ? <div className="mt-2 text-xs text-danger">{j.error}</div> : null}
            </div>
          ))}
          {(!jobs || jobs.length === 0) && <div className="text-sm text-slate-600">No imports yet.</div>}
        </div>
      </Card>
    </div>
  );
}
