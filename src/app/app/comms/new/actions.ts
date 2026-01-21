"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";

const schema = z.object({
  type: z.enum(["email", "newsletter", "article"]),
  title: z.string().min(3),
  audience: z.string().optional(),
  goal: z.string().min(3),
  tone: z.string().optional(),
  length: z.string().optional(),
  callToAction: z.string().optional(),
});

export type NewDraftState = { error?: string };

export async function createDraftAction(_prev: NewDraftState, formData: FormData): Promise<NewDraftState> {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) return { error: "Not authenticated." };

  const parsed = schema.safeParse({
    type: String(formData.get("type") || "email"),
    title: String(formData.get("title") || "").trim(),
    audience: String(formData.get("audience") || "").trim() || undefined,
    goal: String(formData.get("goal") || "").trim(),
    tone: String(formData.get("tone") || "").trim() || undefined,
    length: String(formData.get("length") || "").trim() || undefined,
    callToAction: String(formData.get("callToAction") || "").trim() || undefined,
  });

  if (!parsed.success) return { error: "Please check the form fields." };

  const supabase = createSupabaseServerClient();

  const admin = createSupabaseAdminClient();
  const { data: draft, error } = await admin
    .from("comms_drafts")
    .insert({
      org_id: orgId,
      type: parsed.data.type,
      title: parsed.data.title,
      audience: parsed.data.audience || null,
      goal: parsed.data.goal,
      tone: parsed.data.tone || null,
      length: parsed.data.length || null,
      call_to_action: parsed.data.callToAction || null,
      created_by: viewer.user.id,
    })
    .select("id")
    .single();

  if (error || !draft?.id) return { error: "Unable to create draft." };

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "comms.draft.created",
    entityType: "comms_draft",
    entityId: draft.id,
    metadata: { type: parsed.data.type },
  });

  redirect(`/app/comms/${draft.id}?generate=1`);
}
