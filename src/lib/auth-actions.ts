"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import sql from "./db";
import { createSession, destroySession, getSession } from "./session";
import { resolvePermissoes } from "./permissoes";
import { logAction } from "./audit";
import { enviarEmailResetSenha } from "./email";

export type LoginState = { error: string } | null;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(input: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts[0] === "scrypt" && parts.length === 3) {
    const [, salt, hash] = parts;
    try {
      const check = crypto.scryptSync(input, salt, 64).toString("hex");
      return crypto.timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(check, "hex")
      );
    } catch {
      return false;
    }
  }
  // Legacy sha256 — aceito mas migrado automaticamente no login
  if (parts[0] === "sha256" && parts.length === 3) {
    const [, salt, hash] = parts;
    const check = crypto
      .createHash("sha256")
      .update(input + salt)
      .digest("hex");
    return check === hash;
  }
  return false;
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
    SELECT id::text, login, nome, categoria, senha_hash, ativo, validade, permissoes
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

  // Migração transparente sha256 → scrypt no próximo login
  const updates: Promise<unknown>[] = [
    sql`UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ${String(user.id)}::uuid`,
  ];
  if (String(user.senha_hash).startsWith("sha256:")) {
    updates.push(
      sql`UPDATE usuarios SET senha_hash = ${hashPassword(senha)} WHERE id = ${String(user.id)}::uuid`
    );
  }
  await Promise.all(updates);

  const permissoes = resolvePermissoes(
    String(user.categoria),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (user.permissoes as any) ?? null
  );

  await createSession({
    id: String(user.id),
    login: String(user.login),
    nome: String(user.nome ?? user.login),
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

  const login = email.toLowerCase();
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");
  const senhaHash = `sha256:${salt}:${hash}`;

  try {
    const rows = await sql`
      INSERT INTO usuarios (login, nome, senha_hash, categoria)
      VALUES (${login}, ${name}, ${senhaHash}, 'advogado')
      RETURNING id::text, login, categoria
    `;
    const user = rows[0];
    const permissoes = resolvePermissoes("advogado", null);
    await createSession({
      id: String(user.id),
      login: String(user.login),
      nome: name,
      categoria: String(user.categoria),
      permissoes,
    });
    await logAction({
      acao: "criar",
      entidade: "usuario",
      descricao: `Registro de nova conta — ${login}`,
      _login: login,
      _cat: "advogado",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Este e-mail já está cadastrado." };
    }
    console.error("registerAction:", err);
    return { error: "Erro ao criar conta. Tente novamente." };
  }

  redirect("/dashboard");
}

export type ResetRequestState = { error: string } | { success: true } | null;

export async function requestPasswordResetAction(
  _prevState: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = ((formData.get("email") as string | null) ?? "")
    .trim()
    .toLowerCase();

  if (!email) return { error: "Informe o e-mail cadastrado." };

  const rows = await sql`
    SELECT id::text, login, ativo FROM usuarios WHERE login = ${email} LIMIT 1
  `;

  // Não revela se o e-mail existe (segurança)
  if (!rows[0] || !rows[0].ativo) return { success: true };

  const userId = String(rows[0].id);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await sql`DELETE FROM password_reset_tokens WHERE usuario_id = ${userId}::uuid`;
  await sql`
    INSERT INTO password_reset_tokens (token, usuario_id, expires_at)
    VALUES (${token}, ${userId}::uuid, ${expiresAt.toISOString()})
  `;

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://lideradv.vercel.app";
  const resetUrl = `${baseUrl}/reset-senha?token=${token}`;

  await enviarEmailResetSenha({ para: email, resetUrl });

  return { success: true };
}

export type ResetPasswordState = { error: string } | { success: true } | null;

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = ((formData.get("token") as string | null) ?? "").trim();
  const senha = (formData.get("senha") as string | null) ?? "";
  const confirmar = (formData.get("confirmar") as string | null) ?? "";

  if (!token) return { error: "Token inválido." };
  if (senha.length < 8)
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  if (senha !== confirmar) return { error: "As senhas não coincidem." };

  const rows = await sql`
    SELECT t.usuario_id::text, t.expires_at, t.used
    FROM password_reset_tokens t
    WHERE t.token = ${token}
    LIMIT 1
  `;

  const tokenRow = rows[0];
  if (!tokenRow) return { error: "Link inválido ou já utilizado." };
  if (tokenRow.used)
    return { error: "Este link já foi utilizado. Solicite um novo." };
  if (new Date(String(tokenRow.expires_at)) < new Date())
    return { error: "Link expirado. Solicite um novo." };

  const userId = String(tokenRow.usuario_id);
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(senha + salt)
    .digest("hex");
  const senhaHash = `sha256:${salt}:${hash}`;

  await sql`UPDATE usuarios SET senha_hash = ${senhaHash} WHERE id = ${userId}::uuid`;
  await sql`UPDATE password_reset_tokens SET used = TRUE WHERE token = ${token}`;

  await logAction({
    acao: "editar",
    entidade: "usuario",
    descricao: `Senha redefinida via link de recuperação`,
    _login: userId,
    _cat: "sistema",
  });

  redirect("/login?redefinido=1");
}
