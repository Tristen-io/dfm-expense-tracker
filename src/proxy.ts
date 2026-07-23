import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs on every request. Two jobs:
//   1. Keep the Supabase auth session cookie fresh (required by @supabase/ssr).
//   2. Enforce route access: signed-out users can only reach /login, /signup,
//      /forgot-password, and /reset-password; signed-in employees can't reach
//      /admin/*; signed-in users are redirected away from /login and /signup
//      to their home page.
//
// /reset-password is deliberately NOT in that last redirect-away group: the
// password-recovery link Supabase emails establishes the user's session via
// client-side JS reading the URL (a hash fragment or ?code=, depending on
// flow) *after* this proxy already ran, so a signed-in-looking request here
// doesn't necessarily mean the recovery flow finished yet. Bouncing a
// legitimately-signed-in admin away from it isn't harmful either — someone
// changing their own password while signed in is a normal thing to allow.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginOrSignup = path === "/login" || path === "/signup";
  const isPublicAuthPage =
    isLoginOrSignup || path === "/forgot-password" || path === "/reset-password";
  const isAdminPage = path.startsWith("/admin");

  if (!user && !isPublicAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginOrSignup) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && isAdminPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/submit";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
