"use server";

import sql from "./db";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";

// ── Publicações ───────────────────────────────────────────────────────────────

export async function marcarComoTratadaAction(id: number) {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "editar")) return;

  await sql`UPDATE publicacoes SET status = 'tratada', updated_at = now() WHERE id = ${id}`;
  revalidatePath("/dashboard/publicacoes");
}

export async function marcarComoNaoLidaAction(id: number) {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "editar")) return;

  await sql`UPDATE publicacoes SET status = 'nao_lida', updated_at = now() WHERE id = ${id}`;
  revalidatePath("/dashboard/publicacoes");
}

export async function marcarTodasComoTratadasAction() {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "editar")) return;

  await sql`UPDATE publicacoes SET status = 'tratada', updated_at = now() WHERE status = 'nao_lida'`;
  revalidatePath("/dashboard/publicacoes");
}

// ── OABs ─────────────────────────────────────────────────────────────────────

export async function adicionarOabAction(data: {
  numero: string;
  estado: string;
  nome_advogado: string;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "criar"))
    throw new Error("Sem permissão.");

  const { numero, estado, nome_advogado } = data;
  if (!numero.trim() || !estado.trim())
    throw new Error("Número e estado são obrigatórios.");
  await sql`
    INSERT INTO oabs_monitoradas (numero, estado, nome_advogado)
    VALUES (${numero.trim().toUpperCase()}, ${estado.trim().toUpperCase()}, ${nome_advogado.trim() || null})
    ON CONFLICT (numero, estado) DO UPDATE
      SET ativa = true,
          nome_advogado = EXCLUDED.nome_advogado
  `;
  revalidatePath("/dashboard/publicacoes");
}

export async function toggleOabAction(id: string, ativa: boolean) {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "editar")) return;

  await sql`UPDATE oabs_monitoradas SET ativa = ${ativa} WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/publicacoes");
}

export async function removerOabAction(id: string) {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "excluir")) return;

  await sql`DELETE FROM oabs_monitoradas WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/publicacoes");
}

export async function registrarBuscaOabAction(id: string) {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "ver")) return;

  await sql`
    UPDATE oabs_monitoradas SET ultima_busca = now() WHERE id = ${id}::uuid
  `;
  revalidatePath("/dashboard/publicacoes");
}

export async function verificarPublicacoesAction(): Promise<{
  ok: boolean;
  mensagem: string;
  inseridos: number;
}> {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "ver")) {
    return { ok: false, mensagem: "Sem permissão.", inseridos: 0 };
  }

  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      mensagem:
        "DATAJUD_API_KEY não configurada. Cadastre-se em datajud-wiki.cnj.jus.br e adicione a chave no Vercel.",
      inseridos: 0,
    };
  }

  const rows = await sql`
    SELECT id::text, numero, estado, nome_advogado
    FROM oabs_monitoradas WHERE ativa = true
  `;

  if (rows.length === 0) {
    return {
      ok: true,
      mensagem: "Nenhuma OAB ativa cadastrada para monitorar.",
      inseridos: 0,
    };
  }

  const { buscarPublicacoesPorOab } = await import("./datajud");
  let total = 0;
  for (const row of rows) {
    total += await buscarPublicacoesPorOab(
      {
        id: String(row.id),
        numero: String(row.numero),
        estado: String(row.estado),
        nome_advogado: row.nome_advogado ? String(row.nome_advogado) : null,
      },
      apiKey
    );
  }

  revalidatePath("/dashboard/publicacoes");

  return {
    ok: true,
    mensagem:
      total > 0
        ? `${total} nova${total !== 1 ? "s publicações encontradas" : " publicação encontrada"}!`
        : "Nenhuma publicação nova encontrada.",
    inseridos: total,
  };
}
