/**
 * Lógica compartilhada de conversão de lead em cliente/processo quando contrato é assinado.
 * Usada pelo webhook do TramitaSign e pelo endpoint do PrevBot.
 */

import crypto from "crypto";
import sql from "./db";

export async function converterLeadAssinado(
  leadId: string,
  contratoUrl: string | null
): Promise<{
  clientId: string | null;
  processoId: string | null;
  documentoId: string | null;
}> {
  const rows = await sql`
    SELECT nome, email, telefone, tipo, empresa, area_interesse,
           client_id::text, processo_id::text, contrato_url
    FROM crm_leads WHERE id = ${leadId}::uuid
  `;
  if (rows.length === 0)
    return { clientId: null, processoId: null, documentoId: null };

  const lead = rows[0] as {
    nome: string;
    email: string | null;
    telefone: string | null;
    tipo: string;
    empresa: string | null;
    area_interesse: string | null;
    client_id: string | null;
    processo_id: string | null;
    contrato_url: string | null;
  };

  const urlContrato = contratoUrl || lead.contrato_url;

  // 1. Cria cliente se ainda não existe. Provedores de webhook (TramitaSign
  // incluso) reenviam o mesmo evento em timeout/resposta não-2xx — duas
  // execuções concorrentes que leem client_id como NULL antes de qualquer
  // UPDATE gravar criavam duas fichas de cliente/processo duplicadas
  // silenciosamente. Sem suporte a transação neste driver, a forma de
  // tornar "verificar + criar" atômico é um único statement: o UPDATE em
  // crm_leads (com WHERE client_id IS NULL) só "ganha" pra uma das
  // execuções concorrentes, e o INSERT em clients só roda quando esse
  // UPDATE realmente afetou a linha (via WHERE EXISTS na CTE) — id gerado
  // no app pra poder referenciá-lo nos dois lugares da mesma query.
  let clientId: string = lead.client_id ?? "";
  if (!clientId) {
    const novoClientId = crypto.randomUUID();
    const cr = await sql`
      WITH claim AS (
        UPDATE crm_leads SET client_id = ${novoClientId}::uuid
        WHERE id = ${leadId}::uuid AND client_id IS NULL
        RETURNING client_id
      )
      INSERT INTO clients (
        id, type, name, doc, email, phone,
        cep, street, addr_number, neighborhood, city, state,
        status, notes
      )
      SELECT
        ${novoClientId}::uuid,
        ${lead.tipo ?? "PF"},
        ${lead.nome},
        '',
        ${lead.email ?? ""},
        ${lead.telefone ?? ""},
        '', '', '', '', '', '',
        'ativo',
        ${lead.empresa ? `Empresa: ${lead.empresa}` : null}
      WHERE EXISTS (SELECT 1 FROM claim)
      RETURNING id::text
    `;
    if (cr.length > 0) {
      clientId = cr[0].id as string;
    } else {
      // Perdeu a corrida — outra execução concorrente já criou e vinculou
      // o cliente; lê o que ela gravou.
      const [atual] =
        await sql`SELECT client_id::text FROM crm_leads WHERE id = ${leadId}::uuid`;
      clientId = String(atual?.client_id ?? "");
    }
  }

  // 2. Cria processo em Análise se ainda não existe — mesma técnica do
  // passo 1, pra fechar a mesma corrida na criação do processo.
  let processoId: string = lead.processo_id ?? "";
  if (!processoId && clientId) {
    const area = (lead.area_interesse as string | null) ?? "Previdenciário";
    const novoProcessoId = crypto.randomUUID();
    const pr = await sql`
      WITH claim AS (
        UPDATE crm_leads SET processo_id = ${novoProcessoId}::uuid
        WHERE id = ${leadId}::uuid AND processo_id IS NULL
        RETURNING processo_id
      )
      INSERT INTO processos (
        id, client_id, lead_id, tipo_acao, area,
        status, estagio_producao, data_estagio_at
      )
      SELECT
        ${novoProcessoId}::uuid,
        ${clientId}::uuid,
        ${leadId}::uuid,
        ${area},
        ${area},
        'ativo',
        'analise',
        NOW()
      WHERE EXISTS (SELECT 1 FROM claim)
      RETURNING id::text
    `;
    if (pr.length > 0) {
      processoId = pr[0].id as string;
    } else {
      const [atual] =
        await sql`SELECT processo_id::text FROM crm_leads WHERE id = ${leadId}::uuid`;
      processoId = String(atual?.processo_id ?? "");
    }
  }

  // 3. Salva contrato em documentos vinculado ao cliente (idempotente)
  let documentoId: string | null = null;
  if (urlContrato) {
    const docExiste = await sql`
      SELECT id::text FROM documentos
      WHERE entity_type = 'cliente' AND entity_id = ${clientId}::uuid AND tipo = 'contrato'
      LIMIT 1
    `;
    if (docExiste.length === 0) {
      const docRows = await sql`
        INSERT INTO documentos (entity_type, entity_id, nome, tipo, tamanho, caminho, url)
        VALUES ('cliente', ${clientId}::uuid, 'Contrato de Honorários', 'contrato', 0, ${urlContrato}, ${urlContrato})
        RETURNING id::text
      `;
      documentoId = docRows[0].id as string;
    } else {
      documentoId = docExiste[0].id as string;
    }
  }

  // 4. Fecha o lead
  await sql`
    UPDATE crm_leads SET estagio = 'fechado', updated_at = NOW()
    WHERE id = ${leadId}::uuid
  `;

  return { clientId, processoId, documentoId };
}
