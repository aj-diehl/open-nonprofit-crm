"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";
import { runOrgDiscoveryWorkflow } from "@/lib/ai/workflows/orgDiscovery";
import { createAgentRun } from "@/lib/ai/runs";
import { completeBackgroundJob, createBackgroundJob, runInBackground, updateBackgroundJob } from "@/lib/jobs/background";

const profileSchema = z.object({
  websiteUrl: z.string().url().optional().or(z.literal("")),
  mission: z.string().optional(),
  programs: z.string().optional(),
  impact: z.string().optional(),
  leadership: z.string().optional(),
  serviceArea: z.string().optional(),
  beneficiaries: z.string().optional(),
  keyMetrics: z.string().optional(),
});

const receiptSchema = z.object({
  receiptAddress: z.string().optional(),
  receiptEIN: z.string().optional(),
  receiptSignerName: z.string().optional(),
  receiptSignerTitle: z.string().optional(),
});

function parseKeyMetricsInput(value?: string) {
  if (!value) return undefined;
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;

  const keyed: Record<string, string> = {};
  let allPairs = true;
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) {
      allPairs = false;
      break;
    }
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!key || !val || key in keyed) {
      allPairs = false;
      break;
    }
    keyed[key] = val;
  }

  return allPairs ? keyed : lines;
}

export async function updateOrgProfileAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = profileSchema.parse({
    websiteUrl: String(formData.get("websiteUrl") || "").trim(),
    mission: String(formData.get("mission") || "").trim() || undefined,
    programs: String(formData.get("programs") || "").trim() || undefined,
    impact: String(formData.get("impact") || "").trim() || undefined,
    leadership: String(formData.get("leadership") || "").trim() || undefined,
    serviceArea: String(formData.get("serviceArea") || "").trim() || undefined,
    beneficiaries: String(formData.get("beneficiaries") || "").trim() || undefined,
    keyMetrics: String(formData.get("keyMetrics") || "").trim() || undefined,
  });

  const keyMetrics = parseKeyMetricsInput(parsed.keyMetrics);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("org_profiles")
    .update({
      website_url: parsed.websiteUrl || null,
      mission: parsed.mission || null,
      programs: parsed.programs || null,
      impact: parsed.impact || null,
      leadership: parsed.leadership || null,
      service_area: parsed.serviceArea || null,
      beneficiaries: parsed.beneficiaries || null,
      key_metrics: keyMetrics ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  if (error) throw new Error("Unable to update org profile");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "org_profile.updated",
    entityType: "org_profile",
    entityId: orgId,
  });

  revalidatePath("/app/org-profile");
}

export async function updateOrgReceiptSettingsAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = receiptSchema.parse({
    receiptAddress: String(formData.get("receiptAddress") || "").trim() || undefined,
    receiptEIN: String(formData.get("receiptEIN") || "").trim() || undefined,
    receiptSignerName: String(formData.get("receiptSignerName") || "").trim() || undefined,
    receiptSignerTitle: String(formData.get("receiptSignerTitle") || "").trim() || undefined,
  });

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("org_profiles")
    .update({
      receipt_address: parsed.receiptAddress || null,
      receipt_ein: parsed.receiptEIN || null,
      receipt_signer_name: parsed.receiptSignerName || null,
      receipt_signer_title: parsed.receiptSignerTitle || null,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  if (error) throw new Error("Unable to update receipt settings");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "org_profile.receipt_settings_updated",
    entityType: "org_profile",
    entityId: orgId,
  });

  revalidatePath("/app/org-profile");
}

