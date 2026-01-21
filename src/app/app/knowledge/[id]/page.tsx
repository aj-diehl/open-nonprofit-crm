import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteDocumentButton } from "../ui";

export default async function KnowledgeDocumentPage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const isExec = viewer?.profile?.role === "executive";

  const supabase = createSupabaseServerClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, file_name, mime_type, storage_path, status, summary, tags, created_at")
    .eq("org_id", orgId)
    .eq("id", params.id)
    .single();

  if (!doc) return notFound();

  const labels = getLabelTags(doc.tags);
  const admin = createSupabaseAdminClient();
  let signedUrl: string | null = null;

  if (doc.storage_path) {
    const bucket = process.env.SUPABASE_DOCS_BUCKET || "documents";
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(doc.storage_path, 60 * 60);
    if (!error) signedUrl = data?.signedUrl || null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Knowledge base</div>
          <h1 className="text-2xl font-semibold">{doc.file_name}</h1>
          <div className="mt-1 text-sm text-slate-600">
            Uploaded {new Date(doc.created_at).toLocaleString()}
            <span className="mx-2">|</span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">{doc.status}</span>
            {doc.mime_type ? (
              <>
                <span className="mx-2">|</span>
                <span>{doc.mime_type}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {signedUrl ? (
            <Link href={signedUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary">Open file</Button>
            </Link>
          ) : null}
          <Link href="/app/knowledge">
            <Button variant="secondary">Back</Button>
          </Link>
        </div>
      </div>

      {labels.length ? (
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <Link
              key={label}
              href={`/app/knowledge?tag=${encodeURIComponent(label)}`}
              className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
            >
              {label}
            </Link>
          ))}
        </div>
      ) : null}

      {doc.summary ? (
        <Card className="p-6">
          <div className="text-sm font-medium">Summary</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{doc.summary}</div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        {signedUrl && isInlinePreviewable(doc.mime_type) ? (
          <iframe title={`${doc.file_name} preview`} src={signedUrl} className="h-[70vh] w-full bg-white" />
        ) : (
          <div className="p-6 text-sm text-slate-600">
            {signedUrl
              ? "Preview is not available for this file type. Use \"Open file\" to view or download."
              : "Preview not available yet."}
          </div>
        )}
      </Card>

      {isExec ? (
        <Card className="p-6">
          <div className="font-medium">Danger zone</div>
          <div className="mt-2 text-sm text-slate-600">Deleting removes the file and its indexed chunks.</div>
          <div className="mt-4">
            <DeleteDocumentButton documentId={doc.id} redirectTo="/app/knowledge" />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function isInlinePreviewable(mimeType: string | null) {
  if (!mimeType) return false;
  if (mimeType.startsWith("image/")) return true;
  if (mimeType === "application/pdf") return true;
  if (mimeType.startsWith("text/")) return true;
  return false;
}

function getLabelTags(tags: unknown): string[] {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return [];
  const labels = (tags as Record<string, any>).labels;
  if (!Array.isArray(labels)) return [];
  return labels.filter((label) => typeof label === "string");
}
