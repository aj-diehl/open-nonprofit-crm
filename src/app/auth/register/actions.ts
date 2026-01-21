"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateInviteCode, slugify } from "@/lib/shared/strings";

export type RegisterState = { error?: string };

export async function registerAction(_prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const orgName = String(formData.get("orgName") || "").trim();
  const inviteCodeRaw = String(formData.get("inviteCode") || "").trim();
  const emailRaw = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim();
  const email = emailRaw.trim().toLowerCase();

  if (!email) return { error: "Email is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Valid email is required." };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!displayName) return { error: "Your name is required." };
  const username = email;

  // If joining an existing org, orgName is optional (we'll ignore it).
  // If creating a new org, orgName is required.
  const isJoining = Boolean(inviteCodeRaw);
  if (!isJoining && !orgName) return { error: "Organization name is required." };

  const admin = createSupabaseAdminClient();

  // 1) Resolve or create org
  let orgId: string | null = null;

  if (isJoining) {
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .select("id")
      .eq("invite_code", inviteCodeRaw)
      .single();

    if (orgErr || !org?.id) return { error: "Invalid invite code." };
    orgId = org.id;
  } else {
    const slug = slugify(orgName);
    const inviteCode = generateInviteCode();

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name: orgName,
        slug,
        invite_code: inviteCode,
      })
      .select("id")
      .single();

    if (orgErr || !org?.id) {
      return { error: "Unable to create organization. Please try a different name." };
    }
    orgId = org.id;

    // Create base org profile
    await admin.from("org_profiles").insert({ org_id: orgId });
  }

  if (!orgId) return { error: "Unable to create or locate organization." };

  // 2) Create auth user
  const { data: createdUser, error: createUserErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName,
      contact_email: email,
    },
  });

  if (createUserErr || !createdUser?.user?.id) {
    // Most common: email already exists
    return { error: "Email is already in use. Please sign in instead." };
  }

  const userId = createdUser.user.id;

  // 3) Create profile row
  const role = isJoining ? "member" : "executive";
  const status = isJoining ? "pending" : "active";

  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    org_id: orgId,
    username,
    display_name: displayName,
    contact_email: email,
    role,
    status,
  });

  if (profileErr) {
    // Cleanup auth user if profile insert failed.
    await admin.auth.admin.deleteUser(userId);
    return { error: "Unable to create user profile. Please try again." };
  }

  // 4) Sign in to create browser session cookies
  const supabase = createSupabaseServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) return { error: "Account created, but sign-in failed. Please sign in again." };

  if (status === "pending") redirect("/auth/pending");
  redirect("/app/dashboard");
}
