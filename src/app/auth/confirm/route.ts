import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function resolveNextParam(searchParams: URLSearchParams) {
  const next = searchParams.get("next") || "/auth/reset";
  return next.startsWith("/") ? next : "/auth/reset";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = resolveNextParam(searchParams);

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_code", origin));
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/login?error=reset", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
