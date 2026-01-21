import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BackgroundJobStatus = "queued" | "running" | "succeeded" | "failed";

export type BackgroundJob = {
  id: string;
  org_id: string;
  created_by: string | null;
  type: string;
  status: BackgroundJobStatus;
  title: string | null;
  return_path: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: any;
  error: string | null;
  agent_run_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export async function createBackgroundJob({
  orgId,
  userId,
  type,
  title,
  returnPath,
  entityType,
  entityId,
  metadata,
}: {
  orgId: string;
  userId: string;
  type: string;
  title?: string;
  returnPath?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}): Promise<BackgroundJob> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("background_jobs")
    .insert({
      org_id: orgId,
      created_by: userId,
      type,
      status: "running",
      title: title || null,
      return_path: returnPath || null,
      entity_type: entityType || null,
      entity_id: entityId || null,
      metadata: metadata || null,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("Unable to start background job");
  return data as BackgroundJob;
}

export async function updateBackgroundJob({
  jobId,
  agentRunId,
}: {
  jobId: string;
  agentRunId?: string;
}) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("background_jobs")
    .update({
      agent_run_id: agentRunId ?? null,
    })
    .eq("id", jobId);
}

export async function completeBackgroundJob({
  jobId,
  status,
  error,
}: {
  jobId: string;
  status: "succeeded" | "failed";
  error?: string;
}) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("background_jobs")
    .update({
      status,
      error: error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export function runInBackground(task: () => Promise<void>) {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      console.error("[background] job failed", error);
    }
  };

  if (typeof setImmediate !== "undefined") {
    setImmediate(() => {
      void run();
    });
  } else {
    setTimeout(() => {
      void run();
    }, 0);
  }
}
