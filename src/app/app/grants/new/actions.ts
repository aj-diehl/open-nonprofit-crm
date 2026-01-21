"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";

const schema = z.object({
  title: z.string().min(1),
  funder: z.string().optional(),
  status: z.enum(["prospecting", "writing", "submitted", "awarded", "declined", "reporting", "closed"]).default("writing"),
  dueDate: z.string().optional(),
  requestedAmount: z.coerce.number().optional(),
});

export type NewGrantState = { error?: string };

export async function createGrantAction(_prev: NewGrantState, formData: FormData): Promise<NewGrantState> {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) return { error: "Not authenticated." };

  const parsed = schema.safeParse({
    title: String(formData.get("title") || "").trim(),
    funder: String(formData.get("funder") || "").trim() || undefined,
    status: String(formData.get("status") || "writing"),
    dueDate: String(formData.get("dueDate") || "").trim() || undefined,
    requestedAmount: formData.get("requestedAmount") ? formData.get("requestedAmount") : undefined,
  });

  if (!parsed.success) return { error: "Please check the form fields." };

  const supabase = createSupabaseServerClient();
  const { data: grant, error } = await supabase
    .from("grants")
    .insert({
      org_id: orgId,
      title: parsed.data.title,
      funder: parsed.data.funder || null,
      status: parsed.data.status,
      due_date: parsed.data.dueDate ? new Date(parsed.data.dueDate).toISOString() : null,
      requested_amount: parsed.data.requestedAmount ?? null,
      currency: "USD",
      created_by: viewer.user.id,
    })
    .select("id")
    .single();

  if (error || !grant?.id) return { error: "Unable to create grant." };

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "grant.create",
    entityType: "grant",
    entityId: grant.id,
    metadata: { status: parsed.data.status },
  });

  redirect(`/app/grants/${grant.id}`);
}
