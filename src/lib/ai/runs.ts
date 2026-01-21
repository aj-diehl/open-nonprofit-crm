import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RunRecord = {
  id: string;
  org_id: string;
  created_by: string;
  workflow: string;
  status: "running" | "succeeded" | "failed";
  trace_id?: string | null;
  input?: any;
  output?: any;
  usage?: any;
  error?: string | null;
};

export async function createAgentRun({
  orgId,
  userId,
  workflow,
  input,
}: {
  orgId: string;
  userId: string;
  workflow: string;
  input: any;
}): Promise<RunRecord> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("agent_runs")
    .insert({
      org_id: orgId,
      created_by: userId,
      workflow,
      status: "running",
      input,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("Unable to create agent run");
  return data as RunRecord;
}

export async function completeAgentRun({
  runId,
  status,
  output,
  usage,
  traceId,
  errorMessage,
}: {
  runId: string;
  status: "succeeded" | "failed";
  output?: any;
  usage?: any;
  traceId?: string;
  errorMessage?: string;
}) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("agent_runs")
    .update({
      status,
      output: output ?? null,
      usage: usage ?? null,
      trace_id: traceId ?? null,
      error: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export async function runWorkflow<TOutput>({
  orgId,
  userId,
  workflow,
  input,
  fn,
  runId,
  logInput,
}: {
  orgId: string;
  userId: string;
  workflow: string;
  input: any;
  fn: () => Promise<{ output: TOutput; traceId?: string; usage?: any }>;
  runId?: string;
  logInput?: any;
}): Promise<{ output: TOutput; agentRunId: string; traceId?: string }> {
  const run = runId ? { id: runId } : await createAgentRun({ orgId, userId, workflow, input: logInput ?? input });

  try {
    const res = await fn();
    await completeAgentRun({ runId: run.id, status: "succeeded", output: res.output, usage: res.usage, traceId: res.traceId });
    return { output: res.output, agentRunId: run.id, traceId: res.traceId };
  } catch (e: any) {
    await completeAgentRun({ runId: run.id, status: "failed", errorMessage: e?.message || String(e) });
    throw e;
  }
}
