"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileByUserId } from "@/lib/db/profiles";

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) return { error: "Email and password are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Valid email is required." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const detail = [error.code, error.message].filter(Boolean).join(": ");
    const message =
      process.env.NODE_ENV === "production"
        ? "Invalid email or password."
        : `Sign-in failed (${detail || "unknown error"}).`;
    return { error: message };
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) return { error: "Unable to load session. Please try again." };

  const profile = await getProfileByUserId(supabase, auth.user.id);

  if (profile?.status === "pending") redirect("/auth/pending");
  redirect("/app/dashboard");
}
