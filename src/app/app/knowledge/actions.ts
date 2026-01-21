"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { createDocumentRecord, processDocumentContent, uploadDocumentFile } from "@/lib/documents/ingest";
import { audit } from "@/lib/audit/audit";
import { completeBackgroundJob, createBackgroundJob, runInBackground } from "@/lib/jobs/background";

export type UploadDocState = { error?: string };

export async function uploadDocAction(_prev: UploadDocState, formData: FormData): Promise<UploadDocState> {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) return { error: "Not authenticated." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Please choose a file." };
  const tagInput = String(formData.get("tags") || "");
  const labels = normalizeTags(tagInput);

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  let docId = "";
  try {
    const doc = await createDocumentRecord({
      admin,
      orgId,
      userId: viewer.user.id,
      file,
      tags: labels.length ? { kind: "org_doc", labels } : { kind: "org_doc" },
    });
    docId = doc.id;
    await uploadDocumentFile({ admin, orgId, documentId: doc.id, file });
  } catch (e: any) {
    return { error: e?.message || "Unable to upload document." };
  }

  const job = await createBackgroundJob({
    orgId,
    userId: viewer.user.id,
    type: "document_ingest",
    title: "Document indexing",
    returnPath: "/app/knowledge",
    entityType: "document",
    entityId: docId,
  });

  runInBackground(async () => {
    const adminClient = createSupabaseAdminClient();
    try {
      await processDocumentContent({ admin: adminClient, orgId, documentId: docId, file });
      await completeBackgroundJob({ jobId: job.id, status: "succeeded" });
    } catch (e: any) {
      await completeBackgroundJob({ jobId: job.id, status: "failed", error: e?.message || String(e) });
    }
  });

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "document.uploaded",
    entityType: "document",
    entityId: docId,
    metadata: { fileName: file.name },
  });

  redirect("/app/knowledge");
}

export async function updateDocumentTagsAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated.");

  const id = String(formData.get("id") || "").trim();
  const tagInput = String(formData.get("tags") || "");
  const redirectTo = String(formData.get("redirectTo") || "/app/knowledge");
  if (!id) throw new Error("Missing document id");

  const labels = normalizeTags(tagInput);
  const supabase = createSupabaseServerClient();

  const { data: doc } = await supabase.from("documents").select("tags").eq("org_id", orgId).eq("id", id).single();
  const existing = isPlainObject(doc?.tags) ? (doc?.tags as Record<string, any>) : {};

  const nextTags: Record<string, any> = { ...existing };
  if (labels.length) nextTags.labels = labels;
  else delete nextTags.labels;

  const finalTags = Object.keys(nextTags).length > 0 ? nextTags : null;

  const { error } = await supabase
    .from("documents")
    .update({ tags: finalTags })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error("Unable to update tags");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "document.tags.updated",
    entityType: "document",
    entityId: id,
    metadata: { labels },
  });

  redirect(redirectTo);
}

export async function deleteDocumentAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated.");
  if (viewer.profile?.role !== "executive") throw new Error("Not authorized.");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing document id");

  const supabase = createSupabaseServerClient();
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, file_name, storage_path")
    .eq("org_id", orgId)
    .eq("id", id)
    .single();

  if (fetchError || !doc) throw new Error("Document not found");

  const { error: deleteError } = await supabase.from("documents").delete().eq("org_id", orgId).eq("id", id);
  if (deleteError) throw new Error("Unable to delete document");

  const admin = createSupabaseAdminClient();
  if (doc.storage_path) {
    const bucket = process.env.SUPABASE_DOCS_BUCKET || "documents";
    const { error: storageError } = await admin.storage.from(bucket).remove([doc.storage_path]);
    if (storageError) {
      console.warn("Failed to remove document from storage", storageError);
    }
  }

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "document.deleted",
    entityType: "document",
    entityId: id,
    metadata: { fileName: doc.file_name },
  });

  revalidatePath("/app/knowledge");
}

function normalizeTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