export async function uploadOrgLogoAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const file = formData.get("logo");
  if (!(file instanceof File)) throw new Error("Logo file missing");
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    throw new Error("Logo must be a PNG or JPEG image");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Logo must be 2MB or smaller");
  }

  const admin = createSupabaseAdminClient();
  const bucket = process.env.SUPABASE_ORG_LOGOS_BUCKET || "org-logos";
  const ext = guessLogoExtension(file);
  const path = `${orgId}/logo-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage.from(bucket).upload(path, buf, {
    contentType: file.type || undefined,
    upsert: true,
  });

  if (uploadErr) throw new Error("Unable to upload logo");

  const { data: publicData } = admin.storage.from(bucket).getPublicUrl(path);
  const logoUrl = publicData?.publicUrl || null;

  const supabase = createSupabaseServerClient();
  const { error: updateErr } = await supabase
    .from("org_profiles")
    .update({
      logo_url: logoUrl,
      logo_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  if (updateErr) throw new Error("Unable to update org profile");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "org_profile.logo_uploaded",
    entityType: "org_profile",
    entityId: orgId,
    metadata: { logoPath: path },
  });

  revalidatePath("/app/org-profile");
}

export async function runOrgDiscoveryAction() {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");
  const userId = viewer.user.id;

  const job = await createBackgroundJob({
    orgId,
    userId,
    type: "org_discovery",
    title: "Org discovery",
    returnPath: "/app/org-profile",
    entityType: "org_profile",
    entityId: orgId,
  });

  runInBackground(async () => {
    const admin = createSupabaseAdminClient();
    try {
      const { data: org } = await admin.from("organizations").select("name, slug").eq("id", orgId).single();
      const { data: profile } = await admin.from("org_profiles").select("*").eq("org_id", orgId).single();

      const run = await createAgentRun({
        orgId,
        userId,
        workflow: "org_discovery",
        input: { job_id: job.id, org_id: orgId },
      });

      await updateBackgroundJob({ jobId: job.id, agentRunId: run.id });

      const result = await runOrgDiscoveryWorkflow({
        orgId,
        userId,
        organizationName: org?.name || "Organization",
        websiteUrl: profile?.website_url || undefined,
        currentProfile: profile || {},
        runId: run.id,
      });

      await admin.from("org_profile_updates").insert({
        org_id: orgId,
        status: "pending",
        summary: result.summary,
        proposed: result.proposed,
        sources: result.sources || null,
        agent_run_id: result.agentRunId,
        created_by: userId,
      });

      await admin.from("org_profiles").update({ last_discovered_at: new Date().toISOString() }).eq("org_id", orgId);

      await audit(admin, {
        orgId,
        actorId: userId,
        action: "org_profile.discovery_ran",
        entityType: "org_profile",
        entityId: orgId,
        metadata: { agentRunId: result.agentRunId },
      });

      await completeBackgroundJob({ jobId: job.id, status: "succeeded" });
    } catch (e: any) {
      await completeBackgroundJob({ jobId: job.id, status: "failed", error: e?.message || String(e) });
    }
  });

  return { jobId: job.id };
}

const updateDecisionSchema = z.object({
  updateId: z.string().uuid(),
  decision: z.enum(["accept", "reject"]),
});

export async function decideOrgProfileUpdateAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = updateDecisionSchema.parse({
    updateId: String(formData.get("updateId")),
    decision: String(formData.get("decision")),
  });

  const admin = createSupabaseAdminClient();

  const { data: upd } = await admin
    .from("org_profile_updates")
    .select("id, proposed")
    .eq("org_id", orgId)
    .eq("id", parsed.updateId)
    .single();

  if (!upd) throw new Error("Update not found");

  if (parsed.decision === "accept") {
    // Apply proposed fields onto org_profiles
    const proposed = (upd.proposed || {}) as Record<string, any>;
    const allowed: Record<string, any> = {};
    for (const key of [
      "website_url",
      "mission",
      "programs",
      "impact",
      "leadership",
      "service_area",
      "beneficiaries",
      "key_metrics",
      "receipt_address",
      "receipt_ein",
      "receipt_signer_name",
      "receipt_signer_title",
      "logo_url",
      "logo_path",
    ]) {
      if (key in proposed) allowed[key] = proposed[key];
    }
    allowed.updated_at = new Date().toISOString();
    await admin.from("org_profiles").update(allowed).eq("org_id", orgId);
  }

  await admin
    .from("org_profile_updates")
    .update({ status: parsed.decision === "accept" ? "accepted" : "rejected", decided_at: new Date().toISOString(), decided_by: viewer.user.id })
    .eq("org_id", orgId)
    .eq("id", parsed.updateId);

  const supabase = createSupabaseServerClient();
  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: parsed.decision === "accept" ? "org_profile_update.accepted" : "org_profile_update.rejected",
    entityType: "org_profile_update",
    entityId: parsed.updateId,
  });

  revalidatePath("/app/org-profile");
}

function guessLogoExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpeg") || name.endsWith(".jpg")) return "jpg";
  return "png";
}
