"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileByUserId } from "@/lib/db/profiles";
import { audit } from "@/lib/audit/audit";

export type ResetPasswordState = { error?: string };

export async function updatePasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) {
    return { error: "Reset link expired or invalid. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    const detail = [error.code, error.message].filter(Boolean).join(": ");
    const message =
      process.env.NODE_ENV === "production"
        ? "Unable to update password. Please try again."
        : `Password update failed (${detail || "unknown error"}).`;
    return { error: message };
  }

  const profile = await getProfileByUserId(supabase, userId);
  if (profile?.org_id) {
    await audit(supabase, {
      orgId: profile.org_id,
      actorId: userId,
      action: "auth.password.reset",
      entityType: "profile",
      entityId: userId,
      metadata: { method: "recovery" },
    });
  }

  await supabase.auth.signOut();
  redirect("/auth/login?reset=1");
}
