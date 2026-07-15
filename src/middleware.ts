import { NextRequest, NextResponse } from "next/server";

const COOKIE = "adv_session";

export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    // Cookie format: <base64url-payload>.<hmac-sig>
    // Full HMAC verification happens in getSession() in each route handler.
    // Here we only do a lightweight sanity + expiry check at the Edge.
    const dot = token.lastIndexOf(".");
    if (dot === -1) throw new Error("malformed");
    const payload = token.slice(0, dot);

    // base64url → standard base64 (add padding so atob works)
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const rem = b64.length % 4;
    const padded = rem ? b64 + "=".repeat(4 - rem) : b64;
    const json = atob(padded);

    const data = JSON.parse(json) as { exp?: number };
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("expired");
    }
  } catch {
    const resp = NextResponse.redirect(new URL("/login", req.url));
    resp.cookies.delete(COOKIE);
    return resp;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
