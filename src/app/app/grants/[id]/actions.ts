"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";
import { runGrantWriterWorkflow } from "@/lib/ai/workflows/grantWriter";
import { createAgentRun } from "@/lib/ai/runs";
import { completeBackgroundJob, createBackgroundJob, runInBackground, updateBackgroundJob } from "@/lib/jobs/background";
import { createDocumentRecord, processDocumentContent, uploadDocumentFile } from "@/lib/documents/ingest";

const questionSchema = z.object({
  grantId: z.string().uuid(),
  question: z.string().min(3),
  constraints: z.string().optional(),
  maxWords: z.coerce.number().optional(),
});

export async function addGrantQuestionAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = questionSchema.parse({
    grantId: String(formData.get("grantId")),
    question: String(formData.get("question") || "").trim(),
    constraints: String(formData.get("constraints") || "").trim() || undefined,
    maxWords: formData.get("maxWords") ? formData.get("maxWords") : undefined,
  });

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("grant_questions")
    .insert({
      org_id: orgId,
      grant_id: parsed.grantId,
      question: parsed.question,
      constraints: parsed.constraints || null,
      max_words: parsed.maxWords ?? null,
      created_by: viewer.user.id,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error("Unable to add question");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.question.create",
    entityType: "grant_question",
    entityId: data.id,
    metadata: { grantId: parsed.grantId },
  });

  revalidatePath(`/app/grants/${parsed.grantId}`);
}

const genSchema = z.object({
  grantId: z.string().uuid(),
});

export async function generateGrantDraftsAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");
  const userId = viewer.user.id;

  const parsed = genSchema.parse({
    grantId: String(formData.get("grantId")),
  });

  const job = await createBackgroundJob({
    orgId,
    userId,
    type: "grant_drafts",
    title: "Grant drafts",
    returnPath: `/app/grants/${parsed.grantId}`,
    entityType: "grant",
    entityId: parsed.grantId,
    metadata: { grant_id: parsed.grantId },
  });

  runInBackground(async () => {
    const admin = createSupabaseAdminClient();
    try {
      const { data: grant } = await admin.from("grants").select("*").eq("id", parsed.grantId).eq("org_id", orgId).single();
      if (!grant) throw new Error("Grant not found");

      const { data: questions } = await admin
        .from("grant_questions")
        .select("id, question, constraints, max_words")
        .eq("org_id", orgId)
        .eq("grant_id", parsed.grantId)
        .order("created_at", { ascending: true });

      if (!questions || questions.length === 0) throw new Error("Add at least one question first.");

      const run = await createAgentRun({
        orgId,
        userId,
        workflow: "grant_writer",
        input: { job_id: job.id, grant_id: parsed.grantId },
      });

      await updateBackgroundJob({ jobId: job.id, agentRunId: run.id });

      const result = await runGrantWriterWorkflow({
        orgId,
        userId,
        grant,
        questions,
        runId: run.id,
      });

      // Upsert drafts to grant_answers
      const rows = result.answers.map((a) => ({
        org_id: orgId,
        grant_id: parsed.grantId,
        question_id: a.question_id,
        draft: a.draft,
        citations: a.citations || null,
        confidence: a.confidence ?? null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await admin.from("grant_answers").upsert(rows, { onConflict: "org_id,question_id" });
      if (error) throw new Error("Unable to save draft answers");

      await audit(admin, {
        orgId,
        actorId: userId,
        action: "grant.drafts.generated",
        entityType: "grant",
        entityId: parsed.grantId,
        metadata: { questionCount: questions.length, agentRunId: result.agentRunId },
      });

      await completeBackgroundJob({ jobId: job.id, status: "succeeded" });
    } catch (e: any) {
      await completeBackgroundJob({ jobId: job.id, status: "failed", error: e?.message || String(e) });
    }
  });

  return { jobId: job.id };
}

const finalSchema = z.object({
  answerId: z.string().uuid(),
  grantId: z.string().uuid(),
  finalText: z.string().min(1),
});

export async function saveFinalGrantAnswerAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = finalSchema.parse({
    answerId: String(formData.get("answerId")),
    grantId: String(formData.get("grantId")),
    finalText: String(formData.get("finalText") || "").trim(),
  });

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("grant_answers")
    .update({ final: parsed.finalText, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", parsed.answerId);

  if (error) throw new Error("Unable to save final answer");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.answer.finalized",
    entityType: "grant_answer",
    entityId: parsed.answerId,
    metadata: { grantId: parsed.grantId },
  });

  revalidatePath(`/app/grants/${parsed.grantId}`);
}

const uploadSchema = z.object({
  grantId: z.string().uuid(),
});

export async function uploadGrantGuidelinesAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = uploadSchema.parse({
    grantId: String(formData.get("grantId")),
  });

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("File missing");

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const doc = await createDocumentRecord({
    admin,
    orgId,
    userId: viewer.user.id,
    file,
    tags: { kind: "grant_guidelines", grant_id: parsed.grantId },
  });
  await uploadDocumentFile({ admin, orgId, documentId: doc.id, file });

  // Link document to grant
  await admin.from("grant_documents").insert({ org_id: orgId, grant_id: parsed.grantId, document_id: doc.id });

  const job = await createBackgroundJob({
    orgId,
    userId: viewer.user.id,
    type: "grant_guidelines_ingest",
    title: "Grant guidelines indexing",
    returnPath: `/app/grants/${parsed.grantId}`,
    entityType: "document",
    entityId: doc.id,
    metadata: { grantId: parsed.grantId },
  });

  runInBackground(async () => {
    const adminClient = createSupabaseAdminClient();
    try {
      await processDocumentContent({ admin: adminClient, orgId, documentId: doc.id, file });
      await completeBackgroundJob({ jobId: job.id, status: "succeeded" });
    } catch (e: any) {
      await completeBackgroundJob({ jobId: job.id, status: "failed", error: e?.message || String(e) });
    }
  });

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.guidelines.uploaded",
    entityType: "document",
    entityId: doc.id,
    metadata: { grantId: parsed.grantId },
  });

  revalidatePath(`/app/grants/${parsed.grantId}`);
}

