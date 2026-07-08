import crypto from "crypto";
import { cookies } from "next/headers";
import type { Permissoes } from "./permissoes";

const COOKIE = "adv_session";
const MAX_AGE = 60 * 60 * 8; // 8 h

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não definida.");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export interface SessionUser {
  id: string;
  login: string;
  nome: string;
  categoria: string;
  permissoes: Permissoes;
}

export async function createSession(user: SessionUser): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ ...user, exp })).toString(
    "base64url"
  );
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  if (sign(payload) !== sig) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000)
      return null;
    return {
      id: data.id,
      login: data.login,
      nome: data.nome ?? data.login,
      categoria: data.categoria,
      permissoes: data.permissoes ?? {},
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
