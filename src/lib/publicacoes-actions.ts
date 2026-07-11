"use server";

import sql from "./db";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import Anthropic from "@anthropic-ai/sdk";
import { adicionarOabTramitaSign, tramitaSyncAtivo } from "./tramitasign-sync";

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

  // Registra automaticamente no TramitaSign se credenciais configuradas
  if (tramitaSyncAtivo()) {
    adicionarOabTramitaSign(
      numero.trim().toUpperCase(),
      estado.trim().toUpperCase(),
      nome_advogado.trim()
    ).then((r) => {
      if (!r.ok)
        console.warn(
          `[TramitaSync] OAB ${numero}/${estado} não registrada automaticamente: ${r.erro}`
        );
    });
  }

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

export async function gerarResumoIaAction(id: number): Promise<{
  ok: boolean;
  mensagem: string;
}> {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "ver")) {
    return { ok: false, mensagem: "Sem permissão." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, mensagem: "ANTHROPIC_API_KEY não configurada." };
  }

  const rows = await sql`
    SELECT id, tipo, orgao, tribunal, conteudo, conteudo_completo,
           TO_CHAR(disponibilizacao, 'DD/MM/YYYY') AS disponibilizacao
    FROM publicacoes WHERE id = ${id} LIMIT 1
  `;
  if (!rows[0]) return { ok: false, mensagem: "Publicação não encontrada." };

  const pub = rows[0];
  const texto = String(pub.conteudo_completo ?? pub.conteudo ?? "").trim();

  if (!texto) {
    return {
      ok: false,
      mensagem:
        "Esta publicação não possui texto para analisar. Aguarde a captura do conteúdo completo.",
    };
  }

  const prompt = `Você é um assistente jurídico brasileiro. Analise esta publicação do Diário de Justiça e retorne SOMENTE um JSON válido no formato abaixo. Campos desconhecidos devem ser null.

{
  "texto": "Resumo em português claro em 2-3 frases explicando o que a publicação determina",
  "prazo_dias": <número inteiro de dias úteis do prazo processual, ou null se não houver>,
  "acao_necessaria": "<ação necessária: Recurso | Manifestação | Contestação | Pagamento | Audiência | Cumprimento de sentença | Petição | Nenhuma ação imediata | ou outra ação concisa>",
  "audiencia": "<data da audiência no formato DD/MM/YYYY, ou null se não houver>"
}

Publicação:
Tipo: ${pub.tipo}
Órgão: ${pub.orgao} · ${pub.tribunal}
Data: ${pub.disponibilizacao}

${texto.slice(0, 4000)}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const block = res.content[0];
    const raw = block?.type === "text" ? block.text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, mensagem: "IA não retornou JSON válido." };

    const resumo = JSON.parse(match[0]) as {
      texto: string;
      prazo_dias: number | null;
      acao_necessaria: string | null;
      audiencia: string | null;
    };

    await sql`
      UPDATE publicacoes
      SET resumo_ia = ${JSON.stringify(resumo)}::jsonb, updated_at = now()
      WHERE id = ${id}
    `;

    revalidatePath(`/dashboard/publicacoes/${id}`);
    revalidatePath("/dashboard/publicacoes");

    return { ok: true, mensagem: "Resumo gerado com sucesso!" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido.";
    return { ok: false, mensagem: `Erro: ${msg}` };
  }
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
  let total = 0;

  const rows = await sql`
    SELECT id::text, numero, estado, nome_advogado
    FROM oabs_monitoradas WHERE ativa = true
  `;

  const { buscarPublicacoesPorOab, buscarMovimentosPorProcesso } =
    await import("./datajud");
  const { buscarPublicacoesDjeEsaj } = await import("./dje-esaj");

  // 1. Busca por OAB no DataJud (só funciona em tribunais que indexam partes)
  if (apiKey && rows.length > 0) {
    for (const row of rows) {
      total += await buscarPublicacoesPorOab(
        {
          id: String(row.id),
          numero: String(row.numero),
          estado: String(row.estado),
          nome_advogado: row.nome_advogado ? String(row.nome_advogado) : null,
        },
        apiKey,
        30
      );
    }
  }

  // 2. Busca por OAB no DJe/eSAJ (funciona para TJAL, TJCE, TJSP e outros eSAJ)
  if (rows.length > 0) {
    for (const row of rows) {
      total += await buscarPublicacoesDjeEsaj(
        {
          id: String(row.id),
          numero: String(row.numero),
          estado: String(row.estado),
          nome_advogado: row.nome_advogado ? String(row.nome_advogado) : null,
        },
        30
      );
    }
  }

  // 3. Busca por número de processo no DataJud (funciona mesmo sem indexação de partes)
  if (apiKey) {
    const processos = await sql`
      SELECT p.id::text, p.numero, c.name AS cliente_nome
      FROM processos p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.numero IS NOT NULL AND p.numero != ''
        AND LENGTH(REGEXP_REPLACE(p.numero, '[^0-9]', '', 'g')) = 20
    `;
    for (const proc of processos) {
      total += await buscarMovimentosPorProcesso(
        String(proc.id),
        String(proc.numero),
        proc.cliente_nome ? String(proc.cliente_nome) : null,
        apiKey,
        30
      );
    }
  }

  // 4. Sincronização com TramitaSign (traz publicações que já estão lá)
  try {
    const { sincronizarTramitaSign, tramitaSyncAtivo } =
      await import("./tramitasign-sync");
    if (tramitaSyncAtivo()) {
      const res = await sincronizarTramitaSign();
      total += res.inseridos;
    }
  } catch (e) {
    console.error("[verificarPublicacoes] TramitaSign sync error:", e);
  }

  revalidatePath("/dashboard/publicacoes");

  if (!apiKey && rows.length === 0) {
    return {
      ok: true,
      mensagem:
        "Nenhuma OAB ativa e DATAJUD_API_KEY não configurada. Apenas DJe está ativo.",
      inseridos: total,
    };
  }

  return {
    ok: true,
    mensagem:
      total > 0
        ? `${total} nova${total !== 1 ? "s publicações/intimações encontradas" : " publicação encontrada"}!`
        : "Nenhuma publicação nova encontrada. Se esperava resultados, tente novamente ou adicione a publicação manualmente.",
    inseridos: total,
  };
}

export async function adicionarPublicacaoManualAction(data: {
  processo: string;
  tipo: string;
  destinatario: string;
  orgao: string;
  tribunal: string;
  disponibilizacao: string;
  conteudo: string;
}): Promise<{ ok: boolean; mensagem: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "publicacoes", "criar")) {
    return { ok: false, mensagem: "Sem permissão." };
  }

  const {
    processo,
    tipo,
    destinatario,
    orgao,
    tribunal,
    disponibilizacao,
    conteudo,
  } = data;
  if (!processo.trim() || !tipo.trim() || !disponibilizacao.trim()) {
    return { ok: false, mensagem: "Processo, tipo e data são obrigatórios." };
  }

  await sql`
    INSERT INTO publicacoes
      (processo, tipo, destinatario, advogados, orgao, tribunal, disponibilizacao, status, origem, conteudo)
    VALUES (
      ${processo.trim()},
      ${tipo.trim()},
      ${destinatario.trim() || null},
      ${[]},
      ${orgao.trim() || "—"},
      ${tribunal.trim() || "—"},
      ${disponibilizacao}::date,
      'nao_lida',
      'manual',
      ${conteudo.trim() || null}
    )
  `;

  revalidatePath("/dashboard/publicacoes");
  return { ok: true, mensagem: "Publicação registrada com sucesso!" };
}
