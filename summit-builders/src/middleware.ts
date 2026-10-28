import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("summit_session")?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/crm") && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && token) {
    const url = request.nextUrl.clone();
    url.pathname = "/crm/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*", "/login"],
};
