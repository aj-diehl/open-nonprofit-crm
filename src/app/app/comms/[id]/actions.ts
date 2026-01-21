"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { runCommsWorkflow } from "@/lib/ai/workflows/comms";
import { createAgentRun } from "@/lib/ai/runs";
import { audit } from "@/lib/audit/audit";
import { completeBackgroundJob, createBackgroundJob, runInBackground, updateBackgroundJob } from "@/lib/jobs/background";

const schema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export async function updateDraftAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = schema.parse({
    id: String(formData.get("id")),
    title: String(formData.get("title") || "").trim(),
    subject: String(formData.get("subject") || "").trim() || undefined,
    body: String(formData.get("body") || "").trim() || undefined,
  });

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("comms_drafts")
    .update({
      title: parsed.title,
      subject: parsed.subject || null,
      body: parsed.body || null,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", parsed.id);

  if (error) throw new Error("Unable to update draft");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "comms.draft.updated",
    entityType: "comms_draft",
    entityId: parsed.id,
  });

  revalidatePath(`/app/comms/${parsed.id}`);
}

const generateSchema = z.object({
  id: z.string().uuid(),
});

export async function generateDraftAction(id: string) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const userId = viewer?.user?.id;
  if (!orgId || !userId) throw new Error("Not authenticated");

  const parsed = generateSchema.parse({ id });
  const job = await createBackgroundJob({
    orgId,
    userId,
    type: "comms_draft",
    title: "Comms draft",
    returnPath: `/app/comms/${parsed.id}`,
    entityType: "comms_draft",
    entityId: parsed.id,
    metadata: { draft_id: parsed.id },
  });

  runInBackground(async () => {
    const admin = createSupabaseAdminClient();
    try {
      const { data: draft, error } = await admin
        .from("comms_drafts")
        .select("id, type, title, audience, goal, tone, length, call_to_action")
        .eq("org_id", orgId)
        .eq("id", parsed.id)
        .single();

      if (error || !draft) throw new Error("Draft not found");

      const run = await createAgentRun({
        orgId,
        userId,
        workflow: "comms_draft",
        input: { job_id: job.id, draft_id: parsed.id },
      });

      await updateBackgroundJob({ jobId: job.id, agentRunId: run.id });

      const generated = await runCommsWorkflow({
        orgId,
        userId,
        input: {
          type: draft.type,
          title: draft.title,
          audience: draft.audience || undefined,
          goal: draft.goal,
          tone: draft.tone || undefined,
          length: draft.length || undefined,
          callToAction: draft.call_to_action || undefined,
        },
        runId: run.id,
      });

      const { error: updateError } = await admin
        .from("comms_drafts")
        .update({
          subject: generated.subject || null,
          body: generated.body || null,
          metadata: generated.metadata || null,
          agent_run_id: generated.agentRunId,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgId)
        .eq("id", parsed.id);

      if (updateError) throw new Error("Unable to update draft");

      await audit(admin, {
        orgId,
        actorId: userId,
        action: "comms.draft.generated",
        entityType: "comms_draft",
        entityId: parsed.id,
        metadata: { agentRunId: generated.agentRunId },
      });

      await completeBackgroundJob({ jobId: job.id, status: "succeeded" });
    } catch (e: any) {
      await completeBackgroundJob({ jobId: job.id, status: "failed", error: e?.message || String(e) });
    }
  });

  return { jobId: job.id };
}

const archiveSchema = z.object({
  id: z.string().uuid(),
});

export async function archiveDraftAction(id: string) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = archiveSchema.parse({ id });
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("comms_drafts")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", parsed.id);

  if (error) throw new Error("Unable to archive draft");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "comms.draft.archived",
    entityType: "comms_draft",
    entityId: parsed.id,
  });

  revalidatePath(`/app/comms/${parsed.id}`);
  revalidatePath("/app/comms");
}

export async function restoreDraftAction(id: string) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = archiveSchema.parse({ id });
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("comms_drafts")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", parsed.id);

  if (error) throw new Error("Unable to restore draft");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "comms.draft.restored",
    entityType: "comms_draft",
    entityId: parsed.id,
  });

  revalidatePath(`/app/comms/${parsed.id}`);
  revalidatePath("/app/comms");
}

export async function deleteDraftAction(id: string) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");
  if (viewer.profile?.role !== "executive") throw new Error("Not authorized");

  const parsed = archiveSchema.parse({ id });
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("comms_drafts").delete().eq("org_id", orgId).eq("id", parsed.id);
  if (error) throw new Error("Unable to delete draft");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "comms.draft.deleted",
    entityType: "comms_draft",
    entityId: parsed.id,
  });

  revalidatePath("/app/comms");
}
