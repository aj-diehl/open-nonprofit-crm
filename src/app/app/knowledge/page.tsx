import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { DeleteDocumentButton, KnowledgeAutoRefresh, UploadDocForm } from "./ui";
import { updateDocumentTagsAction } from "./actions";
import { embedText } from "@/lib/ai/embeddings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function KnowledgePage({ searchParams }: { searchParams: { q?: string; tag?: string } }) {
  const q = (searchParams?.q || "").trim();
  const tag = (searchParams?.tag || "").trim().toLowerCase();
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const isExec = viewer?.profile?.role === "executive";

  let docsQuery = supabase
    .from("documents")
    .select("id, file_name, status, created_at, tags")
    .eq("org_id", orgId);

  if (tag) {
    docsQuery = docsQuery.contains("tags", { labels: [tag] });
  }

  const { data: docs } = await docsQuery.order("created_at", { ascending: false }).limit(50);
  const pendingCount = (docs || []).filter((doc) => doc.status === "processing" || doc.status === "uploaded").length;

  let hits: any[] = [];
  if (q) {
    const embedding = await embedText(q);
    const { data } = await supabase.rpc("match_document_chunks", {
      p_org_id: orgId,
      p_query_embedding: embedding,
      p_match_count: 8,
    });
    hits = data || [];
  }

  return (
    <div className="space-y-6">
      <KnowledgeAutoRefresh active={pendingCount > 0} />
      <div>
        <h1 className="text-2xl font-semibold">Knowledge base</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload org context (plans, financials, program docs). Agents retrieve from here when drafting grants and communications.
        </p>
        <Alert className="mt-4 flex items-center gap-3 border-emerald-200 bg-emerald-50 text-emerald-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
              <path d="M5 16l.75 1.75L7.5 18l-1.75.75L5 20l-.75-1.25L2.5 18l1.75-.25L5 16z" />
            </svg>
          </span>
          <div className="text-xs text-emerald-800/80">
            Coming Soon: Connect your sources like Google Drive and Sharepoint.
          </div>
          <span className="ml-auto rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
            Soon
          </span>
        </Alert>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b bg-white/60 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold">Documents</div>
              <div className="mt-1 text-sm text-slate-600">
                Store program docs, plans, and financials. Tag and search everything from one place.
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <form action="/app/knowledge" method="get" className="flex w-full max-w-xl items-center gap-2">
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Search the knowledge base..."
                  className="min-w-[220px]"
                />
                {tag ? <input type="hidden" name="tag" value={tag} /> : null}
                <Button type="submit" variant="secondary">
                  Search
                </Button>
                {q ? (
                  <Link
                    className="text-sm text-slate-600 underline underline-offset-4"
                    href={buildRedirectPath("", tag)}
                  >
                    Clear
                  </Link>
                ) : null}
              </form>
              <details className="w-full sm:w-auto">
                <summary className="btn btn-primary w-full cursor-pointer list-none justify-center text-sm sm:w-auto [&::-webkit-details-marker]:hidden">
                  Upload a document
                </summary>
                <div className="mt-3 rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-600">
                    Supported: PDF, DOCX, TXT, MD, CSV, XLSX. Files are stored privately and indexed into vector search.
                  </div>
                  <div className="mt-3">
                    <UploadDocForm />
                  </div>
                </div>
              </details>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <form className="flex flex-wrap items-center gap-2" action="/app/knowledge" method="get">
              {q ? <input type="hidden" name="q" value={q} /> : null}
              <Input name="tag" defaultValue={tag} placeholder="Filter by tag" className="max-w-xs" />
              <Button type="submit" variant="secondary">
                Filter
              </Button>
            </form>
            {tag ? (
              <Link className="text-sm text-slate-600 underline underline-offset-4" href={buildRedirectPath(q, "")}>
                Clear filter
              </Link>
            ) : null}
          </div>
        </div>

        <div className="p-6">
          {pendingCount > 0 ? (
            <Alert className="mb-4">
              {pendingCount} document{pendingCount === 1 ? "" : "s"} indexing. This list updates automatically.
            </Alert>
          ) : null}
          {q ? (
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Search results</div>
                <div className="text-xs text-slate-500">
                  {hits.length} result{hits.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {hits.map((h) => (
                  <div key={h.chunk_id} className="rounded-lg border bg-white p-3">
                    <div className="text-xs text-slate-600">
                      doc: {String(h.document_id).slice(0, 8)}... · similarity: {Number(h.similarity).toFixed(3)}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{h.content}</div>
                  </div>
                ))}
                {hits.length === 0 ? <div className="text-sm text-slate-600">No results.</div> : null}
              </div>
            </div>
          ) : null}

          <div className={q ? "mt-6" : undefined}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Documents</div>
              <div className="text-xs text-slate-500">{(docs || []).length} total</div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Document</th>
                    <th className="px-4 py-3">Tags</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(docs || []).map((d) => {
                    const labels = getLabelTags(d.tags);
                    return (
                      <tr key={d.id} className="border-t align-top">
                        <td className="px-4 py-3">
                          <Link href={`/app/knowledge/${d.id}`} className="font-medium text-slate-900 hover:underline">
                            {d.file_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
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
                          ) : (
                            <div className="text-xs text-slate-400">No tags yet.</div>
                          )}
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-slate-500 underline underline-offset-4 list-none [&::-webkit-details-marker]:hidden">
                              {labels.length ? "Edit tags" : "Add tags"}
                            </summary>
                            <form className="mt-2 flex flex-wrap items-center gap-2" action={updateDocumentTagsAction}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="redirectTo" value={buildRedirectPath(q, tag)} />
                              <Input
                                name="tags"
                                defaultValue={labels.join(", ")}
                                placeholder="Tags (comma-separated)"
                                className="max-w-sm"
                              />
                              <Button type="submit" variant="secondary">
                                Save
                              </Button>
                            </form>
                          </details>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{new Date(d.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-600">{d.status}</div>
                        </td>
                        <td className="px-4 py-3">
                          {isExec ? (
                            <DeleteDocumentButton documentId={d.id} redirectTo={buildRedirectPath(q, tag)} />
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(!docs || docs.length === 0) && (
                    <tr>
                      <td className="px-4 py-6 text-slate-600" colSpan={5}>
                        No documents yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function getLabelTags(tags: unknown): string[] {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return [];
  const labels = (tags as Record<string, any>).labels;
  if (!Array.isArray(labels)) return [];
  return labels.filter((label) => typeof label === "string");
}

function buildRedirectPath(q: string, tag: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  const query = params.toString();
  return query ? `/app/knowledge?${query}` : "/app/knowledge";
}
