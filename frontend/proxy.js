import { NextResponse } from "next/server";

const SESSION_COOKIE = "wk_session";
// Public pages a signed-in user skips: the landing page and the login page.
const PUBLIC_PAGES = ["/", "/login"];

export function proxy(request) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (PUBLIC_PAGES.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};
