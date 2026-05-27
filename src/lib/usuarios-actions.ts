"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { countAtivos, getSenhaHash, MAX_USUARIOS } from "./usuarios-db";
import { MODULOS, ACOES, type Permissoes } from "./permissoes";

export type UsuarioFormState = { error?: string; success?: boolean } | null;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");
  return `sha256:${salt}:${hash}`;
}

function parsePermissoes(formData: FormData): Permissoes {
  const perm: Permissoes = {};
  for (const { key: mod } of MODULOS) {
    perm[mod] = [];
    for (const { key: acao } of ACOES) {
      if (formData.get(`perm_${mod}_${acao}`) === "on") {
        perm[mod].push(acao);
      }
    }
  }
  return perm;
}

export async function createUsuarioAction(
  _prev: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const login = ((formData.get("login") as string) ?? "").trim().toLowerCase();
  const nome = ((formData.get("nome") as string) ?? "").trim();
  const senha = (formData.get("senha") as string) ?? "";
  const senhaConf = (formData.get("senha_confirmacao") as string) ?? "";
  const categoria = ((formData.get("categoria") as string) ?? "").trim();
  const validade = ((formData.get("validade") as string) ?? "").trim() || null;
  const colaboradorId =
    ((formData.get("colaborador_id") as string) ?? "").trim() || null;

  if (!login) return { error: "O login é obrigatório." };
  if (!nome) return { error: "O nome é obrigatório." };
  if (!senha) return { error: "A senha é obrigatória." };
  if (senha.length < 6)
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  if (senha !== senhaConf) return { error: "As senhas não coincidem." };
  if (!categoria) return { error: "Selecione uma categoria." };

  try {
    const ativos = await countAtivos();
    if (ativos >= MAX_USUARIOS) {
      return { error: `Limite de ${MAX_USUARIOS} usuários atingido.` };
    }

    const senhaHash = hashPassword(senha);
    const permissoes = parsePermissoes(formData);

    if (colaboradorId) {
      await sql`
        INSERT INTO usuarios (login, nome, senha_hash, categoria, validade, colaborador_id, permissoes)
        VALUES (${login}, ${nome}, ${senhaHash}, ${categoria}, ${validade},
                ${colaboradorId}::uuid, ${JSON.stringify(permissoes)}::jsonb)
      `;
    } else {
      await sql`
        INSERT INTO usuarios (login, nome, senha_hash, categoria, validade, permissoes)
        VALUES (${login}, ${nome}, ${senhaHash}, ${categoria}, ${validade},
                ${JSON.stringify(permissoes)}::jsonb)
      `;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: `O login "${login}" já está em uso.` };
    }
    console.error("createUsuarioAction:", err);
    return { error: "Erro ao criar usuário." };
  }

  revalidatePath("/dashboard/usuarios");
  return { success: true };
}

export async function updateUsuarioAction(
  _prev: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const id = (formData.get("id") as string) ?? "";
  const login = ((formData.get("login") as string) ?? "").trim().toLowerCase();
  const nome = ((formData.get("nome") as string) ?? "").trim();
  const senha = (formData.get("senha") as string) ?? "";
  const senhaConf = (formData.get("senha_confirmacao") as string) ?? "";
  const categoria = ((formData.get("categoria") as string) ?? "").trim();
  const validade = ((formData.get("validade") as string) ?? "").trim() || null;
  const ativo = formData.get("ativo") === "true";
  const colaboradorId =
    ((formData.get("colaborador_id") as string) ?? "").trim() || null;

  if (!id) return { error: "ID inválido." };
  if (!login) return { error: "O login é obrigatório." };
  if (!nome) return { error: "O nome é obrigatório." };
  if (senha && senha.length < 6)
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  if (senha && senha !== senhaConf)
    return { error: "As senhas não coincidem." };
  if (!categoria) return { error: "Selecione uma categoria." };

  try {
    let senhaHash: string;
    if (senha) {
      senhaHash = hashPassword(senha);
    } else {
      senhaHash = (await getSenhaHash(id)) ?? "";
    }

    const permissoes = parsePermissoes(formData);

    if (colaboradorId) {
      await sql`
        UPDATE usuarios SET
          login          = ${login},
          nome           = ${nome},
          senha_hash     = ${senhaHash},
          categoria      = ${categoria},
          validade       = ${validade},
          ativo          = ${ativo},
          colaborador_id = ${colaboradorId}::uuid,
          permissoes     = ${JSON.stringify(permissoes)}::jsonb,
          updated_at     = NOW()
        WHERE id = ${id}::uuid
      `;
    } else {
      await sql`
        UPDATE usuarios SET
          login          = ${login},
          nome           = ${nome},
          senha_hash     = ${senhaHash},
          categoria      = ${categoria},
          validade       = ${validade},
          ativo          = ${ativo},
          colaborador_id = NULL,
          permissoes     = ${JSON.stringify(permissoes)}::jsonb,
          updated_at     = NOW()
        WHERE id = ${id}::uuid
      `;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: `O login "${login}" já está em uso por outro usuário.` };
    }
    console.error("updateUsuarioAction:", err);
    return { error: "Erro ao atualizar usuário." };
  }

  revalidatePath("/dashboard/usuarios");
  return { success: true };
}

export async function deleteUsuarioAction(id: string): Promise<void> {
  await sql`DELETE FROM usuarios WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/usuarios");
}
