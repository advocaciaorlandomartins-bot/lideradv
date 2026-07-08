import crypto from "crypto";
import { NextRequest } from "next/server";

export interface IntegracoesTokenPayload {
  sub: string; // colaborador_id
  nome: string;
  iss: string;
  iat: number;
  exp: number;
}

function jwtSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não definida.");
  // Derived key so este token não pode ser usado como session cookie
  return crypto
    .createHmac("sha256", s)
    .update("integracoes:prevbot")
    .digest("hex");
}

export function jwtSign(payload: IntegracoesTokenPayload): string {
  const secret = jwtSecret();
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function jwtVerify(token: string): IntegracoesTokenPayload | null {
  try {
    const secret = jwtSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url");
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString()
    ) as IntegracoesTokenPayload;
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000)
      return null;
    return data;
  } catch {
    return null;
  }
}

// Extrai e valida o Bearer token do header Authorization
export function getIntegracoesAuth(
  req: NextRequest
): IntegracoesTokenPayload | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return jwtVerify(auth.slice(7));
}
