"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { parseSpreadsheet } from "@/lib/import/parseSpreadsheet";
import { getKnownMapping } from "@/lib/import/knownMappings";
import { runSpreadsheetMappingAgent } from "@/lib/ai/workflows/spreadsheetMapping";
import { runSpreadsheetCleanlinessAgent, type CleanlinessReport } from "@/lib/ai/workflows/spreadsheetCleanliness";
import { applyDonationMapping, applyDonorMapping } from "@/lib/import/applyMapping";
import { audit } from "@/lib/audit/audit";
import { completeBackgroundJob, createBackgroundJob, runInBackground } from "@/lib/jobs/background";

const schema = z.object({
  importType: z.enum(["donations", "donors"]),
});

export type ImportState = { error?: string; jobId?: string; message?: string };

export async function importSpreadsheetAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const userId = viewer?.user?.id;
  if (!orgId || !userId) return { error: "Not authenticated." };

  const parsed = schema.safeParse({
    importType: String(formData.get("importType") || "donations"),
  });
  if (!parsed.success) return { error: "Invalid import type." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Please choose a file." };

  const maxMb = Number(process.env.MAX_UPLOAD_MB || 15);
  if (file.size > maxMb * 1024 * 1024) return { error: `File is too large (max ${maxMb} MB).` };

  const admin = createSupabaseAdminClient();

  // Create ingestion job row (admin to avoid RLS edge cases)
  const { data: job, error: jobErr } = await admin
    .from("ingestion_jobs")
    .insert({
      org_id: orgId,
      type: parsed.data.importType,
      status: "running",
      created_by: userId,
      file_name: file.name,
      file_size: file.size,
    })
    .select("id")
    .single();

  if (jobErr || !job?.id) return { error: "Unable to start import job." };

  const backgroundJob = await createBackgroundJob({
    orgId,
    userId,
    type: "crm_import",
    title: `CRM import (${parsed.data.importType})`,
    returnPath: "/app/crm/import",
    entityType: "ingestion_job",
    entityId: job.id,
    metadata: { importType: parsed.data.importType, fileName: file.name },
  });

  runInBackground(async () => {
    const adminClient = createSupabaseAdminClient();
    try {
      // 1) Parse spreadsheet into rows
      const table = await parseSpreadsheet(file);
      if (table.rows.length === 0) throw new Error("No rows found in file.");

      // 2) Assess sheet cleanliness for review flagging
      const sample = table.rows.slice(0, Math.min(25, table.rows.length));
      let cleanliness: CleanlinessReport | null = null;
      try {
        cleanliness = await runSpreadsheetCleanlinessAgent({
          orgId,
          userId,
          jobId: job.id,
          importType: parsed.data.importType,
          headers: table.headers,
          sampleRows: sample,
        });
      } catch (e: any) {
        cleanliness = {
          consistent: false,
          confidence: 0,
          notes: "cleanliness_check_failed",
          warnings: [e?.message || String(e)],
        };
      }

      // 3) Ask the agent for a mapping (based on headers + sample)
      const knownMapping = getKnownMapping(parsed.data.importType, table.headers);
      const mapping =
        knownMapping ??
        (await runSpreadsheetMappingAgent({
          orgId,
          userId,
          jobId: job.id,
          importType: parsed.data.importType,
          headers: table.headers,
          sampleRows: sample,
        }));

      // 4) Apply mapping + upsert into CRM tables
      let result;
      if (parsed.data.importType === "donations") {
        if (mapping.kind !== "donations") {
          throw new Error("Import mapping mismatch");
        }
        result = await applyDonationMapping({
          supabase: adminClient,
          orgId,
          userId,
          table,
          mapping,
          jobId: job.id,
        });
      } else {
        if (mapping.kind !== "donors") {
          throw new Error("Import mapping mismatch");
        }
        result = await applyDonorMapping({
          supabase: adminClient,
          orgId,
          userId,
          table,
          mapping,
          jobId: job.id,
        });
      }

      const reviewReasons: string[] = [];
      if (cleanliness && !cleanliness.consistent) reviewReasons.push("inconsistent_sheet");
      if (result.errorCount) reviewReasons.push("row_errors");
      if ("missingRequired" in result && result.missingRequired) reviewReasons.push("missing_required_fields");
      if ("externalIdBlocked" in result && result.externalIdBlocked) reviewReasons.push("external_id_row_number");
      if ("externalIdMapped" in result && result.externalIdMapped === false) reviewReasons.push("external_id_fallback");

      const reviewRequired = reviewReasons.length > 0;
      const stats = { ...result, cleanliness, reviewRequired, reviewReasons };

      await adminClient
        .from("ingestion_jobs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          stats,
        })
        .eq("id", job.id);

      await audit(adminClient, {
        orgId,
        actorId: userId,
        action: "crm.import.succeeded",
        entityType: "ingestion_job",
        entityId: job.id,
        metadata: { importType: parsed.data.importType, ...stats },
      });

      revalidatePath("/app/crm/donors");
      revalidatePath("/app/crm/donations");
      revalidatePath("/app/crm/import");

      await completeBackgroundJob({ jobId: backgroundJob.id, status: "succeeded" });
    } catch (e: any) {
      await adminClient
        .from("ingestion_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error: e?.message || String(e),
        })
        .eq("id", job.id);

      await audit(adminClient, {
        orgId,
        actorId: userId,
        action: "crm.import.failed",
        entityType: "ingestion_job",
        entityId: job.id,
        metadata: { importType: parsed.data.importType, error: e?.message || String(e) },
      });

      await completeBackgroundJob({
        jobId: backgroundJob.id,
        status: "failed",
        error: e?.message || String(e),
      });
    }
  });

  return { jobId: job.id, message: "Import started. We will notify you when it finishes." };
}
