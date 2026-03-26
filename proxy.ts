import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_ACCESS_COOKIE, getAdminAccessToken } from "@/lib/admin-access";

export function proxy(request: NextRequest) {
  const expectedToken = getAdminAccessToken();

  if (!expectedToken) {
    return NextResponse.next();
  }

  const currentToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;

  if (currentToken === expectedToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin-access", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
