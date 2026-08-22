"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { getSenhaHash } from "./usuarios-db";
import { MODULOS, ACOES, type Permissoes } from "./permissoes";
import { logAction } from "./audit";

export type UsuarioFormState = { error?: string; success?: boolean } | null;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
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
  const session = await getSession();
  if (!session || !hasPermission(session, "usuarios", "criar"))
    return { error: "Sem permissão para criar usuários." };

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
  if (senha.length < 8)
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  if (senha !== senhaConf) return { error: "As senhas não coincidem." };
  if (!categoria) return { error: "Selecione uma categoria." };
  // Só um Administrador(a) pode criar outro Administrador(a) — sem isso,
  // qualquer pessoa com a permissão "usuarios:criar" (ex: RH, recepção)
  // conseguia criar uma segunda conta própria já com categoria máxima.
  if (
    categoria === "Administrador(a)" &&
    session.categoria !== "Administrador(a)"
  ) {
    return { error: "Apenas administradores podem criar outro administrador." };
  }

  try {
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

  await logAction({
    acao: "criar",
    entidade: "usuario",
    descricao: `Criou usuário: ${login} (${categoria})`,
  });
  revalidatePath("/dashboard/usuarios");
  return { success: true };
}

export async function updateUsuarioAction(
  _prev: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "usuarios", "editar"))
    return { error: "Sem permissão para editar usuários." };

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

  const UUID_RE_USR =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !UUID_RE_USR.test(id)) return { error: "ID inválido." };
  if (!login) return { error: "O login é obrigatório." };
  if (!nome) return { error: "O nome é obrigatório." };
  if (senha && senha.length < 6)
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  if (senha && senha !== senhaConf)
    return { error: "As senhas não coincidem." };
  if (!categoria) return { error: "Selecione uma categoria." };
  // Só um Administrador(a) pode conceder a categoria Administrador(a) a
  // alguém — sem isso, qualquer um com "usuarios:editar" (ex: RH) podia
  // promover qualquer conta, inclusive a própria, a admin.
  if (
    categoria === "Administrador(a)" &&
    session.categoria !== "Administrador(a)"
  ) {
    return { error: "Apenas administradores podem conceder essa categoria." };
  }
  // Ninguém pode alterar a própria categoria/permissões — fecha o caminho de
  // "editar meu próprio usuário pra virar admin" mesmo sem a checagem acima
  // (ex: um admin normal tentando se conceder um módulo que não tinha).
  // Nome, senha, validade e status continuam editáveis normalmente.
  const editandoProprioUsuario = id === session.id;
  let categoriaFinal = categoria;

  try {
    let senhaHash: string;
    if (senha) {
      senhaHash = hashPassword(senha);
    } else {
      senhaHash = (await getSenhaHash(id)) ?? "";
    }

    let permissoes = parsePermissoes(formData);
    if (editandoProprioUsuario) {
      const [current] = await sql`
        SELECT categoria, permissoes FROM usuarios WHERE id = ${id}::uuid
      `;
      if (current) {
        categoriaFinal = String(current.categoria);
        permissoes = (current.permissoes as Permissoes) ?? {};
      }
    }

    if (colaboradorId) {
      await sql`
        UPDATE usuarios SET
          login          = ${login},
          nome           = ${nome},
          senha_hash     = ${senhaHash},
          categoria      = ${categoriaFinal},
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
          categoria      = ${categoriaFinal},
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

  await logAction({
    acao: "editar",
    entidade: "usuario",
    entidadeId: id,
    descricao: `Editou usuário: ${login} (${categoriaFinal})`,
    detalhes: { ativo },
  });
  revalidatePath("/dashboard/usuarios");
  return { success: true };
}

export async function deleteUsuarioAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "usuarios", "excluir"))
    return { error: "Sem permissão." };

  if (id === session.id)
    return { error: "Você não pode excluir sua própria conta." };

  const [alvo] =
    await sql`SELECT categoria FROM usuarios WHERE id = ${id}::uuid`;
  if (alvo?.categoria === "Administrador(a)") {
    const [{ total }] = await sql`
      SELECT COUNT(*)::int AS total FROM usuarios
      WHERE categoria = 'Administrador(a)' AND ativo = true
    `;
    if (Number(total) <= 1) {
      return {
        error: "Não é possível excluir o único administrador do sistema.",
      };
    }
  }

  try {
    await sql`DELETE FROM usuarios WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteUsuarioAction DB error:", err);
    return { error: "Erro ao excluir usuário. Tente novamente." };
  }

  await logAction({
    acao: "excluir",
    entidade: "usuario",
    entidadeId: id,
    descricao: "Excluiu usuário",
  });
  revalidatePath("/dashboard/usuarios");
  return {};
}
