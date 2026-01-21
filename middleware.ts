import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: { headers: req.headers } });
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  if (!user) {
    if (pathname.startsWith("/app")) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    return res;
  }

  // If the user is signed in but pending, keep them out of /app.
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).single();
  if (profile?.status === "pending" && pathname.startsWith("/app")) {
    return NextResponse.redirect(new URL("/auth/pending", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/app/:path*"],
};
