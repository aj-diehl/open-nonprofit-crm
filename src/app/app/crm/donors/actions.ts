"use server";

import { revalidatePath } from "next/cache";
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

export async function createDonorAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = schema.parse({
    donorType: String(formData.get("donorType") || "individual"),
    firstName: String(formData.get("firstName") || "").trim() || undefined,
    lastName: String(formData.get("lastName") || "").trim() || undefined,
    organizationName: String(formData.get("organizationName") || "").trim() || undefined,
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim() || undefined,
    notes: String(formData.get("notes") || "").trim() || undefined,
  });

  const supabase = createSupabaseServerClient();
  const payload: any = {
    org_id: orgId,
    donor_type: parsed.donorType,
    first_name: parsed.firstName || null,
    last_name: parsed.lastName || null,
    organization_name: parsed.organizationName || null,
    email: parsed.email ? parsed.email.toLowerCase() : null,
    phone: parsed.phone || null,
    notes: parsed.notes || null,
    currency: "USD",
  };

  const { data, error } = await supabase.from("donors").insert(payload).select("id").single();
  if (error || !data?.id) throw new Error("Unable to create donor");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "donor.created",
    entityType: "donor",
    entityId: data.id,
  });

  revalidatePath("/app/crm/donors");
}
