import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refresh session cookie agar RLS tahu siapa user di setiap request.
// Tanpa ini, Server Component menganggap user logout walau baru login.
export async function middleware(request) {
  // Env belum diisi -> jangan crash, biarkan halaman tampil
  // (dashboard akan menunjukkan panduan setup).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
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

  // Belum login -> lempar ke /login (kecuali memang ke /login)
  if (!user && path !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Sudah login tapi buka /login -> ke dashboard
  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
