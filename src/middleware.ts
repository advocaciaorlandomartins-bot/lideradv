import { NextRequest, NextResponse } from "next/server";

const COOKIE = "adv_session";

export function middleware(req: NextRequest) {
  const session = req.cookies.get(COOKIE)?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
