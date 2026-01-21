"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";

const schema = z.object({
  donorType: z.enum(["individual", "organization"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  organizationName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export type NewDonorState = { error?: string };

export async function createDonorAction(_prev: NewDonorState, formData: FormData): Promise<NewDonorState> {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) return { error: "Not authenticated." };

  const donorType = String(formData.get("donorType") || "individual") as "individual" | "organization";

  const parsed = schema.safeParse({
    donorType,
    firstName: String(formData.get("firstName") || "").trim() || undefined,
    lastName: String(formData.get("lastName") || "").trim() || undefined,
    organizationName: String(formData.get("organizationName") || "").trim() || undefined,
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim() || undefined,
    notes: String(formData.get("notes") || "").trim() || undefined,
  });

  if (!parsed.success) return { error: "Please check the form fields." };

  const supabase = createSupabaseServerClient();
  const { data: donor, error } = await supabase
    .from("donors")
    .insert({
      org_id: orgId,
      donor_type: parsed.data.donorType,
      first_name: parsed.data.firstName || null,
      last_name: parsed.data.lastName || null,
      organization_name: parsed.data.organizationName || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error || !donor?.id) return { error: "Unable to create donor." };

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "donor.create",
    entityType: "donor",
    entityId: donor.id,
    metadata: { donorType: parsed.data.donorType },
  });

  redirect(`/app/crm/donors/${donor.id}`);
}
