"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";

const schema = z.object({
  profileId: z.string().uuid(),
  decision: z.enum(["approve", "disable"]),
});

export async function decideUserAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");
  if (viewer.profile?.role !== "executive") throw new Error("Not authorized");

  const parsed = schema.parse({
    profileId: String(formData.get("profileId")),
    decision: String(formData.get("decision")),
  });

  const admin = createSupabaseAdminClient();

  const nextStatus = parsed.decision === "approve" ? "active" : "disabled";

  const { error } = await admin
    .from("profiles")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", parsed.profileId);

  if (error) throw new Error("Unable to update user");

  const supabase = createSupabaseServerClient();
  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: parsed.decision === "approve" ? "user.approved" : "user.disabled",
    entityType: "profile",
    entityId: parsed.profileId,
  });

  revalidatePath("/app/admin/users");
}
