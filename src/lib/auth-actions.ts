"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import sql from "./db";
import { createSession, destroySession, getSession } from "./session";
import { resolvePermissoes } from "./permissoes";
import { logAction } from "./audit";

export type LoginState = { error: string } | null;

function verifyPassword(input: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const [, salt, hash] = parts;
  const check = crypto
    .createHash("sha256")
    .update(input + salt)
    .digest("hex");
  return check === hash;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const login = ((formData.get("login") as string | null) ?? "")
    .trim()
    .toLowerCase();
  const senha = (formData.get("senha") as string | null) ?? "";

  if (!login || !senha) {
    return { error: "Preencha o login e a senha para continuar." };
  }

  const rows = await sql`
    SELECT id::text, login, categoria, senha_hash, ativo, validade, permissoes
    FROM usuarios
    WHERE login = ${login}
    LIMIT 1
  `;

  const user = rows[0];

  if (!user) return { error: "Login ou senha incorretos." };
  if (!user.ativo)
    return { error: "Usuário inativo. Contate o administrador." };

  if (user.validade) {
    const exp = new Date(String(user.validade));
    exp.setHours(23, 59, 59, 999);
    if (exp < new Date()) {
      return { error: "Acesso expirado. Contate o administrador." };
    }
  }

  if (!verifyPassword(senha, String(user.senha_hash))) {
    return { error: "Login ou senha incorretos." };
  }

  await sql`
    UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ${String(user.id)}::uuid
  `;

  const permissoes = resolvePermissoes(
    String(user.categoria),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (user.permissoes as any) ?? null
  );

  await createSession({
    id: String(user.id),
    login: String(user.login),
    categoria: String(user.categoria),
    permissoes,
  });

  await logAction({
    acao: "login",
    entidade: "usuario",
    descricao: `Login realizado — ${login}`,
    _login: login,
    _cat: String(user.categoria),
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await destroySession();
  await logAction({
    acao: "logout",
    entidade: "usuario",
    descricao: `Logout — ${session?.login ?? "usuário"}`,
    _login: session?.login ?? "sistema",
    _cat: session?.categoria,
  });
  redirect("/login");
}

export type RegisterState = { error: string } | { success: true } | null;

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const oabEstado = (formData.get("oab_estado") as string | null) ?? "";
  const oabNumero = (
    (formData.get("oab_numero") as string | null) ?? ""
  ).trim();
  const password = (formData.get("password") as string | null) ?? "";
  const confirmPassword =
    (formData.get("confirm_password") as string | null) ?? "";

  if (
    !name ||
    !email ||
    !oabEstado ||
    !oabNumero ||
    !password ||
    !confirmPassword
  ) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (name.trim().split(/\s+/).length < 2) {
    return { error: "Informe nome e sobrenome." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!/^\d{4,6}$/.test(oabNumero)) {
    return { error: "O número da OAB deve ter entre 4 e 6 dígitos." };
  }

  if (password.length < 8) {
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." };
  }

  redirect("/dashboard");
}
