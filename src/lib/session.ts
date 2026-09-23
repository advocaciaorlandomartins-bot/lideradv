import crypto from "crypto";
import { cookies } from "next/headers";
import sql from "./db";
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

  const expected = sign(payload);
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  let data: { id?: string; login?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (typeof data.exp !== "number" || data.exp < Date.now() / 1000 || !data.id)
    return null;

  // O cookie assinado só prova QUEM é o usuário (autenticação) — categoria
  // e permissões sempre vêm frescas do banco a cada chamada, nunca do que
  // foi gravado no cookie no momento do login. Sem isso, um admin
  // revogava/reduzia a permissão de alguém na tela de Usuários e isso só
  // valia depois da sessão atual daquela pessoa expirar sozinha (até 8h) —
  // achado de verdade: financeiro desmarcado pra uma colaboradora que
  // continuava vendo a aba Financeiro do cliente, porque o cookie dela já
  // tinha sido emitido antes da permissão ser corrigida. De quebra, também
  // derruba na hora quem for desativado (usuarios.ativo = false).
  const rows = await sql`
    SELECT nome, categoria, permissoes, ativo FROM usuarios WHERE id = ${data.id}::uuid
  `.catch(() => []);
  const row = rows[0] as
    | {
        nome: string;
        categoria: string;
        permissoes: Permissoes;
        ativo: boolean;
      }
    | undefined;
  if (!row || row.ativo === false) return null;

  return {
    id: data.id,
    login: data.login ?? "",
    nome: row.nome ?? data.login ?? "",
    categoria: row.categoria,
    permissoes: row.permissoes ?? {},
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
