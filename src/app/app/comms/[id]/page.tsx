import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DraftEditor } from "./ui";

export default async function DraftDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const draftId = params.id;
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const isExec = viewer?.profile?.role === "executive";

  const { data: draft } = await supabase.from("comms_drafts").select("*").eq("org_id", orgId).eq("id", draftId).single();
  if (!draft) return notFound();

  const generateParam = searchParams?.generate;
  const autoGenerate = Array.isArray(generateParam) ? generateParam[0] === "1" : generateParam === "1";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Communication draft</div>
          <h1 className="text-2xl font-semibold">{draft.title}</h1>
          <div className="mt-1 text-sm text-slate-600">
            Type: <span className="font-medium text-slate-900">{draft.type}</span>
            {draft.audience ? (
              <>
                <span className="mx-2">·</span>
                Audience: <span className="font-medium text-slate-900">{draft.audience}</span>
              </>
            ) : null}
          </div>
        </div>
        <Link href="/app/comms">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <Card className="p-6">
        <DraftEditor
          draft={draft}
          autoGenerate={autoGenerate}
          isArchived={Boolean(draft.archived_at)}
          canDelete={isExec}
        />
      </Card>

    </div>
  );
}
