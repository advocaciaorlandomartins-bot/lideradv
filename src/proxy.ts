import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE = "adv_session";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não definida.");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

// Antes só decodificava o payload e checava "exp", sem validar a
// assinatura HMAC — um cookie forjado (sem conhecer SESSION_SECRET), no
// formato "<payload base64url>.<qualquercoisa>" com um "exp" no futuro,
// passava por aqui. Na prática nenhuma página/dado vazava porque
// getSession() (src/lib/session.ts) faz a verificação real de assinatura
// antes de qualquer coisa ser renderizada, mas o proxy virava uma
// barreira só cosmética em vez de proteção de verdade. Agora usa o mesmo
// esquema de assinatura de session.ts (Node.js runtime já é o padrão do
// Proxy no Next.js 16, então crypto do Node funciona aqui sem problema).
function sessaoValida(token: string): boolean {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let sigBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "hex");
    expectedBuf = Buffer.from(sign(payload), "hex");
  } catch {
    return false;
  }
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      exp?: number;
    };
    return typeof data.exp === "number" && data.exp >= Date.now() / 1000;
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;

  if (!token || !sessaoValida(token)) {
    const resp = NextResponse.redirect(new URL("/login", req.url));
    if (token) resp.cookies.delete(COOKIE);
    return resp;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