const deleteQuestionSchema = z.object({
  grantId: z.string().uuid(),
  questionId: z.string().uuid(),
});

export async function deleteGrantQuestionAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = deleteQuestionSchema.parse({
    grantId: String(formData.get("grantId")),
    questionId: String(formData.get("questionId")),
  });

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("grant_questions")
    .delete()
    .eq("org_id", orgId)
    .eq("id", parsed.questionId)
    .eq("grant_id", parsed.grantId);

  if (error) throw new Error("Unable to delete question");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.question.deleted",
    entityType: "grant_question",
    entityId: parsed.questionId,
    metadata: { grantId: parsed.grantId },
  });

  revalidatePath(`/app/grants/${parsed.grantId}`);
}

const archiveGrantSchema = z.object({
  grantId: z.string().uuid(),
});

export async function archiveGrantAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = archiveGrantSchema.parse({
    grantId: String(formData.get("grantId")),
  });

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("grants")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", parsed.grantId);

  if (error) throw new Error("Unable to archive grant");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.archived",
    entityType: "grant",
    entityId: parsed.grantId,
  });

  revalidatePath(`/app/grants/${parsed.grantId}`);
  revalidatePath("/app/grants");
}

export async function restoreGrantAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = archiveGrantSchema.parse({
    grantId: String(formData.get("grantId")),
  });

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("grants")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", parsed.grantId);

  if (error) throw new Error("Unable to restore grant");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.restored",
    entityType: "grant",
    entityId: parsed.grantId,
  });

  revalidatePath(`/app/grants/${parsed.grantId}`);
  revalidatePath("/app/grants");
}

const processSchema = z.object({
  grantId: z.string().uuid(),
  stage: z.enum(["draft", "submitted", "verdict"]),
  outcome: z.enum(["awarded", "declined"]).optional(),
  awardedAmountMin: z.coerce.number().optional(),
  awardedAmountMax: z.coerce.number().optional(),
});

export async function updateGrantProcessAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = processSchema.parse({
    grantId: String(formData.get("grantId")),
    stage: String(formData.get("stage") || "draft"),
    outcome: String(formData.get("outcome") || "").trim() || undefined,
    awardedAmountMin: formData.get("awardedAmountMin") ? formData.get("awardedAmountMin") : undefined,
    awardedAmountMax: formData.get("awardedAmountMax") ? formData.get("awardedAmountMax") : undefined,
  });

  let status = "writing";
  let awarded_amount_min: number | null = null;
  let awarded_amount_max: number | null = null;

  if (parsed.stage === "submitted") {
    status = "submitted";
  } else if (parsed.stage === "verdict") {
    if (!parsed.outcome) throw new Error("Select an outcome for verdicts");
    status = parsed.outcome;
    if (parsed.outcome === "awarded") {
      awarded_amount_min = parsed.awardedAmountMin ?? null;
      awarded_amount_max = parsed.awardedAmountMax ?? null;
      if (
        awarded_amount_min !== null &&
        awarded_amount_max !== null &&
        awarded_amount_min > awarded_amount_max
      ) {
        throw new Error("Awarded amount min cannot exceed max");
      }
    }
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("grants")
    .update({
      status,
      awarded_amount_min,
      awarded_amount_max,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", parsed.grantId);

  if (error) throw new Error("Unable to update grant status");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.process.updated",
    entityType: "grant",
    entityId: parsed.grantId,
    metadata: { stage: parsed.stage, outcome: parsed.outcome, awarded_amount_min, awarded_amount_max },
  });

  revalidatePath(`/app/grants/${parsed.grantId}`);
  revalidatePath("/app/grants");
}

const deleteGrantSchema = z.object({
  grantId: z.string().uuid(),
});

export async function deleteGrantAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");
  if (viewer.profile?.role !== "executive") throw new Error("Not authorized");

  const parsed = deleteGrantSchema.parse({
    grantId: String(formData.get("grantId")),
  });

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("grants").delete().eq("org_id", orgId).eq("id", parsed.grantId);
  if (error) throw new Error("Unable to delete grant");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.deleted",
    entityType: "grant",
    entityId: parsed.grantId,
  });

  revalidatePath("/app/grants");
}
